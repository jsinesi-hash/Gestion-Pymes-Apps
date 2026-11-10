import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motivosPasswordDebil, mensajePasswordDebil, emailValido } from '@ferreteria/shared';
import { useAuth } from './AuthContext';
import { PasswordInput } from '../components/PasswordInput';
import { useAppProfile } from '../AppProfile';
import { traducirError } from '../lib/errores';
import { bridge } from '../bridge';
import RecuperarPassword from './RecuperarPassword';

// ADR-136: cuando la contraseña venció o falta el mail, el login verifica las credenciales pero no
// abre sesión; este componente muestra el paso que corresponde y reenvía las credenciales.
type Paso = 'credenciales' | 'cambiar' | 'email';

const textoDe = (e: unknown): string => String((e as { message?: unknown } | null)?.message ?? e);

export default function Login() {
  const { login, cambiarPasswordVencida, completarEmail } = useAuth();
  const { nombreApp } = useAppProfile();
  const navigate = useNavigate();
  const [paso, setPaso] = useState<Paso>('credenciales');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  // ADR-137: el enlace «Olvidé mi contraseña» solo aparece si la app tiene un correo saliente configurado.
  const [puedeRecuperar, setPuedeRecuperar] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  useEffect(() => {
    let vivo = true;
    try {
      Promise.resolve(bridge().auth?.recuperacionDisponible?.())
        .then((v) => { if (vivo) setPuedeRecuperar(v === true); })
        .catch(() => {});
    } catch { /* bridge no disponible (tests): sin enlace */ }
    return () => { vivo = false; };
  }, []);

  async function handleCredenciales(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreUsuario || !password) return;
    try {
      setError('');
      await login({ nombreUsuario, password });
      navigate('/');
    } catch (err) {
      const texto = textoDe(err);
      if (texto.includes('PASSWORD_VENCIDA')) { setPaso('cambiar'); return; }
      if (texto.includes('EMAIL_REQUERIDO')) { setPaso('email'); return; }
      // Revisión 2026-10-20 (P1): tras 3 intentos fallidos la cuenta se bloquea 15 minutos y
      // se avisa cuánto falta; cualquier otro fallo sigue siendo el genérico (no revela si el
      // usuario existe).
      setError(texto.includes('CUENTA_BLOQUEADA') ? traducirError(err).mensaje : 'Credenciales inválidas');
    }
  }

  async function handleCambiar(e: React.FormEvent) {
    e.preventDefault();
    if (nueva !== repetir) { setError('Las contraseñas no coinciden.'); return; }
    const [motivo] = motivosPasswordDebil(nueva, nombreUsuario);
    if (motivo) { setError(mensajePasswordDebil(motivo)); return; }
    setEnviando(true);
    setError('');
    try {
      await cambiarPasswordVencida?.({ nombreUsuario, passwordActual: password, passwordNueva: nueva });
      navigate('/');
    } catch (err) {
      if (textoDe(err).includes('EMAIL_REQUERIDO')) {
        // La clave ya quedó cambiada: sigue la carga del mail con la clave nueva.
        setPassword(nueva); setNueva(''); setRepetir('');
        setPaso('email');
        return;
      }
      setError(traducirError(err).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValido(email)) { setError('Ingresá un correo electrónico válido.'); return; }
    setEnviando(true);
    setError('');
    try {
      await completarEmail?.({ nombreUsuario, password, email: email.trim() });
      navigate('/');
    } catch (err) {
      setError(traducirError(err).mensaje);
    } finally {
      setEnviando(false);
    }
  }

  function volver() {
    setPaso('credenciales');
    setPassword(''); setNueva(''); setRepetir(''); setEmail('');
    setError('');
  }

  const onSubmit = paso === 'cambiar' ? handleCambiar : paso === 'email' ? handleEmail : handleCredenciales;

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="login-logo-row">
          <div className="login-logo" />
          <div>
            <div className="login-title">{nombreApp}</div>
            <div className="login-sub">Sistema de gestión</div>
          </div>
        </div>

        {paso === 'credenciales' && (
          <>
            <div className="field">
              <label htmlFor="usuario">Usuario</label>
              <input id="usuario" className="input" type="text" placeholder="Usuario"
                value={nombreUsuario} onChange={e => setNombreUsuario(e.target.value)} autoFocus />
            </div>

            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <PasswordInput id="password" placeholder="Contraseña" autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {puedeRecuperar && (
              <button type="button" onClick={() => setRecuperando(true)}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, alignSelf: 'flex-start' }}>
                Olvidé mi contraseña
              </button>
            )}
          </>
        )}

        {paso === 'cambiar' && (
          <>
            <div className="alert-warn" role="status">
              Elegí una contraseña nueva para continuar: la anterior venció o la restableció un
              administrador. A partir de ahora vas a ingresar con la nueva.
            </div>
            <div className="field">
              <label htmlFor="password-nueva">Nueva contraseña</label>
              <PasswordInput id="password-nueva" placeholder="Nueva contraseña" autoComplete="new-password"
                value={nueva} onChange={e => setNueva(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="password-repetir">Repetir la nueva contraseña</label>
              <PasswordInput id="password-repetir" placeholder="Repetir la nueva contraseña" autoComplete="new-password"
                value={repetir} onChange={e => setRepetir(e.target.value)} />
            </div>
          </>
        )}

        {paso === 'email' && (
          <>
            <div className="alert-warn" role="status">
              Falta un correo electrónico en tu usuario. Lo necesitamos para que puedas recuperar tu contraseña.
            </div>
            <div className="field">
              <label htmlFor="login-email">Correo electrónico</label>
              <input id="login-email" className="input" type="email" placeholder="nombre@ejemplo.com"
                autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            </div>
          </>
        )}

        {error && <div className="alert-danger" role="alert">{error}</div>}

        <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }} disabled={enviando}>
          {paso === 'cambiar' ? 'Cambiar contraseña' : paso === 'email' ? 'Guardar correo' : 'Ingresar'}
        </button>
        {paso !== 'credenciales' && (
          <button type="button" className="btn-secondary" style={{ justifyContent: 'center' }} onClick={volver} disabled={enviando}>
            Volver
          </button>
        )}
      </form>
      {recuperando && (
        <RecuperarPassword nombreUsuarioInicial={nombreUsuario} onClose={() => setRecuperando(false)} />
      )}
    </div>
  );
}
