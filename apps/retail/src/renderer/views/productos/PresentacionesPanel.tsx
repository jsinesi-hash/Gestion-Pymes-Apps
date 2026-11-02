import { useState, useEffect } from 'react';
import { bridge, Modal } from '@core/ui';
import { useCallIpc } from '@core/ui';

type Presentacion = {
  id: string;
  unidad_abreviatura: string;
  unidad_nombre: string;
  factor_a_stock: number;
  gtin_barcode: string | null;
  es_default: boolean;
  activo: boolean;
  sin_confirmar: boolean;
};

type Unidad = { id: string; nombre: string; abreviatura: string };

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; presentacion: Presentacion }
  | null;

const f = () => bridge();

// ADR-085 (SEC-2): campos del form de alta/edición que pueden recibir un error de
// validación del backend y tienen un control focoable propio.
const CAMPOS_ERROR = new Set(['unidad_id', 'factor_a_stock', 'gtin_barcode']);

export function PresentacionesPanel({ productoId }: Readonly<{ productoId: string }>) {
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [formUnidadId, setFormUnidadId] = useState('');
  const [formFactor, setFormFactor] = useState(1);
  const [formGtin, setFormGtin] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const callIpc = useCallIpc();

  async function load() {
    const [pps, uns] = await Promise.all([
      (f().presentacion?.listByProducto?.({ producto_id: productoId }) ?? Promise.resolve([])).catch(() => []),
      (f().unidad?.list?.() ?? Promise.resolve([])).catch(() => []),
    ]);
    setPresentaciones(pps);
    setUnidades(uns);
  }

  useEffect(() => { load(); }, [productoId]);

  function openCreate() {
    setFormUnidadId(unidades[0]?.id ?? '');
    setFormFactor(1);
    setFormGtin('');
    setErrors({});
    setModal({ mode: 'create' });
  }

  function openEdit(pp: Presentacion) {
    const unidad = unidades.find(u => u.abreviatura === pp.unidad_abreviatura);
    setFormUnidadId(unidad?.id ?? '');
    setFormFactor(pp.factor_a_stock);
    setFormGtin(pp.gtin_barcode ?? '');
    setErrors({});
    setModal({ mode: 'edit', presentacion: pp });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = {
      unidad_id: formUnidadId,
      factor_a_stock: formFactor,
      gtin_barcode: formGtin.trim() || null,
    };
    // ERR-1/SEC-2 (ADR-085): callIpc traduce y muestra el error por toast; si el backend
    // rechaza un campo de validación, lo enrutamos al control focoable correspondiente.
    const r = modal?.mode === 'create'
      ? await callIpc(
          () => f().presentacion?.create({ producto_id: productoId, ...payload }),
          { success: 'Presentación guardada' },
        )
      : await callIpc(
          () => f().presentacion?.update({ id: modal!.presentacion.id, ...payload, sin_confirmar: false }),
          { success: 'Presentación guardada' },
        );
    setSaving(false);
    if (!r.ok) {
      const campo = r.traducido.campo;
      if (campo && CAMPOS_ERROR.has(campo)) {
        setErrors(prev => ({ ...prev, [campo]: r.traducido.mensaje }));
        document.getElementById(campo)?.focus();
      }
      return;
    }
    setModal(null);
    await load();
  }

  async function handleSetDefault(pp: Presentacion) {
    const r = await callIpc(
      () => f().presentacion?.setDefault?.({ id: pp.id }),
      { success: 'Presentación marcada como predeterminada' },
    );
    if (!r.ok) return;
    await load();
  }

  async function handleDesactivar(pp: Presentacion) {
    const r = await callIpc(
      () => f().presentacion?.desactivar({ id: pp.id }),
      { success: 'Presentación dada de baja' },
    );
    if (!r.ok) return;
    await load();
  }

  async function handleReactivar(pp: Presentacion) {
    const r = await callIpc(
      () => f().presentacion?.reactivar?.({ id: pp.id }),
      { success: 'Presentación reactivada' },
    );
    if (!r.ok) return;
    await load();
  }

  async function handleEliminar(pp: Presentacion) {
    if (!window.confirm('¿Eliminar esta presentación? Si tiene historial se dará de baja en vez de borrarse.')) return;
    setAviso(null);
    // No se pasa `success` fijo: el mensaje depende de si se borró físicamente o se dio de
    // baja por tener historial (ver `res.eliminada` abajo), así que se avisa a mano.
    const r = await callIpc(() => f().presentacion?.eliminar?.({ id: pp.id }));
    if (!r.ok) return;
    if (r.data && (r.data as { eliminada: boolean }).eliminada === false) {
      setAviso('La presentación tiene historial: se dio de baja en vez de eliminarse');
    }
    await load();
  }

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Presentaciones</span>
        <button className="btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={openCreate}>
          + Agregar
        </button>
      </div>
      {aviso && (
        <div className="alert-error" style={{ margin: '4px var(--pad)' }}>
          {aviso}
          <button onClick={() => setAviso(null)} style={{ marginLeft: 8, border: 'none', background: 'none', cursor: 'pointer' }}>
            &#x2715;
          </button>
        </div>
      )}
      <div className="table-wrap" style={{ margin: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Factor</th>
              <th>GTIN</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {presentaciones.map(pp => (
              <tr key={pp.id}>
                <td>
                  <code>{pp.unidad_abreviatura}</code>
                  <span className="text-muted text-xs" style={{ marginLeft: 4 }}>{pp.unidad_nombre}</span>
                </td>
                <td className="num">{pp.factor_a_stock !== 1.0 ? `×${pp.factor_a_stock}` : '1'}</td>
                <td><code className="text-xs">{pp.gtin_barcode ?? '—'}</code></td>
                <td>
                  <span className={`badge ${pp.activo ? 'ok' : 'off'}`}>
                    <span className="bd" />{pp.es_default ? 'Default' : pp.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  {pp.sin_confirmar && (
                    <span className="badge warn" style={{ marginLeft: 4 }}>
                      <span className="bd" />Sin confirmar
                    </span>
                  )}
                </td>
                <td>
                  <div className="row-act">
                    <button className="ia" onClick={() => openEdit(pp)} aria-label="Editar">&#x270e;</button>
                    {!pp.es_default && pp.activo && (
                      <button className="ia" onClick={() => handleSetDefault(pp)} aria-label="Establecer como predeterminada" title="Establecer como predeterminada">&#x2605;</button>
                    )}
                    {!pp.es_default && pp.activo && (
                      <button className="ia" onClick={() => handleDesactivar(pp)} aria-label="Desactivar" title="Desactivar">&#x23f8;</button>
                    )}
                    {!pp.es_default && !pp.activo && (
                      <button className="ia" onClick={() => handleReactivar(pp)} aria-label="Reactivar" title="Reactivar">&#x21ba;</button>
                    )}
                    {!pp.es_default && (
                      <button className="ia del" onClick={() => handleEliminar(pp)} aria-label="Eliminar" title="Eliminar">&#x1f5d1;</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal ariaLabel={modal.mode === 'create' ? 'Nueva presentación' : 'Editar presentación'} onClose={() => setModal(null)} cerrarAlClickFuera style={{ maxWidth: 400 }}>
          <div className="modal-header">
            <h2>{modal.mode === 'create' ? 'Nueva presentación' : 'Editar presentación'}</h2>
            <button className="ia" aria-label="Cerrar" onClick={() => setModal(null)}>&#x2715;</button>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label>
              <div className="label-txt">Unidad</div>
              <select
                id="unidad_id"
                className={`input${errors.unidad_id ? ' error' : ''}`}
                value={formUnidadId}
                onChange={e => { setFormUnidadId(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.unidad_id; return n; }); }}
                required
              >
                <option value="">— seleccionar —</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre} ({u.abreviatura})</option>
                ))}
              </select>
              {errors.unidad_id && <span className="field-error">{errors.unidad_id}</span>}
            </label>
            <label>
              <div className="label-txt">Factor a stock</div>
              <input
                id="factor_a_stock"
                type="number"
                className={`input num${errors.factor_a_stock ? ' error' : ''}`}
                value={formFactor}
                min={0.001}
                step={0.001}
                onChange={e => { setFormFactor(Number(e.target.value)); setErrors(prev => { const n = { ...prev }; delete n.factor_a_stock; return n; }); }}
                required
              />
              <div className="text-muted text-xs" style={{ marginTop: 2 }}>
                1 unidad de presentación = {formFactor} en stock
              </div>
              {errors.factor_a_stock && <span className="field-error">{errors.factor_a_stock}</span>}
            </label>
            <label>
              <div className="label-txt">GTIN / EAN (opcional)</div>
              <input
                id="gtin_barcode"
                type="text"
                className={`input${errors.gtin_barcode ? ' error' : ''}`}
                value={formGtin}
                onChange={e => { setFormGtin(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.gtin_barcode; return n; }); }}
                placeholder="Dejar vacío si no aplica"
              />
              {errors.gtin_barcode && <span className="field-error">{errors.gtin_barcode}</span>}
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
