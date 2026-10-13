import { useState } from 'react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { SupervisorAuthModal } from '../caja/SupervisorAuthModal';
import { bridge } from '../../bridge';

type Props = {
  ventaId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

type Step = 'motivo' | 'auth';

export function AnulacionModal({ ventaId, onSuccess, onCancel }: Readonly<Props>) {
  const [motivo, setMotivo] = useState('');
  const [step, setStep] = useState<Step>('motivo');
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onCancel, step === 'motivo');

  function handleContinuar() {
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return; }
    setError(null);
    setStep('auth');
  }

  async function handleAuthConfirm({ nombre_usuario, password }: { nombre_usuario: string; password: string }) {
    await (bridge() as any).venta.anular({
      venta_id: ventaId,
      motivo: motivo.trim(),
      supervisor_credenciales: { nombre_usuario, password },
    });
    onSuccess();
  }

  if (step === 'auth') {
    return <SupervisorAuthModal onConfirm={handleAuthConfirm} onCancel={() => setStep('motivo')} />;
  }

  return (
    <div className="modal-overlay" role="dialog"> {/* NOSONAR */}
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Anular venta</span>
        </div>
        <div className="modal-body">
          <p className="text-muted text-sm">Esta acción es irreversible. Se revertirán stock y caja.</p>
          <div className="field">
            <label htmlFor="anulacion-motivo">Motivo</label>
            <input id="anulacion-motivo" className="input" type="text" placeholder="Motivo de anulación"
              value={motivo} onChange={e => { setMotivo(e.target.value); setError(null); }} autoFocus />
          </div>
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn-danger" onClick={handleContinuar}>Continuar</button>
        </div>
      </div>
    </div>
  );
}
