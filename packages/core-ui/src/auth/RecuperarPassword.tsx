import { useState } from 'react';
import { motivosPasswordDebil, mensajePasswordDebil } from '@ferreteria/shared';
import { bridge } from '../bridge';
import { Modal } from '../components/Modal';
import { PasswordInput } from '../components/PasswordInput';
import { traducirError } from '../lib/errores';

// ADR-137: recuperación de contraseña por mail, en dos pasos. Primero se pide el código para el
// usuario; la respuesta es siempre la misma (no revela qué usuarios existen ni cuáles tienen mail).
// Después se ingresa el código de 6 dígitos con la contraseña nueva. No abre sesión: al terminar se
// vuelve al inicio de sesión.
type Paso = 'pedir' | 'codigo' | 'listo';

export default function RecuperarPassword({ nombreUsuarioInicial = '', onClose }: Readonly<{
  nombreUsuarioInicial?: string;
  onClose: () => void;
}>) {
  const [paso, setPaso] = useState<Paso>('pedir');
  const [identificador, setIdentificador] = useState(nombreUsuarioInicial);
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handlePedir(e: React.FormEvent) {
    e.preventDefault();
    if (!identificador.trim()) { setError('Ingresá tu usuario.'); return; }
    setEnviando(true);
    setError('');
    try {
      await bridge().auth.recuperarSolicitar({ identificador: identificador.trim() });
      setPaso('codigo');
    } catch (err) {
      setError(traducirError(err).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  async function handleConfirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(codigo.trim())) { setError('Ingresá el código de 6 dígitos.'); return; }
    if (nueva !== repetir) { setError('Las contraseñas no coinciden.'); return; }
    const [motivo] = motivosPasswordDebil(nueva, identificador.trim());
    if (motivo) { setError(mensajePasswordDebil(motivo)); return; }
    setEnviando(true);
    setError('');
    try {
      await bridge().auth.recuperarConfirmar({
        identificador: identificador.trim(), codigo: codigo.trim(), passwordNueva: nueva,
      });
      setPaso('listo');
    } catch (err) {
      setError(traducirError(err).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  function pedirOtroCodigo() {
    setPaso('pedir');
    setCodigo(''); setNueva(''); setRepetir('');
    setError('');
  }

  return (
    <Modal titulo="Recuperar contraseña" ancho={420} onClose={onClose} bloqueado={enviando}>
      {paso === 'pedir' && (
        <form onSubmit={handlePedir} noValidate>
          <div className="modal-body">
            <p className="text-sm text-muted">
              Te enviamos un código al correo electrónico que tiene cargado tu usuario.
            </p>
            <div className="field">
              <label htmlFor="rp-usuario">Usuario</label>
              <input id="rp-usuario" className="input" value={identificador} autoFocus
                onChange={e => setIdentificador(e.target.value)} />
            </div>
            {error && <div className="alert-danger" role="alert">{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={enviando}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar código'}
            </button>
          </div>
        </form>
      )}

      {paso === 'codigo' && (
        <form onSubmit={handleConfirmar} noValidate>
          <div className="modal-body">
            <div className="alert-info" role="status">
              Si el usuario existe y tiene un correo cargado, te enviamos un código. Puede tardar unos minutos y
              vence a los 15 minutos. Si no te llega, pedile a un Supervisor que restablezca tu contraseña.
            </div>
            <div className="field">
              <label htmlFor="rp-codigo">Código de 6 dígitos</label>
              <input id="rp-codigo" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={codigo} onChange={e => setCodigo(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="rp-nueva">Nueva contraseña</label>
              <PasswordInput id="rp-nueva" placeholder="Nueva contraseña" autoComplete="new-password"
                value={nueva} onChange={e => setNueva(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rp-repetir">Repetir la nueva contraseña</label>
              <PasswordInput id="rp-repetir" placeholder="Repetir la nueva contraseña" autoComplete="new-password"
                value={repetir} onChange={e => setRepetir(e.target.value)} />
            </div>
            {error && <div className="alert-danger" role="alert">{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={pedirOtroCodigo} disabled={enviando}>Pedir otro código</button>
            <button type="submit" className="btn-primary" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      )}

      {paso === 'listo' && (
        <>
          <div className="modal-body">
            <div className="alert-ok" role="status">
              Tu contraseña se cambió. Ya podés iniciar sesión con la nueva.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-primary" onClick={onClose}>Volver al inicio de sesión</button>
          </div>
        </>
      )}
    </Modal>
  );
}
