import { useState } from 'react';
import { useAuth, useToast, SupervisorAuthModal, traducirError, Modal } from '@core/ui';
import {
  useCompras, type CompraRow, type ProveedorRow, type CompraCrearPayload, type AnularCompraPayload,
} from '../../hooks/useCompras';
import { useArticulos, type ArticuloRow } from '../../hooks/useArticulos';

const pesos = (centavos: number) => `$${(centavos / 100).toFixed(2)}`;

export function ComprasView() {
  const { can } = useAuth();
  const { compras, proveedores, loading, crear, anular, crearProveedorRapido } = useCompras();
  const { articulos } = useArticulos();
  const [modalNueva, setModalNueva] = useState(false);
  const [anulando, setAnulando] = useState<CompraRow | null>(null);

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <div className="ml-auto" />
        {can('compra.registrar') && (
          <button className="btn-primary" onClick={() => setModalNueva(true)}>+ Nueva compra</button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Número</th><th>Proveedor</th><th>Comprobante</th>
              <th className="c">Total</th><th className="c">Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {compras.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin compras</td></tr>
            )}
            {compras.map((c) => (
              <tr key={c.id}>
                <td>{c.numero}</td>
                <td>{c.proveedor_nombre ?? '—'}</td>
                <td>{c.comprobante ?? '—'}</td>
                <td className="c">{pesos(c.total_centavos)}</td>
                <td className="c">
                  <span className={`badge ${c.estado === 'confirmada' ? 'ok' : 'off'}`}>
                    <span className="bd" />{c.estado === 'confirmada' ? 'Confirmada' : 'Anulada'}
                  </span>
                </td>
                <td>
                  {c.estado === 'confirmada' && can('compra.registrar') && (
                    <button className="btn-secondary btn-sm" onClick={() => setAnulando(c)}>Anular</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalNueva && (
        <NuevaCompraModal
          articulos={articulos.filter((a) => a.activo)}
          proveedores={proveedores}
          onClose={() => setModalNueva(false)}
          onCrear={crear}
          onCrearProveedor={crearProveedorRapido}
        />
      )}
      {anulando && (
        <AnularCompraModal compra={anulando} onClose={() => setAnulando(null)} onAnular={anular} />
      )}
    </div>
  );
}

type Fila = { articulo_id: string; cantidad: string; costo: string };

function NuevaCompraModal({ articulos, proveedores, onClose, onCrear, onCrearProveedor }: {
  articulos: ArticuloRow[];
  proveedores: ProveedorRow[];
  onClose: () => void;
  onCrear: (payload: CompraCrearPayload) => Promise<void>;
  onCrearProveedor: (razon_social: string) => Promise<ProveedorRow>;
}) {
  const toast = useToast();
  const [proveedorId, setProveedorId] = useState('');
  const [nuevoProveedor, setNuevoProveedor] = useState<string | null>(null);
  const [comprobante, setComprobante] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [filas, setFilas] = useState<Fila[]>([{ articulo_id: articulos[0]?.id ?? '', cantidad: '', costo: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setFila = (i: number, patch: Partial<Fila>) =>
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  const items = filas.map((f) => ({
    articulo_id: f.articulo_id,
    cantidad: Number(f.cantidad),
    costo_unitario_centavos: Math.round(Number(f.costo) * 100),
  }));
  const filaValida = (it: (typeof items)[number], f: Fila) =>
    !!it.articulo_id && it.cantidad > 0 && f.costo !== '' && Number.isFinite(it.costo_unitario_centavos) && it.costo_unitario_centavos >= 0;
  const valido = filas.length > 0 && items.every((it, i) => filaValida(it, filas[i]!));
  const total = items.reduce((acc, it) => acc + (Number.isFinite(it.cantidad * it.costo_unitario_centavos) ? Math.round(it.cantidad * it.costo_unitario_centavos) : 0), 0);

  async function handleGuardarProveedor() {
    const nombre = (nuevoProveedor ?? '').trim();
    if (!nombre) return;
    setError(null);
    try {
      const p = await onCrearProveedor(nombre);
      setProveedorId(p.id);
      setNuevoProveedor(null);
    } catch (e) {
      setError(traducirError(e).mensaje);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    setSaving(true); setError(null);
    try {
      const comp = comprobante.trim();
      const obs = observaciones.trim();
      await onCrear({
        ...(proveedorId ? { proveedor_id: proveedorId } : {}),
        ...(comp ? { comprobante: comp } : {}),
        ...(obs ? { observaciones: obs } : {}),
        items,
      });
      toast.success('Compra registrada');
      onClose();
    } catch (e) {
      setError(traducirError(e).mensaje);
    } finally { setSaving(false); }
  }

  return (
    <Modal ariaLabel="Nueva compra" onClose={onClose} bloqueado={saving} as="form" onSubmit={handleSubmit}>
      <div className="modal-header"><span className="modal-title">Nueva compra</span></div>
      <div className="modal-body">
        <div className="field">
          <label htmlFor="compra-proveedor">Proveedor</label>
          {nuevoProveedor === null ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select id="compra-proveedor" className="input" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                <option value="">(Sin proveedor)</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
              </select>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setNuevoProveedor('')}>Nuevo proveedor</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input id="compra-proveedor-nuevo" aria-label="Razón social del proveedor" className="input" type="text"
                placeholder="Razón social" value={nuevoProveedor} onChange={(e) => setNuevoProveedor(e.target.value)} autoFocus />
              <button type="button" className="btn-primary btn-sm" disabled={!nuevoProveedor.trim()} onClick={handleGuardarProveedor}>Guardar proveedor</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setNuevoProveedor(null)}>Cancelar</button>
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="compra-comprobante">Comprobante del proveedor</label>
          <input id="compra-comprobante" className="input" type="text" maxLength={60}
            value={comprobante} onChange={(e) => setComprobante(e.target.value)} />
        </div>

        {filas.map((f, i) => (
          <div key={i} className="field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 2 }}>
              <label htmlFor={`compra-art-${i}`}>Artículo *</label>
              <select id={`compra-art-${i}`} className="input" value={f.articulo_id} onChange={(e) => setFila(i, { articulo_id: e.target.value })}>
                {articulos.map((a) => <option key={a.id} value={a.id}>{a.nombre} ({a.unidad})</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor={`compra-cant-${i}`}>Cantidad *</label>
              <input id={`compra-cant-${i}`} className="input" type="number" step="any" min="0.001"
                value={f.cantidad} onChange={(e) => setFila(i, { cantidad: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor={`compra-costo-${i}`}>Costo unitario ($) *</label>
              <input id={`compra-costo-${i}`} className="input" type="number" step="0.01" min="0"
                value={f.costo} onChange={(e) => setFila(i, { costo: e.target.value })} />
            </div>
            <button type="button" className="btn-secondary btn-sm" aria-label={`Quitar ítem ${i + 1}`}
              disabled={filas.length === 1} onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button type="button" className="btn-secondary btn-sm" disabled={articulos.length === 0}
          onClick={() => setFilas((fs) => [...fs, { articulo_id: articulos[0]?.id ?? '', cantidad: '', costo: '' }])}>
          + Agregar ítem
        </button>

        <div className="field">
          <label htmlFor="compra-obs">Observaciones</label>
          <input id="compra-obs" className="input" type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>
        <p style={{ fontWeight: 600 }}>Total: {pesos(total)}</p>
        {error && <div className="alert-danger" role="alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={!valido || saving}>
          {saving ? 'Registrando…' : 'Registrar compra'}
        </button>
      </div>
    </Modal>
  );
}

function AnularCompraModal({ compra, onClose, onAnular }: {
  compra: CompraRow;
  onClose: () => void;
  onAnular: (payload: AnularCompraPayload) => Promise<void>;
}) {
  const toast = useToast();
  const [motivo, setMotivo] = useState('');
  const [step, setStep] = useState<'motivo' | 'auth'>('motivo');
  const [error, setError] = useState<string | null>(null);

  function handleContinuar(e: React.FormEvent) {
    e.preventDefault();
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return; }
    setError(null);
    setStep('auth');
  }

  async function handleAuthConfirm({ nombre_usuario, password }: { nombre_usuario: string; password: string }) {
    await onAnular({ id: compra.id, motivo: motivo.trim(), supervisor_credenciales: { nombre_usuario, password } });
    toast.success('Compra anulada');
    onClose();
  }

  if (step === 'auth') {
    return <SupervisorAuthModal onConfirm={handleAuthConfirm} onCancel={() => setStep('motivo')} />;
  }

  return (
    <Modal ariaLabel={`Anular compra ${compra.numero}`} onClose={onClose} bloqueado={step !== 'motivo'} as="form" onSubmit={handleContinuar}>
      <div className="modal-header"><span className="modal-title">Anular compra {compra.numero}</span></div>
      <div className="modal-body">
        <div className="field">
          <label htmlFor="anular-compra-motivo">Motivo *</label>
          <input id="anular-compra-motivo" className="input" type="text" required value={motivo}
            onChange={(e) => { setMotivo(e.target.value); setError(null); }} autoFocus />
        </div>
        <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>
          Revierte el stock ingresado. Requiere autorización de un Supervisor.
        </p>
        {error && <div className="alert-danger" role="alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary">Continuar</button>
      </div>
    </Modal>
  );
}
