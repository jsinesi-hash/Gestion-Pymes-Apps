import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEscapeAction, bridge, useAuth } from '@core/ui';
import { useCallIpc } from '@core/ui';
import { AltaExpressModal } from '../../productos/AltaExpressModal';

// ADR-085 (SEC-2): "Agregar ítem" y "Editar ítem" llaman a handlers distintos
// (agregarItem / actualizarItem) que comparten nombres de campo (cantidad_pedida,
// costo_unitario_centavos, alicuota_iva). Se prefija el id de control por acción
// (`add_*` / `edit_*`) para no pisar un foco con el otro si ambos formularios
// llegaran a estar abiertos a la vez. `descripcion` y `orden_compra_id` no tienen
// control propio en ninguno de los dos → región general de error.
const CAMPOS_ADD = new Set(['producto_id', 'cantidad_pedida', 'costo_unitario_centavos', 'alicuota_iva']);
const CAMPOS_EDIT = new Set(['cantidad_pedida', 'costo_unitario_centavos', 'alicuota_iva']);

type ItemOC = {
  id: string;
  producto_id: string;
  descripcion: string;
  cantidad_pedida: number;
  cantidad_recibida: number;
  costo_unitario_centavos: number;
  alicuota_iva: number;
  subtotal_centavos: number;
};

type OC = {
  id: string;
  numero_interno: string;
  proveedor_id: string;
  razon_social: string;
  tipo: string;
  estado: string;
  fecha: number;
  subtotal_centavos: number;
  importe_iva_centavos: number;
  total_centavos: number;
  observaciones: string | null;
  items: ItemOC[];
};

type Producto = { id: string; nombre_corto: string; sku: string };

function fmtARS(c: number) {
  return (c / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 });
}
function arsToCentavos(s: string) {
  const n = Number.parseFloat(s.replaceAll('.', '').replace(',', '.'));
  return Number.isNaN(n) ? 0 : Math.round(n * 100);
}
function subtotalConIva(subtotal_centavos: number, alicuota_iva: number) {
  return Math.round(subtotal_centavos * (1 + alicuota_iva / 100));
}

