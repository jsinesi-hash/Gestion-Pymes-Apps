import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PasswordInput } from '@core/ui';

export default function Login() {
  const { login } = useAuth();
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
    } catch {
      setError('Credenciales inválidas');
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo-row">
          <div className="login-logo" />
          <div>
            <div className="login-title">Ferretería</div>
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
