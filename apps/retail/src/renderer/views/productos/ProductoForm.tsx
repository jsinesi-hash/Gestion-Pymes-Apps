import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProducto } from '../../hooks/useProducto';
import { useCategorias } from '../../hooks/useCategorias';
import { useMarcas } from '../../hooks/useMarcas';
import { useImpuestos } from '../../hooks/useImpuestos';
import { useUbicaciones } from '../../hooks/useUbicaciones';
import { useUnidades } from '../../hooks/useUnidades';
import { useEscapeToClose } from '@core/ui';
import { useCallIpc } from '@core/ui';

type FormState = {
  nombre_corto: string; nombre_largo: string; descripcion_tecnica: string;
  categoria_id: string; marca_id: string; unidad_venta: string; unidad_compra: string;
  factor_conversion: number; permite_fraccion: boolean; gtin_barcode: string;
  impuesto_id: string; precio_venta_lista: string;
  stock_minimo: string; stock_maximo: string; ubicacion_id: string; activo: boolean;
  stock_inicial_cantidad: string; stock_inicial_costo: string;
};

// PROD-1 (ADR-077): campos requeridos en orden visual/DOM (el primero inválido recibe el
// foco al fallar el submit) y el id real del control para poder enfocarlo.
const CAMPOS_REQUERIDOS = ['nombre_corto', 'categoria_id', 'precio_venta_lista', 'impuesto_id', 'unidad_venta'] as const;
type CampoRequerido = typeof CAMPOS_REQUERIDOS[number];
const ID_CONTROL: Record<CampoRequerido, string> = {
  nombre_corto: 'nombre_corto', categoria_id: 'categoria', precio_venta_lista: 'precio',
  impuesto_id: 'impuesto', unidad_venta: 'unidad_venta',
};

// Mensaje de error específico para un campo (o '' si es válido).
function validarCampo(campo: CampoRequerido, form: FormState): string {
  switch (campo) {
    case 'nombre_corto': return form.nombre_corto.trim() ? '' : 'Ingresá un nombre';
    case 'categoria_id': return form.categoria_id ? '' : 'Seleccioná una categoría';
    case 'impuesto_id': return form.impuesto_id ? '' : 'Seleccioná un impuesto';
    case 'unidad_venta': return form.unidad_venta.trim() ? '' : 'Seleccioná una unidad de venta';
    case 'precio_venta_lista': {
      const n = Number(form.precio_venta_lista);
      return form.precio_venta_lista !== '' && !Number.isNaN(n) && n > 0 ? '' : 'Ingresá un precio mayor a 0';
    }
    default: return '';
  }
}

const initialForm: FormState = {
  nombre_corto: '', nombre_largo: '', descripcion_tecnica: '',
  categoria_id: '', marca_id: '', unidad_venta: '', unidad_compra: '',
  factor_conversion: 1, permite_fraccion: false, gtin_barcode: '',
  impuesto_id: '', precio_venta_lista: '', stock_minimo: '', stock_maximo: '',
  ubicacion_id: '', activo: true,
  stock_inicial_cantidad: '', stock_inicial_costo: '',
};

