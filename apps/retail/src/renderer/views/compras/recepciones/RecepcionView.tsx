import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCallIpc } from '@core/ui';

// ADR-085 (SEC-2): campos del header que pueden enfocarse cuando el backend rechaza por
// ellos. `orden_compra_id` no tiene input propio (viene de la ruta) y los errores de
// `items.<i>.<campo>` no tienen un control fijo por índice, así que ambos caen en la
// región general de error.
const CAMPOS_ERROR = new Set(['remito_proveedor', 'observaciones']);

type ItemOC = {
  id: string;
  producto_id: string;
  descripcion: string;
  cantidad_pedida: number;
  cantidad_recibida: number;
  costo_unitario_centavos: number;
};

type OC = {
  id: string;
  numero_interno: string;
  proveedor_id: string;
  razon_social: string;
  estado: string;
  items: ItemOC[];
};

type ItemRecepcion = {
  item_oc_id: string;
  cantidad_recibida: string;
};

function fmtARS(c: number) {
  return (c / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}

function clampItem(it: ItemRecepcion, oc: OC | null, id: string, value: string): ItemRecepcion {
  if (it.item_oc_id !== id) return it;
  const ocItem = oc?.items.find(i => i.id === id);
  if (!ocItem) return { ...it, cantidad_recibida: value };
  const max = ocItem.cantidad_pedida - ocItem.cantidad_recibida;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  if (Number.isNaN(parsed)) return { ...it, cantidad_recibida: '0' }; // ADR-066: vacío/no-numérico → 0 en blur
  if (parsed > max) return { ...it, cantidad_recibida: String(max) };
  if (parsed < 0) return { ...it, cantidad_recibida: '0' };
  return { ...it, cantidad_recibida: value };
}

export function RecepcionView() {
  const { ocId } = useParams<{ ocId: string }>();
  const navigate = useNavigate();
  const callIpc = useCallIpc();
  const [oc, setOc] = useState<OC | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ItemRecepcion[]>([]);
  const [remito, setRemito] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!ocId) return;
    (globalThis as any).ferreteria.compras.oc.get(ocId).then((data: OC | null) => {
      setOc(data);
      if (data) {
        setItems(data.items
          .filter(i => i.cantidad_recibida < i.cantidad_pedida)
          .map(i => ({
            item_oc_id: i.id,
            cantidad_recibida: String(i.cantidad_pedida - i.cantidad_recibida),
          }))
        );
      }
    }).finally(() => setLoading(false));
  }, [ocId]);

  function setCantidadRaw(id: string, value: string) {
    setItems(prev => prev.map(it =>
      it.item_oc_id === id ? { ...it, cantidad_recibida: value } : it,
    ));
  }

  function clampCantidad(id: string) {
    setItems(prev => prev.map(it =>
      it.item_oc_id === id ? clampItem(it, oc, id, it.cantidad_recibida) : it,
    ));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ocId || !oc) return;
    setError(null);
    setFieldErrors({});

    for (const it of items) {
      const ocItem = oc.items.find(i => i.id === it.item_oc_id);
      if (!ocItem) continue;
      const max = ocItem.cantidad_pedida - ocItem.cantidad_recibida;
      const cant = Number.parseFloat(it.cantidad_recibida.replace(',', '.'));
      if (!Number.isNaN(cant) && cant < 0) {
        setError(`La cantidad de "${ocItem.descripcion}" no puede ser negativa.`);
        return;
      }
      if (!Number.isNaN(cant) && cant > max) {
        setError(`La cantidad de "${ocItem.descripcion}" supera lo pendiente (máx. ${max}).`);
        return;
      }
    }

    setSaving(true);
    const payload = {
      orden_compra_id: ocId,
      remito_proveedor: remito.trim() || undefined,
      observaciones: observaciones.trim() || undefined,
      items: items
        .filter(it => Number.parseFloat(it.cantidad_recibida.replace(',', '.')) > 0)
        .map(it => ({
          item_oc_id:        it.item_oc_id,
          cantidad_recibida: Number.parseFloat(it.cantidad_recibida.replace(',', '.')),
        })),
    };
    // ERR-1: callIpc traduce y muestra el error por toast; sólo navegamos si salió bien.
    const r = await callIpc(
      () => (globalThis as any).ferreteria.compras.recepcion.crear(payload),
      { success: 'Recepción registrada' },
    );
    setSaving(false);
    if (!r.ok) {
      // ADR-085 (SEC-2): campos del header rutean al input; el resto (incluidos los
      // errores por ítem, `items.<i>.<campo>`) va a la región general de error.
      const campo = r.traducido.campo;
      if (campo && CAMPOS_ERROR.has(campo)) {
        setFieldErrors(prev => ({ ...prev, [campo]: r.traducido.mensaje }));
        document.getElementById(campo)?.focus();
      } else {
        setError(r.traducido.mensaje);
      }
      return;
    }
    navigate(`/compras/ordenes/${ocId}`);
  }

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;
  if (!oc) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>OC no encontrada.</div>;

  const pendientes = oc.items.filter(i => i.cantidad_recibida < i.cantidad_pedida);
  if (pendientes.length === 0) return (
    <div className="flex-col gap-4">
      <div className="detail-head">
        <button className="back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Volver
        </button>
        <h1>Recibir mercadería</h1>
      </div>
      <div className="card">
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
          Todos los ítems de esta OC ya fueron recibidos.
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-col gap-4">
      <div className="detail-head">
        <button className="back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Volver
        </button>
        <h1>Recibir — <span className="num">{oc.numero_interno}</span></h1>
        <span style={{ opacity: 0.6, fontSize: '14px' }}>{oc.razon_social}</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-col gap-4">
        <div className="card">
          <div className="card-title">Comprobante</div>
          <div className="form-row" style={{ paddingLeft: 'var(--pad, 16px)' }}>
            <label className="form-label">
              Remito proveedor{' '}
              <input id="remito_proveedor" className={`input${fieldErrors.remito_proveedor ? ' error' : ''}`} value={remito}
                onChange={e => setRemito(e.target.value)} placeholder="R-0001" />
              {fieldErrors.remito_proveedor && <span className="field-error">{fieldErrors.remito_proveedor}</span>}
            </label>
            <label className="form-label" style={{ flex: 2 }}>
              Observaciones{' '}
              <input id="observaciones" className={`input${fieldErrors.observaciones ? ' error' : ''}`} value={observaciones}
                onChange={e => setObservaciones(e.target.value)} placeholder="Opcional" />
              {fieldErrors.observaciones && <span className="field-error">{fieldErrors.observaciones}</span>}
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Ítems pendientes de recepción</div>
          <div className="table-wrap" style={{ margin: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th className="r">Pedido</th>
                  <th className="r">Ya recibido</th>
                  <th className="r">A recibir ahora</th>
                  <th className="r">Costo unit. ($)</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map(ocItem => {
                  const it = items.find(i => i.item_oc_id === ocItem.id);
                  if (!it) return null;
                  return (
                    <tr key={ocItem.id}>
                      <td>{ocItem.descripcion}</td>
                      <td className="r"><span className="num">{ocItem.cantidad_pedida}</span></td>
                      <td className="r"><span className="num">{ocItem.cantidad_recibida}</span></td>
                      <td className="r">
                        <input className="input" style={{ width: '80px', textAlign: 'right' }}
                          value={it.cantidad_recibida}
                          onChange={e => setCantidadRaw(ocItem.id, e.target.value)}
                          onBlur={() => clampCantidad(ocItem.id)} />
                      </td>
                      <td className="r">
                        <span className="num">$ {fmtARS(ocItem.costo_unitario_centavos)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="alert-danger" role="alert">{error}</div>
        )}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Registrando...' : 'Registrar recepción'}
          </button>
        </div>
      </form>
    </div>
  );
}
