import { useState } from 'react';
import { useAuth, useToast, SupervisorAuthModal, Modal } from '@core/ui';
import { useProduccion, type ProduccionRow } from '../../hooks/useProduccion';
import { useArticulos } from '../../hooks/useArticulos';

export function ProduccionView() {
  const { can } = useAuth();
  const { producciones, loading, crear, anular } = useProduccion();
  const { articulos } = useArticulos();
  const [modalNueva, setModalNueva] = useState(false);
  const [anulando, setAnulando] = useState<ProduccionRow | null>(null);

  const elaborados = articulos.filter((a) => a.tipo === 'elaborado');

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <div className="ml-auto" />
        {can('produccion.registrar') && (
          <button className="btn-primary" onClick={() => setModalNueva(true)}>+ Nueva producción</button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Número</th><th>Cantidad</th><th className="c">Costo total</th><th className="c">Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {producciones.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin producciones</td></tr>
            )}
            {producciones.map((p) => (
              <tr key={p.id}>
                <td>{p.numero}</td>
                <td>{p.cantidad_producida}</td>
                <td className="c">${(p.costo_total_centavos / 100).toFixed(2)}</td>
                <td className="c">
                  <span className={`badge ${p.estado === 'confirmada' ? 'ok' : 'off'}`}>
                    <span className="bd" />{p.estado === 'confirmada' ? 'Confirmada' : 'Anulada'}
                  </span>
                </td>
                <td>
                  {p.estado === 'confirmada' && can('produccion.registrar') && (
                    <button className="btn-secondary btn-sm" onClick={() => setAnulando(p)}>Anular</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalNueva && (
        <NuevaProduccionModal
          elaborados={elaborados}
          onClose={() => setModalNueva(false)}
          onCrear={crear}
        />
      )}
      {anulando && (
        <AnularProduccionModal
          produccion={anulando}
          onClose={() => setAnulando(null)}
          onAnular={anular}
        />
      )}
    </div>
  );
}

function NuevaProduccionModal({ elaborados, onClose, onCrear }: {
  elaborados: { id: string; nombre: string }[];
  onClose: () => void;
  onCrear: (payload: { articulo_id: string; cantidad_producida: number; observaciones?: string }) => Promise<void>;
}) {
  const toast = useToast();
  const [articuloId, setArticuloId] = useState(elaborados[0]?.id ?? '');
  const [cantidad, setCantidad] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cant = Number(cantidad);
    if (!articuloId || !cant || cant <= 0) return;
    setSaving(true); setError(null);
    try {
      const obs = observaciones.trim();
      await onCrear({ articulo_id: articuloId, cantidad_producida: cant, ...(obs ? { observaciones: obs } : {}) });
      toast.success('Producción confirmada');
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error';
      if (msg.startsWith('RECETA_NO_DEFINIDA')) {
        setError('Este artículo no tiene receta definida');
      } else if (msg.startsWith('STOCK_INSUFICIENTE')) {
        const nombre = msg.split(':')[1];
        setError(nombre ? `Stock insuficiente de: ${nombre}` : 'Stock insuficiente de un insumo');
      } else if (msg === 'NOT_FOUND') {
        setError('El artículo ya no existe');
      } else {
        setError(msg);
      }
    } finally { setSaving(false); }
  }

  return (
    <Modal ariaLabel="Nueva producción" onClose={onClose} bloqueado={saving} as="form" onSubmit={handleSubmit}>
      <div className="modal-header"><span className="modal-title">Nueva producción</span></div>
      <div className="modal-body">
        <div className="field">
          <label htmlFor="produccion-articulo">Sabor / elaborado *</label>
          <select id="produccion-articulo" className="input" value={articuloId} onChange={(e) => setArticuloId(e.target.value)}>
            {elaborados.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="produccion-cantidad">Cantidad producida (kg) *</label>
          <input id="produccion-cantidad" className="input" type="number" step="any" min="0.001" required
            value={cantidad} onChange={(e) => setCantidad(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="produccion-obs">Observaciones</label>
          <input id="produccion-obs" className="input" type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>
        {error && <div className="alert-danger" role="alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={!articuloId || !cantidad || saving}>
          {saving ? 'Confirmando…' : 'Confirmar producción'}
        </button>
      </div>
    </Modal>
  );
}

function AnularProduccionModal({ produccion, onClose, onAnular }: {
  produccion: ProduccionRow;
  onClose: () => void;
  onAnular: (payload: { id: string; motivo: string; supervisor_credenciales: { nombre_usuario: string; password: string } }) => Promise<void>;
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
    await onAnular({
      id: produccion.id,
      motivo: motivo.trim(),
      supervisor_credenciales: { nombre_usuario, password },
    });
    toast.success('Producción anulada');
    onClose();
  }

  if (step === 'auth') {
    return <SupervisorAuthModal onConfirm={handleAuthConfirm} onCancel={() => setStep('motivo')} />;
  }

  return (
    <Modal ariaLabel={`Anular producción ${produccion.numero}`} onClose={onClose} bloqueado={step !== 'motivo'} as="form" onSubmit={handleContinuar}>
      <div className="modal-header"><span className="modal-title">Anular producción {produccion.numero}</span></div>
      <div className="modal-body">
        <div className="field">
          <label htmlFor="anular-motivo">Motivo *</label>
          <input id="anular-motivo" className="input" type="text" required value={motivo}
            onChange={(e) => { setMotivo(e.target.value); setError(null); }} autoFocus />
        </div>
        <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>Requiere autorización de un Supervisor.</p>
        {error && <div className="alert-danger" role="alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary">Continuar</button>
      </div>
    </Modal>
  );
}
