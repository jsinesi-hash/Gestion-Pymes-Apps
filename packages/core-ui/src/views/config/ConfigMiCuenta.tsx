import { bridge } from '../../bridge';
import { useState, useEffect } from 'react';
import { useAppProfile } from '../../AppProfile';
import { useAuth } from '../../auth/AuthContext';
import { useInicioPersonalizableHabilitado } from '../../hooks/useInicioPersonalizable';
import { usePreferencias } from '../../hooks/usePreferencias';
import { traducirError } from '../../lib/errores';
import { motivosPasswordDebil, mensajePasswordDebil } from '@ferreteria/shared';

function PasswordInput({ id, value, onChange, required, minLength, placeholder, defaultShowValue, maxLength, pattern, inputMode }: Readonly<{
  id?: string; value: string; onChange: (v: string) => void;
  required?: boolean; minLength?: number; placeholder?: string;
  defaultShowValue?: boolean; maxLength?: number; pattern?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}>) {
  const [show, setShow] = useState(defaultShowValue ?? false);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        id={id}
        className="input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        pattern={pattern}
        inputMode={inputMode}
        placeholder={placeholder}
        style={{ paddingRight: '2.5rem' }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        tabIndex={-1}
        style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink-3)', display: 'flex', alignItems: 'center' }}
      >
        {show ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}

export function ConfigMiCuenta() {
  const { session, can } = useAuth();
  const inicioPersonalizable = useInicioPersonalizableHabilitado();
  const { guardarInicio } = usePreferencias();
  const { navegacion } = useAppProfile();
  // ADR-080 (PERF-1): rutas que el rol puede elegir como inicio (filtradas por permiso).
  const opcionesInicio = navegacion.rutas.filter(r => !r.permiso || can(r.permiso));
  const [profile, setProfile] = useState<{ id: string; nombre_completo: string; nombre_usuario: string; email: string | null } | null>(null);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    bridge().auth.whoami().then((s: any) => {
      if (!s) return;
      setProfile({ id: s.id, nombre_completo: s.nombreCompleto, nombre_usuario: s.nombreCompleto, email: null });
      setNombreCompleto(s.nombreCompleto);
    });
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await bridge().usuario.update({
        id: profile.id, nombre_completo: nombreCompleto.trim(), email: email.trim() || undefined,
      });
      setProfileMsg({ ok: true, text: 'Datos actualizados.' });
      setProfile(p => p ? { ...p, nombre_completo: nombreCompleto.trim() } : p);
    } catch (err: any) {
      setProfileMsg({ ok: false, text: err?.message ?? 'Error al guardar.' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (newPassword !== confirmPassword) { setPwdMsg({ ok: false, text: 'Las contraseñas no coinciden.' }); return; }
    // Revisión 2026-10-20 (P1): política de contraseña. El main la vuelve a aplicar (y además exige
    // que no sea igual al usuario: acá no se conoce, `profile.nombre_usuario` trae el nombre completo).
    const [motivo] = motivosPasswordDebil(newPassword);
    if (motivo) { setPwdMsg({ ok: false, text: mensajePasswordDebil(motivo) }); return; }
    setSavingPwd(true);
    setPwdMsg(null);
    try {
      await bridge().usuario.changePassword({
        target_user_id: profile.id, current_password: currentPassword, new_password: newPassword,
      });
      setPwdMsg({ ok: true, text: 'Contraseña actualizada.' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      const msg = String(err?.message ?? '').includes('PASSWORD_INCORRECTA')
        ? 'Contraseña actual incorrecta.'
        : traducirError(err).mensaje;
      setPwdMsg({ ok: false, text: msg });
    } finally {
      setSavingPwd(false);
    }
  }

  if (!profile) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  return (
    <div className="flex-col gap-4" style={{ maxWidth: 520 }}>
      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Mi cuenta</h2>

      <div className="card">
        <div className="card-title">Información personal</div>
        <form onSubmit={handleSaveProfile}>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="mc-nombre">Nombre completo *</label>
              <input id="mc-nombre" className="input" value={nombreCompleto} onChange={e => setNombreCompleto(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="mc-email">Email</label>
              <input id="mc-email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Opcional" />
            </div>
            {profileMsg && (
              <div className={profileMsg.ok ? 'alert-ok' : 'alert-danger'} role="alert">{profileMsg.text}</div>
            )}
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn-primary" disabled={savingProfile || !nombreCompleto.trim()}>
              {savingProfile ? 'Guardando...' : 'Guardar datos'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-title">Cambiar contraseña</div>
        <form onSubmit={handleSavePassword}>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="mc-pwd-actual">Contraseña actual *</label>
              <PasswordInput id="mc-pwd-actual" value={currentPassword} onChange={setCurrentPassword} required />
            </div>
            <div className="field">
              <label htmlFor="mc-pwd-nueva">Nueva contraseña *</label>
              <PasswordInput id="mc-pwd-nueva" value={newPassword} onChange={setNewPassword} required minLength={8} />
            </div>
            <div className="field">
              <label htmlFor="mc-pwd-confirm">Confirmar nueva contraseña *</label>
              <PasswordInput id="mc-pwd-confirm" value={confirmPassword} onChange={setConfirmPassword} required />
            </div>
            {pwdMsg && (
              <div className={pwdMsg.ok ? 'alert-ok' : 'alert-danger'} role="alert">{pwdMsg.text}</div>
            )}
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn-primary" disabled={savingPwd || !currentPassword || !newPassword || !confirmPassword}>
              {savingPwd ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </div>

      {inicioPersonalizable && (
        <div className="card">
          <div className="card-title">Inicio</div>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="mc-inicio">Pantalla de inicio</label>
              <select
                id="mc-inicio"
                className="input"
                defaultValue={session?.preferencias.pantalla_inicio ?? ''}
                onChange={e => guardarInicio(e.target.value === '' ? null : e.target.value)}
              >
                <option value="">Automático (según rol)</option>
                {opcionesInicio.map(r => <option key={r.path} value={r.path}>{r.path}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