export function ProductoForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const modoEdicion = !!id;
  const { producto } = useProducto(id);
  const categorias = useCategorias();
  const { marcas, createMarca } = useMarcas();
  const impuestos = useImpuestos();
  const ubicaciones = useUbicaciones();
  const unidades = useUnidades();

  const callIpc = useCallIpc();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showMarcaModal, setShowMarcaModal] = useState(false);
  const [newMarcaNombre, setNewMarcaNombre] = useState('');

  useEscapeToClose(() => setShowMarcaModal(false), showMarcaModal);

  useEffect(() => {
    if (!producto || !modoEdicion) return;
    setForm({
      nombre_corto: producto.nombre_corto ?? '',
      nombre_largo: producto.nombre_largo ?? '',
      descripcion_tecnica: producto.descripcion_tecnica ?? '',
      categoria_id: producto.categoria_id ?? '',
      marca_id: producto.marca_id ?? '',
      unidad_venta: producto.unidad_venta ?? 'unidad',
      unidad_compra: producto.unidad_compra ?? '',
      factor_conversion: producto.factor_conversion ?? 1,
      permite_fraccion: producto.permite_fraccion ?? false,
      gtin_barcode: producto.gtin_barcode ?? '',
      impuesto_id: producto.impuesto_id ?? '',
      precio_venta_lista: String(producto.precio_venta_lista ?? ''),
      stock_minimo: '', stock_maximo: '',
      stock_inicial_cantidad: '', stock_inicial_costo: '',
      ubicacion_id: producto.ubicacion_id ?? '',
      activo: producto.activo ?? true,
    });
  }, [producto, modoEdicion]);

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const campo of CAMPOS_REQUERIDOS) {
      const msg = validarCampo(campo, form);
      if (msg) errs[campo] = msg;
    }
    return errs;
  }

  // PROD-1: valida el campo al salir de él (onBlur), sin disparar todos los errores del
  // formulario de golpe.
  const handleBlur = (campo: CampoRequerido) => () => {
    setErrors(prev => ({ ...prev, [campo]: validarCampo(campo, form) }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // PROD-1: foco al primer campo inválido en orden visual.
      const primero = CAMPOS_REQUERIDOS.find(c => errs[c]);
      if (primero) document.getElementById(ID_CONTROL[primero])?.focus();
      return;
    }
    setSaving(true);
    const iniCant = Number(form.stock_inicial_cantidad);
    const iniCosto = form.stock_inicial_costo !== '' ? Number(form.stock_inicial_costo) : undefined;
    const stock_inicial = (!modoEdicion && form.stock_inicial_cantidad !== '' && !Number.isNaN(iniCant) && iniCant > 0)
      ? { cantidad: iniCant, ...(iniCosto != null && !Number.isNaN(iniCosto) && iniCosto > 0 ? { costo: iniCosto } : {}) }
      : undefined;
    const payload = {
      nombre_corto: form.nombre_corto,
      nombre_largo: form.nombre_largo || undefined,
      descripcion_tecnica: form.descripcion_tecnica || undefined,
      categoria_id: form.categoria_id,
      marca_id: form.marca_id || undefined,
      unidad_venta: form.unidad_venta,
      unidad_compra: form.unidad_compra || undefined,
      factor_conversion: form.factor_conversion,
      permite_fraccion: form.permite_fraccion,
      gtin_barcode: form.gtin_barcode || undefined,
      impuesto_id: form.impuesto_id,
      precio_venta_lista: Number(form.precio_venta_lista),
      stock_minimo: form.stock_minimo ? Number(form.stock_minimo) : undefined,
      stock_maximo: form.stock_maximo ? Number(form.stock_maximo) : undefined,
      ubicacion_id: form.ubicacion_id || undefined,
      ...(stock_inicial ? { stock_inicial } : {}),
    };
    const ferr = (globalThis as any).ferreteria.catalogo.producto;
    // ERR-1: callIpc traduce y muestra el error por toast; sólo navegamos si salió bien.
    const r = await callIpc<{ id: string }>(
      () => (modoEdicion ? ferr.update({ id, ...payload }) : ferr.create(payload)),
      { success: modoEdicion ? 'Producto actualizado' : 'Producto creado' },
    );
    setSaving(false);
    if (!r.ok) {
      // ADR-082 (SEC-2): si el backend rechazó por validación de un campo del form,
      // pintamos ese error inline y enfocamos el control (el toast ya lo mostró callIpc).
      const campo = r.traducido.campo;
      if (campo && (CAMPOS_REQUERIDOS as readonly string[]).includes(campo)) {
        setErrors(prev => ({ ...prev, [campo]: r.traducido.mensaje }));
        document.getElementById(ID_CONTROL[campo as CampoRequerido])?.focus();
      }
      return;
    }
    navigate(`/productos/${modoEdicion ? id : r.data.id}`);
  }

  async function handleCreateMarca() {
    if (!newMarcaNombre.trim()) return;
    const m = await createMarca(newMarcaNombre.trim());
    setForm(prev => ({ ...prev, marca_id: m?.id ?? prev.marca_id }));
    setNewMarcaNombre('');
    setShowMarcaModal(false);
  }

  const setField = (f: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <>
      <form onSubmit={handleSubmit} data-testid="producto-form" className="flex-col gap-4" style={{ maxWidth: '680px' }}>
        <h2 style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-.02em' }}>
          {modoEdicion ? 'Editar producto' : 'Nuevo producto'}
        </h2>

        <div className="card">
          <div className="card-title">Datos básicos</div>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="nombre_corto">Nombre corto *</label>
              <input id="nombre_corto" className="input" data-testid="nombre_corto"
                value={form.nombre_corto} onChange={setField('nombre_corto')} onBlur={handleBlur('nombre_corto')} />
              {errors.nombre_corto && <span role="alert" style={{ color: 'var(--danger)', fontSize: '12px' }}>{errors.nombre_corto}</span>}
            </div>
            <div className="field">
              <label htmlFor="nombre_largo">Nombre largo</label>
              <input id="nombre_largo" className="input" value={form.nombre_largo} onChange={setField('nombre_largo')} />
            </div>
            <div className="field">
              <label htmlFor="descripcion">Descripción técnica</label>
              <textarea id="descripcion" className="input" rows={3}
                value={form.descripcion_tecnica} onChange={setField('descripcion_tecnica')} />
            </div>
            <div className="flex gap-3">
              <div className="field flex-1">
                <label htmlFor="categoria">Categoría *</label>
                <select id="categoria" className="input" data-testid="categoria_id"
                  value={form.categoria_id} onChange={setField('categoria_id')} onBlur={handleBlur('categoria_id')}>
                  <option value="">-- Seleccionar --</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                {errors.categoria_id && <span role="alert" style={{ color: 'var(--danger)', fontSize: '12px' }}>{errors.categoria_id}</span>}
              </div>
              <div className="field flex-1">
                <label htmlFor="marca">Marca</label>
                <div className="flex gap-2">
                  <select id="marca" className="input flex-1" value={form.marca_id} onChange={setField('marca_id')}>
                    <option value="">-- Sin marca --</option>
                    {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                  <button type="button" className="btn-secondary" onClick={() => setShowMarcaModal(true)}>+ Nueva</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Precio y unidades</div>
          <div className="modal-body">
            <div className="flex gap-3">
              <div className="field flex-1">
                <label htmlFor="precio">Precio venta lista (IVA inc.) *</label>
                <input id="precio" className="input num" data-testid="precio_venta_lista"
                  type="number" min="0" step="0.01"
                  value={form.precio_venta_lista} onChange={setField('precio_venta_lista')} onBlur={handleBlur('precio_venta_lista')} />
                {errors.precio_venta_lista && <span role="alert" style={{ color: 'var(--danger)', fontSize: '12px' }}>{errors.precio_venta_lista}</span>}
              </div>
              <div className="field flex-1">
                <label htmlFor="impuesto">Impuesto *</label>
                <select id="impuesto" className="input" data-testid="impuesto_id"
                  value={form.impuesto_id} onChange={setField('impuesto_id')} onBlur={handleBlur('impuesto_id')}>
                  <option value="">-- Seleccionar --</option>
                  {impuestos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                </select>
                {errors.impuesto_id && <span role="alert" style={{ color: 'var(--danger)', fontSize: '12px' }}>{errors.impuesto_id}</span>}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="field flex-1">
                <label htmlFor="unidad_venta">Unidad de venta *</label>
                <select id="unidad_venta" className="input" data-testid="unidad_venta"
                  value={form.unidad_venta} onChange={setField('unidad_venta')} onBlur={handleBlur('unidad_venta')}>
                  <option value="">-- Seleccionar --</option>
                  {unidades.map(u => <option key={u.id} value={u.abreviatura}>{u.nombre} ({u.abreviatura})</option>)}
                </select>
                {errors.unidad_venta && <span role="alert" style={{ color: 'var(--danger)', fontSize: '12px' }}>{errors.unidad_venta}</span>}
              </div>
              <div className="field flex-1">
                <label htmlFor="unidad_compra">Unidad de compra</label>
                <select id="unidad_compra" className="input" value={form.unidad_compra} onChange={setField('unidad_compra')}>
                  <option value="">-- Misma que venta --</option>
                  {unidades.map(u => <option key={u.id} value={u.abreviatura}>{u.nombre} ({u.abreviatura})</option>)}
                </select>
              </div>
              <div className="field" style={{ width: '120px' }}>
                <label htmlFor="factor">Factor conversión</label>
                <input id="factor" className="input num" type="number" min="0.001" step="0.001"
                  value={form.factor_conversion}
                  onChange={e => setForm(prev => ({ ...prev, factor_conversion: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Stock y ubicación</div>
          <div className="modal-body">
            <div className="flex gap-3">
              <div className="field flex-1">
                <label htmlFor="stock_min">Stock mínimo</label>
                <input id="stock_min" className="input num" type="number" min="0"
                  value={form.stock_minimo} onChange={setField('stock_minimo')} />
              </div>
              <div className="field flex-1">
                <label htmlFor="stock_max">Stock máximo</label>
                <input id="stock_max" className="input num" type="number" min="0"
                  value={form.stock_maximo} onChange={setField('stock_maximo')} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="ubicacion">Ubicación</label>
              <select id="ubicacion" className="input" value={form.ubicacion_id} onChange={setField('ubicacion_id')}>
                <option value="">-- Sin ubicación --</option>
                {ubicaciones.map(u => <option key={u.id} value={u.id}>{u.codigo}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="gtin">Código EAN/barcode</label>
              <input id="gtin" className="input num" value={form.gtin_barcode} onChange={setField('gtin_barcode')} />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="checkbox" id="fraccion" checked={form.permite_fraccion}
                onChange={e => setForm(prev => ({ ...prev, permite_fraccion: e.target.checked }))} />
              <label htmlFor="fraccion" style={{ fontSize: '14px', cursor: 'pointer', textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: 'var(--ink)' }}>
                Permite fracción
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="checkbox" id="activo" checked={form.activo}
                onChange={e => setForm(prev => ({ ...prev, activo: e.target.checked }))} />
              <label htmlFor="activo" style={{ fontSize: '14px', cursor: 'pointer', textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: 'var(--ink)' }}>
                Activo
              </label>
            </div>
          </div>
        </div>

        {!modoEdicion && (
          <div className="card">
            <div className="card-title">Stock inicial (opcional)</div>
            <div className="modal-body">
              <p className="text-muted text-sm">Cargá una cantidad y su costo para que el producto quede listo para vender. Podés omitirlo y hacerlo después.</p>
              <div className="flex gap-3">
                <div className="field flex-1">
                  <label htmlFor="stock_ini_cant">Cantidad</label>
                  <input id="stock_ini_cant" className="input num" data-testid="stock_inicial_cantidad" type="number" min="0" step="1"
                    value={form.stock_inicial_cantidad} onChange={setField('stock_inicial_cantidad')} />
                </div>
                <div className="field flex-1">
                  <label htmlFor="stock_ini_costo">Costo unitario</label>
                  <input id="stock_ini_costo" className="input num" data-testid="stock_inicial_costo" type="number" min="0" step="0.01"
                    value={form.stock_inicial_costo} onChange={setField('stock_inicial_costo')} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {modoEdicion ? 'Guardar cambios' : 'Crear producto'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
        </div>
      </form>

      {showMarcaModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Nueva marca</span>
            </div>
            <div className="modal-body">
              <div className="field">
                <label htmlFor="nueva-marca-nombre">Nombre</label>
                <input id="nueva-marca-nombre" className="input" value={newMarcaNombre}
                  onChange={e => setNewMarcaNombre(e.target.value)}
                  placeholder="Nombre de la marca" autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowMarcaModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreateMarca}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
