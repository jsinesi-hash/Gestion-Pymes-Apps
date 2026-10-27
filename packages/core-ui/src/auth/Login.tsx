import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { PasswordInput } from '../components/PasswordInput';
import { useAppProfile } from '../AppProfile';
import { traducirError } from '../lib/errores';

export default function Login() {
  const { login } = useAuth();
  const { nombreApp } = useAppProfile();
  const navigate = useNavigate();
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreUsuario || !password) return;
    try {
      setError('');
      await login({ nombreUsuario, password });
      navigate('/');
    } catch (e) {
      // Revisión 2026-10-20 (P1): tras 3 intentos fallidos la cuenta se bloquea 15 minutos y
      // se avisa cuánto falta; cualquier otro fallo sigue siendo el genérico (no revela si el
      // usuario existe).
      const texto = String((e as { message?: unknown } | null)?.message ?? e);
      setError(texto.includes('CUENTA_BLOQUEADA') ? traducirError(e).mensaje : 'Credenciales inválidas');
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo-row">
          <div className="login-logo" />
          <div>
            <div className="login-title">{nombreApp}</div>
            <div className="login-sub">Sistema de gestión</div>
          </div>
        </div>

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

        {error && <div className="alert-danger" role="alert">{error}</div>}

        <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>
          Ingresar
        </button>
      </form>
    </div>
  );
}
