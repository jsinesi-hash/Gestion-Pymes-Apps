import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { traducirError } from '../../lib/errores';

type Creds = { nombre_usuario: string; password: string };

type Props = {
  onConfirm: (creds: Creds) => Promise<void>;
  onCancel: () => void;
};

export function SupervisorAuthModal({ onConfirm, onCancel }: Readonly<Props>) {
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onConfirm({ nombre_usuario: nombreUsuario, password });
    } catch (err) {
      // Electron envuelve el rechazo de invoke ("Error invoking remote method '…': Error:
      // SUPERVISOR_INVALIDO"), así que se busca el código por inclusión, no por igualdad.
      // Cualquier otro error se traduce con el catálogo común (nunca la cadena técnica cruda).
      const msg = err instanceof Error ? err.message : String(err ?? '');
      setError(msg.includes('SUPERVISOR_INVALIDO')
        ? 'Usuario o contraseña incorrectos, o no es Supervisor.'
        : traducirError(err).mensaje);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal titulo="Autorización del Supervisor" onClose={onCancel} bloqueado={loading} ocultarCerrar as="form" onSubmit={handleSubmit}>
      <div className="modal-body">
        <p className="text-muted text-sm">Ingresá usuario y contraseña de un Supervisor para autorizar.</p>
        <div className="field">
          <label htmlFor="sup-usuario">Usuario</label>
          <input id="sup-usuario" aria-label="Usuario Supervisor"
            className="input" type="text"
            value={nombreUsuario} onChange={e => setNombreUsuario(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="sup-password">Contraseña</label>
          <input id="sup-password" aria-label="Contraseña Supervisor"
            className="input" type="password"
            value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div className="alert-danger" role="alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary"
          disabled={!nombreUsuario || !password || loading}>
          {loading ? 'Verificando…' : 'Autorizar'}
        </button>
      </div>
    </Modal>
  );
}
