import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

type Props = { onUnlock: () => void };

// SEC-3 (ADR-079): overlay de bloqueo por inactividad. Pide la contraseña del usuario de
// la sesión actual (window.ferreteria.auth.verifyPassword) sin cerrar sesión ni perder
// estado de la UI debajo (venta en curso, filtros, etc.).
export function PantallaBloqueo({ onUnlock }: Readonly<Props>) {
  const { session, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const ok = await (globalThis as any).ferreteria.auth.verifyPassword({ password });
      if (ok) { setPassword(''); onUnlock(); }
      else setError('Contraseña incorrecta.');
    } catch {
      setError('No se pudo verificar. Intentá de nuevo.');
    } finally { setBusy(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Terminal bloqueada"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg, rgba(0,0,0,.85))', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <form className="panel" style={{ width: 360, padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div>
            <div style={{ fontWeight: 700 }}>Terminal bloqueada</div>
            <div className="text-sm text-muted">{session?.nombreCompleto}</div>
          </div>
        </div>
        <div className="field">
          <label htmlFor="lock-pass">Contraseña</label>
          <input id="lock-pass" ref={inputRef} type="password" value={password}
            onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          {error && <div className="field-error">{error}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button type="button" className="btn-secondary" onClick={logout}>Salir</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Verificando…' : 'Desbloquear'}
          </button>
        </div>
      </form>
    </div>
  );
}
