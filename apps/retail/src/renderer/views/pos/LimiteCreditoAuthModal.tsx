import { useState } from 'react';
import { useEscapeToClose } from '@core/ui';

type Props = {
  onAutorizar: (creds: { nombre_usuario: string; password: string }) => Promise<void>;
  onCancelar: () => void;
};

export function LimiteCreditoAuthModal({ onAutorizar, onCancelar }: Readonly<Props>) {
  const [supUsuario, setSupUsuario] = useState('');
  const [supPassword, setSupPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onCancelar, !loading);

  async function handleConfirmar() {
    if (!supUsuario.trim() || !supPassword.trim()) {
      setError('Credenciales del Supervisor requeridas');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onAutorizar({ nombre_usuario: supUsuario, password: supPassword });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error';
      setError(msg === 'SUPERVISOR_INVALIDO' ? 'Usuario o contraseña de Supervisor incorrectos' : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Límite de crédito excedido</span>
        </div>
        <div className="modal-body">
          <p className="text-muted text-sm">
            El monto a cuenta corriente supera el límite del cliente. Se requiere autorización del Supervisor.
          </p>
          <div className="field">
            <label htmlFor="lc-sup-usuario">Usuario Supervisor</label>
            <input
              id="lc-sup-usuario"
              className="input"
              type="text"
              value={supUsuario}
              onChange={e => setSupUsuario(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="lc-sup-password">Contraseña Supervisor</label>
            <input
              id="lc-sup-password"
              className="input"
              type="password"
              value={supPassword}
              onChange={e => setSupPassword(e.target.value)}
            />
          </div>
          {error && <div className="alert-danger" role="alert">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onCancelar} disabled={loading}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Autorizando…' : 'Autorizar y confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
