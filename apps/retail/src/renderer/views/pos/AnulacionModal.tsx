import { useState } from 'react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

type Props = {
  ventaId: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export function AnulacionModal({ ventaId, onSuccess, onCancel }: Readonly<Props>) {
  const [motivo, setMotivo] = useState('');
  const [supUsuario, setSupUsuario] = useState('');
  const [supPassword, setSupPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onCancel, !loading);

  async function handleConfirmar() {
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return; }
    if (!supUsuario.trim() || !supPassword.trim()) { setError('Credenciales del Supervisor requeridas'); return; }
    setLoading(true);
    setError(null);
    try {
      await (globalThis as any).ferreteria.venta.anular({
        venta_id: ventaId,
        motivo: motivo.trim(),
        supervisor_credenciales: { nombre_usuario: supUsuario, password: supPassword },
      });
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error';
      if (msg === 'MOTIVO_REQUERIDO') { setError('El motivo es obligatorio'); return; }
      if (msg === 'SUPERVISOR_INVALIDO') { setError('Usuario o contraseña de Supervisor incorrectos'); return; }
      setError(msg);
    } finally {
      setLoading(false);
    }
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
              value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="anulacion-sup-usuario">Usuario Supervisor</label>
            <input id="anulacion-sup-usuario" aria-label="Usuario Supervisor"
              className="input" type="text"
              value={supUsuario} onChange={e => setSupUsuario(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="anulacion-sup-password">Contraseña Supervisor</label>
            <input id="anulacion-sup-password" aria-label="Contraseña Supervisor"
              className="input" type="password"
              value={supPassword} onChange={e => setSupPassword(e.target.value)} />
          </div>
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button type="button" className="btn-danger" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Anulando…' : 'Anular venta'}
          </button>
        </div>
      </div>
    </div>
  );
}
