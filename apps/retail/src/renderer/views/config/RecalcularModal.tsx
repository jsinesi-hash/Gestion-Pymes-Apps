import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMotorPreciosV2Habilitado } from '../../hooks/useMotorPrecios';
import { useEscapeToClose } from '@core/ui';
import { useCallIpc } from '@core/ui';

const f = () => (globalThis as any).ferreteria;

// ADR-085 (SEC-2): campos del "programar cambio" que pueden mostrar un error inline.
// Sus controles llevan un `id` igual a la clave, para poder enfocar el control cuando
// el backend rechaza por él. `lista_precio_id` no tiene control en este modal (viene
// de la lista seleccionada) → cae en el error general.
const CAMPOS_ERROR = new Set([
  'porcentaje', 'base_calculo', 'alcance', 'alcance_id',
  'excluir_manuales_dias', 'fecha_aplicacion',
]);

type Props = {
  listaId: string;
  listaNombre: string;
  onClose: () => void;
  onSuccess: () => void;
};

type Params = {
  porcentaje: string;
  base_calculo: 'precio_lista' | 'costo_proveedor' | 'lista';
  alcance: 'catalogo' | 'rubro' | 'marca' | 'proveedor';
  alcance_id: string;
  excluir_manuales_dias: string;
  modo: 'ahora' | 'programado';
  fecha_aplicacion: string;
};

type AlcanceOption = { id: string; label: string };