export function OrdenCompraDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const callIpc = useCallIpc();
  const { can } = useAuth();
  // Emitir, anular y editar ítems es de quien gestiona proveedores; recibir, de `compra.recibir`.
  const gestiona = can('proveedor.gestionar');
  const recibe = can('compra.recibir');
  // Escape hace lo mismo que el botón «Volver» de más abajo.
  useEscapeAction(() => navigate(-1), { layer: 'page' });
  const [oc, setOc] = useState<OC | null>(null);
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addForm, setAddForm] = useState({ producto_id: '', descripcion: '', cantidad: '', costo: '', iva: '21' });
  const [editItem, setEditItem] = useState<{ id: string; cantidad: string; costo: string; iva: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAlta, setShowAlta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    if (!id) return;
    bridge().compras.oc.get(id)
      .then((data: OC | null) => setOc(data))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    refresh();
    bridge().catalogo.producto.list({})
      .then((data: { items: Producto[] }) => setProductos(data.items));
  }, [refresh]);

  const borrador = oc?.estado === 'borrador';
  const editable = borrador && gestiona;

  async function handleEmitir() {
    if (!id || !window.confirm('¿Emitir esta orden de compra? No podrá modificar los ítems después.')) return;
    setError(null);
    setSaving(true);
    const r = await callIpc(
      () => bridge().compras.oc.emitir(id),
      { success: 'Orden emitida' },
    );
    setSaving(false);
    if (!r.ok) { setError(r.traducido.mensaje); return; }
    refresh();
  }

  async function handleAnular() {
    if (!id || !window.confirm('¿Anular esta orden de compra?')) return;
    setError(null);
    setSaving(true);
    const r = await callIpc(
      () => bridge().compras.oc.anular(id),
      { success: 'Orden anulada' },
    );
    setSaving(false);
    if (!r.ok) { setError(r.traducido.mensaje); return; }
    refresh();
  }

  async function handleAddItem() {
    if (!id || !addForm.producto_id) return;
    const prod = productos.find(p => p.id === addForm.producto_id);
    setError(null);
    setFieldErrors({});
    setSaving(true);
    const r = await callIpc(
      () => bridge().compras.oc.agregarItem({
        orden_compra_id:         id,
        producto_id:             addForm.producto_id,
        descripcion:             addForm.descripcion || prod?.nombre_corto || '',
        cantidad_pedida:         Number.parseFloat(addForm.cantidad) || 0,
        costo_unitario_centavos: arsToCentavos(addForm.costo),
        alicuota_iva:            Number.parseFloat(addForm.iva) || 21,
      }),
      { success: 'Ítem agregado' },
    );
    setSaving(false);
    if (!r.ok) {
      const campo = r.traducido.campo;
      if (campo && CAMPOS_ADD.has(campo)) {
        const controlId = `add_${campo}`;
        setFieldErrors(prev => ({ ...prev, [controlId]: r.traducido.mensaje }));
        document.getElementById(controlId)?.focus();
      } else {
        setError(r.traducido.mensaje);
      }
      return;
    }
    setAddForm({ producto_id: '', descripcion: '', cantidad: '', costo: '', iva: '21' });
    setShowAddItem(false);
    refresh();
  }

  async function handleSaveEditItem() {
    if (!editItem) return;
    setError(null);
    setFieldErrors({});
    setSaving(true);
    const r = await callIpc(
      () => bridge().compras.oc.actualizarItem({
        item_id:                 editItem.id,
        cantidad_pedida:         Number.parseFloat(editItem.cantidad) || undefined,
        costo_unitario_centavos: arsToCentavos(editItem.costo),
        alicuota_iva:            Number.parseFloat(editItem.iva),
      }),
      { success: 'Ítem actualizado' },
    );
    setSaving(false);
    if (!r.ok) {
      const campo = r.traducido.campo;
      if (campo && CAMPOS_EDIT.has(campo)) {
        const controlId = `edit_${campo}`;
        setFieldErrors(prev => ({ ...prev, [controlId]: r.traducido.mensaje }));
        document.getElementById(controlId)?.focus();
      } else {
        setError(r.traducido.mensaje);
      }
      return;
    }
    setEditItem(null);
    refresh();
  }

  async function handleRemoveItem(itemId: string) {
    if (!window.confirm('¿Eliminar este ítem?')) return;
    await bridge().compras.oc.eliminarItem(itemId);
    refresh();
  }

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;
  if (!oc) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>Orden de compra no encontrada.</div>;

  return (
    <div className="flex-col gap-4">
      <div className="detail-head">
        <button className="back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <h1><span className="num">{oc.numero_interno}</span></h1>
        <div className="detail-actions">
          {editable && (
            <>
              <button className="btn-primary" onClick={handleEmitir} disabled={saving}>Emitir OC</button>
              <button className="btn-secondary" onClick={handleAnular} disabled={saving}>Anular</button>
            </>
          )}
          {(oc.estado === 'emitida' || oc.estado === 'recibida_parcial') && (
            <>
              {recibe && (
                <button className="btn-primary" onClick={() => navigate(`/compras/ordenes/${id}/recibir`)} disabled={saving}>
                  Recibir mercadería
                </button>
              )}
              {gestiona && <button className="btn-secondary" onClick={handleAnular} disabled={saving}>Anular</button>}
            </>
          )}
        </div>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="card-title">Datos de la OC</div>
          <div className="kv"><span className="k">Proveedor</span><span className="v">{oc.razon_social}</span></div>
          <div className="kv"><span className="k">Tipo</span><span className="v">{oc.tipo}</span></div>
          <div className="kv"><span className="k">Estado</span><span className="v">{oc.estado.replaceAll('_', ' ')}</span></div>
          <div className="kv"><span className="k">Fecha</span><span className="v num">{new Date(oc.fecha).toLocaleDateString('es-AR')}</span></div>
          {oc.observaciones && <div className="kv"><span className="k">Observaciones</span><span className="v">{oc.observaciones}</span></div>}
        </div>
        <div className="card">
          <div className="card-title">Totales</div>
          <div className="kv"><span className="k">Subtotal neto</span><span className="v num">$ {fmtARS(oc.subtotal_centavos)}</span></div>
          <div className="kv"><span className="k">IVA</span><span className="v num">$ {fmtARS(oc.importe_iva_centavos)}</span></div>
          <div className="kv"><span className="k">Total</span><span className="v big num">$ {fmtARS(oc.total_centavos)}</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Ítems</span>
          {editable && !showAddItem && (
            <button className="btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}
              onClick={() => setShowAddItem(true)}>+ Agregar ítem</button>
          )}
        </div>

        <div className="table-wrap" style={{ margin: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th className="r">Cantidad</th>
                {!borrador && <th className="r">Cant. recibida</th>}
                <th className="r">Costo unit.</th>
                <th className="c">IVA</th>
                <th className="r">Subtotal c/IVA</th>
                {editable && <th />}
              </tr>
            </thead>
            <tbody>
              {oc.items.length === 0 && (
                <tr>
                  {/* borrador: 5 data cols + actions = 6; !borrador: 5 data cols + cant.recibida = 6 */}
                  <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>
                    Sin ítems
                  </td>
                </tr>
              )}
              {oc.items.map(item => (
                <tr key={item.id}>
                  {editItem?.id === item.id ? (
                    <>
                      <td>{item.descripcion}</td>
                      <td className="r">
                        <input id="edit_cantidad_pedida" className={`input${fieldErrors.edit_cantidad_pedida ? ' error' : ''}`} style={{ width: '80px', textAlign: 'right' }}
                          value={editItem.cantidad}
                          onChange={e => setEditItem(s => s ? { ...s, cantidad: e.target.value } : s)} />
                        {fieldErrors.edit_cantidad_pedida && <span className="field-error">{fieldErrors.edit_cantidad_pedida}</span>}
                      </td>
                      {!borrador && (
                        <td className="r"><span className="num">{item.cantidad_recibida}</span></td>
                      )}
                      <td className="r">
                        <input id="edit_costo_unitario_centavos" className={`input${fieldErrors.edit_costo_unitario_centavos ? ' error' : ''}`} style={{ width: '100px', textAlign: 'right' }}
                          value={editItem.costo}
                          onChange={e => setEditItem(s => s ? { ...s, costo: e.target.value } : s)} />
                        {fieldErrors.edit_costo_unitario_centavos && <span className="field-error">{fieldErrors.edit_costo_unitario_centavos}</span>}
                      </td>
                      <td className="c">
                        <select id="edit_alicuota_iva" className={`input${fieldErrors.edit_alicuota_iva ? ' error' : ''}`} style={{ width: '75px' }}
                          value={editItem.iva}
                          onChange={e => setEditItem(s => s ? { ...s, iva: e.target.value } : s)}>
                          <option value="0">0%</option>
                          <option value="10.5">10.5%</option>
                          <option value="21">21%</option>
                          <option value="27">27%</option>
                        </select>
                        {fieldErrors.edit_alicuota_iva && <span className="field-error">{fieldErrors.edit_alicuota_iva}</span>}
                      </td>
                      <td className="r">
                        <span className="num">$ {fmtARS(subtotalConIva(item.subtotal_centavos, item.alicuota_iva))}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn-primary" style={{ fontSize: '11px', padding: '3px 8px' }}
                            onClick={handleSaveEditItem} disabled={saving}>OK</button>
                          <button className="btn-secondary" style={{ fontSize: '11px', padding: '3px 8px' }}
                            onClick={() => setEditItem(null)}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{item.descripcion}</td>
                      <td className="r"><span className="num">{item.cantidad_pedida}</span></td>
                      {!borrador && (
                        <td className="r"><span className="num">{item.cantidad_recibida}</span></td>
                      )}
                      <td className="r"><span className="num">$ {fmtARS(item.costo_unitario_centavos)}</span></td>
                      <td className="c">{item.alicuota_iva}%</td>
                      <td className="r">
                        <span className="num">$ {fmtARS(subtotalConIva(item.subtotal_centavos, item.alicuota_iva))}</span>
                      </td>
                      {editable && (
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn-secondary" style={{ fontSize: '11px', padding: '3px 8px' }}
                              onClick={() => setEditItem({
                                id: item.id,
                                cantidad: String(item.cantidad_pedida),
                                costo: fmtARS(item.costo_unitario_centavos),
                                iva: String(item.alicuota_iva),
                              })}>
                              Editar
                            </button>
                            <button className="btn-danger" style={{ fontSize: '11px', padding: '3px 8px' }}
                              onClick={() => handleRemoveItem(item.id)}>
                              Quitar
                            </button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showAddItem && (
          <div style={{ padding: '12px var(--pad)', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', opacity: 0.6 }}>Producto</span>
              <select id="add_producto_id" className={`input${fieldErrors.add_producto_id ? ' error' : ''}`} style={{ width: '220px' }} value={addForm.producto_id}
                onChange={e => {
                  const prod = productos.find(p => p.id === e.target.value);
                  setAddForm(f => ({ ...f, producto_id: e.target.value, descripcion: prod?.nombre_corto ?? '' }));
                }}>
                <option value="">— Seleccioná —</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre_corto}</option>)}
              </select>
              {fieldErrors.add_producto_id && <span className="field-error">{fieldErrors.add_producto_id}</span>}
            </label>
            <button type="button" className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={() => setShowAlta(true)}>
              Nuevo producto
            </button>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', opacity: 0.6 }}>Cantidad</span>
              <input id="add_cantidad_pedida" className={`input${fieldErrors.add_cantidad_pedida ? ' error' : ''}`} style={{ width: '80px' }} value={addForm.cantidad}
                placeholder="0" onChange={e => setAddForm(f => ({ ...f, cantidad: e.target.value }))} />
              {fieldErrors.add_cantidad_pedida && <span className="field-error">{fieldErrors.add_cantidad_pedida}</span>}
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', opacity: 0.6 }}>Costo ($)</span>
              <input id="add_costo_unitario_centavos" className={`input${fieldErrors.add_costo_unitario_centavos ? ' error' : ''}`} style={{ width: '100px' }} value={addForm.costo}
                placeholder="0.00" onChange={e => setAddForm(f => ({ ...f, costo: e.target.value }))} />
              {fieldErrors.add_costo_unitario_centavos && <span className="field-error">{fieldErrors.add_costo_unitario_centavos}</span>}
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', opacity: 0.6 }}>IVA %</span>
              <select id="add_alicuota_iva" className={`input${fieldErrors.add_alicuota_iva ? ' error' : ''}`} style={{ width: '80px' }} value={addForm.iva}
                onChange={e => setAddForm(f => ({ ...f, iva: e.target.value }))}>
                <option value="0">0%</option>
                <option value="10.5">10.5%</option>
                <option value="21">21%</option>
                <option value="27">27%</option>
              </select>
              {fieldErrors.add_alicuota_iva && <span className="field-error">{fieldErrors.add_alicuota_iva}</span>}
            </label>
            <button className="btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={handleAddItem} disabled={saving || !addForm.producto_id}>
              Agregar
            </button>
            <button className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={() => setShowAddItem(false)}>
              Cancelar
            </button>
          </div>
        )}

        {error && (
          <div className="alert-danger" role="alert" style={{ margin: 'var(--pad, 16px)' }}>{error}</div>
        )}
      </div>

      {showAlta && (
        <AltaExpressModal
          onClose={() => setShowAlta(false)}
          onCreado={(p) => {
            setShowAlta(false);
            setProductos(prev => [{ id: p.id, nombre_corto: p.nombre_corto, sku: p.sku }, ...prev]);
            setAddForm(f => ({ ...f, producto_id: p.id, descripcion: p.nombre_corto }));
          }}
        />
      )}
    </div>
  );
}