export function RecalcularModal({ listaId, listaNombre, onClose, onSuccess }: Readonly<Props>) {
  const motorV2 = useMotorPreciosV2Habilitado();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const lotesBase = pathname.startsWith('/precios/hub') ? '/precios/hub/lotes' : '/precios/lotes';
  const [params, setParams] = useState<Params>({
    porcentaje: '0',
    base_calculo: 'precio_lista',
    alcance: 'catalogo',
    alcance_id: '',
    excluir_manuales_dias: '',
    modo: 'ahora',
    fecha_aplicacion: '',
  });
  const [conteo, setConteo] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alcanceOpciones, setAlcanceOpciones] = useState<AlcanceOption[]>([]);
  const callIpc = useCallIpc();

  useEscapeToClose(onClose, !loading);

  // ADR-085 (SEC-2): setter común — limpia el error inline del campo al tocarlo.
  function setParam<K extends keyof Params>(field: K, value: Params[K]) {
    setParams(p => ({ ...p, [field]: value }));
    setErrors(e => { if (!(field in e)) return e; const n = { ...e }; delete n[field]; return n; });
  }

  useEffect(() => {
    if (params.alcance === 'catalogo') { setAlcanceOpciones([]); return; }
    let cancelled = false;
    async function cargar() {
      let items: any[] = [];
      if (params.alcance === 'rubro') {
        items = await f().catalogo.categoria.list();
      } else if (params.alcance === 'marca') {
        items = await f().catalogo.marca.list();
      } else if (params.alcance === 'proveedor') {
        items = await f().compras.proveedor.list();
      }
      if (!cancelled) {
        setAlcanceOpciones(items.map((x: any) => ({
          id: x.id,
          label: x.razon_social ?? x.nombre,
        })));
      }
    }
    cargar();
    return () => { cancelled = true; };
  }, [params.alcance]);

  function buildPayload() {
    return {
      lista_precio_id: listaId,
      porcentaje: Number.parseFloat(params.porcentaje) || 0,
      base_calculo: params.base_calculo,
      alcance: params.alcance,
      alcance_id: params.alcance_id || undefined,
      excluir_manuales_dias: params.excluir_manuales_dias ? Number(params.excluir_manuales_dias) : undefined,
    };
  }

  async function handleContar() {
    setLoading(true);
    setError(null);
    try {
      const n = await f().precios.valor.contarAfectados(buildPayload());
      setConteo(n);
    } catch (e: any) {
      setError(e?.message ?? 'Error al contar');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmar() {
    setLoading(true);
    setError(null);
    setErrors({});
    try {
      if (motorV2) {
        // ADR-049 §8: no aplica directo — genera un lote en borrador para revisar/aprobar.
        const { id } = await f().precios.batch.crear({
          lista_precio_id: listaId,
          origen: 'MANUAL_RECALCULATION',
          alcance: params.alcance,
          alcance_id: params.alcance_id || undefined,
          excluir_manuales_dias: params.excluir_manuales_dias ? Number(params.excluir_manuales_dias) : undefined,
        });
        onSuccess();
        onClose();
        navigate(`${lotesBase}/${id}`);
      } else if (params.modo === 'ahora') {
        await f().precios.valor.recalcularMasivo(buildPayload());
        onSuccess();
        onClose();
      } else {
        // ADR-085 (SEC-2): ruteo del error de validación del backend al campo del form.
        const r = await callIpc(
          () => f().precios.cambioProgramado.crear({
            ...buildPayload(),
            fecha_aplicacion: new Date(params.fecha_aplicacion),
          }),
          { success: 'Cambio programado creado' },
        );
        if (!r.ok) {
          const campo = r.traducido.campo;
          if (campo && CAMPOS_ERROR.has(campo)) {
            setErrors(prev => ({ ...prev, [campo]: r.traducido.mensaje }));
            document.getElementById(campo)?.focus();
          } else {
            setError(r.traducido.mensaje);
          }
          return;
        }
        onSuccess();
        onClose();
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error al aplicar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="card" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-title">{motorV2 ? 'Crear lote' : 'Recalcular'} — {listaNombre}</div>

        {error && <div className="alert-danger" style={{ margin: '0 var(--pad) 8px' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 'var(--pad)' }}>
          {motorV2 && (
            <div className="text-sm text-muted">
              El lote se calcula con las reglas de margen de la lista sobre el costo neto. No se
              aplica directo: queda en borrador para revisar y aprobar.
            </div>
          )}
          {!motorV2 && (
            <label>Base de cálculo
              <select id="base_calculo" className={`input${errors.base_calculo ? ' error' : ''}`} value={params.base_calculo}
                onChange={e => { setParam('base_calculo', e.target.value as Params['base_calculo']); setConteo(null); }}>
                <option value="precio_lista">Precio de lista</option>
                <option value="costo_proveedor">Costo del proveedor preferido</option>
                <option value="lista">Otra lista de precios</option>
              </select>
              {errors.base_calculo && <span className="field-error">{errors.base_calculo}</span>}
            </label>
          )}

          {!motorV2 && (
            <label>Porcentaje de ajuste (ej: 15 = +15%, -5 = -5%)
              <input id="porcentaje" className={`input num${errors.porcentaje ? ' error' : ''}`} type="number" value={params.porcentaje}
                onChange={e => { setParam('porcentaje', e.target.value); setConteo(null); }} />
              {errors.porcentaje && <span className="field-error">{errors.porcentaje}</span>}
            </label>
          )}

          <label>Alcance
            <select id="alcance" className={`input${errors.alcance ? ' error' : ''}`} value={params.alcance}
              onChange={e => { setParam('alcance', e.target.value as Params['alcance']); setParam('alcance_id', ''); setConteo(null); }}>
              <option value="catalogo">Catálogo completo</option>
              <option value="rubro">Rubro (categoría)</option>
              <option value="marca">Marca</option>
              <option value="proveedor">Proveedor</option>
            </select>
            {errors.alcance && <span className="field-error">{errors.alcance}</span>}
          </label>

          {params.alcance !== 'catalogo' && (
            <label>
              {params.alcance === 'rubro' ? 'Rubro' : params.alcance === 'marca' ? 'Marca' : 'Proveedor'}
              <select id="alcance_id" className={`input${errors.alcance_id ? ' error' : ''}`} value={params.alcance_id}
                onChange={e => { setParam('alcance_id', e.target.value); setConteo(null); }}>
                <option value="">— Seleccionar —</option>
                {alcanceOpciones.map(op => (
                  <option key={op.id} value={op.id}>{op.label}</option>
                ))}
              </select>
              {errors.alcance_id && <span className="field-error">{errors.alcance_id}</span>}
            </label>
          )}

          <label>Excluir precios manuales de los últimos N días (opcional)
            <input id="excluir_manuales_dias" className={`input num${errors.excluir_manuales_dias ? ' error' : ''}`} type="number" value={params.excluir_manuales_dias}
              onChange={e => { setParam('excluir_manuales_dias', e.target.value); setConteo(null); }}
              placeholder="Ej: 30" />
            {errors.excluir_manuales_dias && <span className="field-error">{errors.excluir_manuales_dias}</span>}
          </label>

          {!motorV2 && (
            <label>Modo
              <select className="input" value={params.modo}
                onChange={e => setParams(p => ({ ...p, modo: e.target.value as Params['modo'] }))}>
                <option value="ahora">Aplicar ahora</option>
                <option value="programado">Programar para fecha futura</option>
              </select>
            </label>
          )}

          {!motorV2 && params.modo === 'programado' && (
            <label>Fecha de aplicación
              <input id="fecha_aplicacion" className={`input${errors.fecha_aplicacion ? ' error' : ''}`} type="datetime-local" value={params.fecha_aplicacion}
                onChange={e => setParam('fecha_aplicacion', e.target.value)} />
              {errors.fecha_aplicacion && <span className="field-error">{errors.fecha_aplicacion}</span>}
            </label>
          )}

          <button className="btn-secondary" onClick={handleContar} disabled={loading}>
            Calcular productos afectados
          </button>

          {conteo !== null && (
            <div style={{ padding: '10px', background: conteo === 0 ? 'var(--color-danger-bg, #fee2e2)' : 'var(--color-info-bg, #dbeafe)', borderRadius: 4, fontSize: 14 }}>
              {conteo === 0 ? 'Ningún producto coincide con los filtros' : `Se van a actualizar ${conteo} producto${conteo !== 1 ? 's' : ''}`}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: 'var(--pad)', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn-primary" onClick={handleConfirmar}
            disabled={loading || conteo === null || conteo === 0}>
            {motorV2 ? 'Crear lote' : params.modo === 'ahora' ? 'Aplicar ahora' : 'Programar'}
          </button>
        </div>
      </div>
    </div>
  );
}
