import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEscapeToClose } from '@core/ui';

type Usuario = {
  id: string; nombre_usuario: string; nombre_completo: string;
  email: string | null; activo: boolean; rol_id: string; rol_nombre: string;
};
type Rol = { id: string; nombre: string };

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; user: Usuario }
  | { mode: 'password'; user: Usuario }
  | null;

function PasswordInput({ id, value, onChange, required, minLength, autoFocus, placeholder }: Readonly<{
  id?: string; value: string; onChange: (v: string) => void;
  required?: boolean; minLength?: number; autoFocus?: boolean; placeholder?: string;
}>) {
  const [show, setShow] = useState(false);
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
        autoFocus={autoFocus}
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

export function ConfigUsuarios() {
  const { can } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState<string | null>(null);
  const hasAccess = can('usuario.administrar');

  async function cargar() {
    setLoading(true);
    try {
      const f = (globalThis as any).ferreteria;
      const [u, r] = await Promise.all([f.usuario.list(), f.rol.list()]);
      setUsuarios(u ?? []);
      setRoles(r ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!hasAccess) return;
    cargar();
  }, [hasAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasAccess) {
    return <div style={{ padding: '2rem', color: 'var(--danger)' }}>Sin acceso.</div>;
  }

  async function handleDesactivar(u: Usuario) {
    if (!confirm(`¿Desactivar a ${u.nombre_completo}?`)) return;
    try {
      await (globalThis as any).ferreteria.usuario.desactivar({ userId: u.id });
      cargar();
    } catch (e: any) {
      setError(e?.message === 'LAST_SUPERVISOR' ? 'No se puede desactivar el último supervisor activo.' : (e?.message ?? 'Error'));
    }
  }

  async function handleReactivar(u: Usuario) {
    try {
      await (globalThis as any).ferreteria.usuario.reactivar({ userId: u.id });
      cargar();
    } catch (e: any) { setError(e?.message ?? 'Error'); }
  }

  return (
    <div className="flex-col gap-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Usuarios</h2>
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>+ Nuevo usuario</button>
      </div>

      {error && <div className="alert-danger" role="alert">{error} <button style={{ marginLeft: 8 }} onClick={() => setError(null)}>✕</button></div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando...</div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th className="c">Estado</th><th className="c">Acciones</th></tr>
              </thead>
              <tbody>
                {usuarios.map(u => {
                  const isAdmin = u.nombre_usuario === 'admin';
                  return (
                    <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.5 }}>
                      <td>{u.nombre_completo}</td>
                      <td className="text-muted text-sm num">{u.nombre_usuario}</td>
                      <td><span className="badge ok"><span className="bd" />{u.rol_nombre}</span></td>
                      <td className="c">
                        <span className={`badge ${u.activo ? 'ok' : 'off'}`}>
                          <span className="bd" />{u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="c">
                        <div className="row-act" style={{ justifyContent: 'center' }}>
                          {!isAdmin && (
                            <button className="ia" title="Editar" onClick={() => setModal({ mode: 'edit', user: u })}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          )}
                          <button className="ia" title="Cambiar contraseña" onClick={() => setModal({ mode: 'password', user: u })}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                          </button>
                          {!isAdmin && (u.activo
                            ? <button className="ia del" title="Desactivar" onClick={() => handleDesactivar(u)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            : <button className="ia" title="Reactivar" onClick={() => handleReactivar(u)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                              </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal?.mode === 'create' && (
        <UsuarioModal roles={roles} onClose={() => setModal(null)} onSuccess={() => { setModal(null); cargar(); }} />
      )}
      {modal?.mode === 'edit' && (
        <UsuarioModal
          roles={roles}
          user={modal.user}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); cargar(); }}
          onDesactivar={async () => {
            if (!confirm(`¿Desactivar a ${(modal as any).user.nombre_completo}?`)) return;
            try {
              await (globalThis as any).ferreteria.usuario.desactivar({ userId: (modal as any).user.id });
              setModal(null); cargar();
            } catch (e: any) {
              setError(e?.message === 'LAST_SUPERVISOR' ? 'No se puede desactivar el último supervisor activo.' : (e?.message ?? 'Error'));
              setModal(null);
            }
          }}
        />
      )}
      {modal?.mode === 'password' && (
        <ChangePasswordModal user={modal.user} onClose={() => setModal(null)} onSuccess={() => setModal(null)} />
      )}
    </div>
  );
}

function UsuarioModal({ roles, user, onClose, onSuccess, onDesactivar }: Readonly<{
  roles: Rol[]; user?: Usuario; onClose: () => void; onSuccess: () => void;
  onDesactivar?: () => Promise<void>;
}>) {
  const isEdit = !!user;
  const [nombre, setNombre] = useState(user?.nombre_completo ?? '');
  const [nombreUsuario, setNombreUsuario] = useState(user?.nombre_usuario ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rolId, setRolId] = useState(user?.rol_id ?? roles[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onClose, !saving);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSaving(true); setError(null);
    try {
      const f = (globalThis as any).ferreteria;
      if (isEdit) {
        await f.usuario.update({ id: user!.id, nombre_completo: nombre.trim(), email: email.trim() || undefined, rol_id: rolId });
      } else {
        if (!password) { setError('La contraseña es requerida.'); return; }
        await f.usuario.create({ nombre_usuario: nombreUsuario.trim(), nombre_completo: nombre.trim(), email: email.trim() || undefined, password, rol_id: rolId });
      }
      onSuccess();
    } catch (err: any) {
      const msg = err?.message === 'USUARIO_DUPLICADO' ? 'El nombre de usuario ya existe.' : (err?.message ?? 'Error');
      setError(msg);
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" role="button" tabIndex={0} aria-label="Cerrar" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" tabIndex={-1} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} style={{ width: 400 }}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</span>
          <button className="ia" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="um-nombre">Nombre completo *</label>
              <input id="um-nombre" className="input" value={nombre} onChange={e => setNombre(e.target.value)} required />
            </div>
            {!isEdit && (
              <div className="field">
                <label htmlFor="um-username">Nombre de usuario *</label>
                <input id="um-username" className="input" value={nombreUsuario} onChange={e => setNombreUsuario(e.target.value)} required />
              </div>
            )}
            <div className="field">
              <label htmlFor="um-email">Email</label>
              <input id="um-email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Opcional" />
            </div>
            {!isEdit && (
              <>
                <div className="field">
                  <label htmlFor="um-pwd">Contraseña *</label>
                  <PasswordInput id="um-pwd" value={password} onChange={setPassword} required minLength={4} />
                </div>
                <div className="field">
                  <label htmlFor="um-pwd-confirm">Confirmar contraseña *</label>
                  <PasswordInput id="um-pwd-confirm" value={confirmPassword} onChange={setConfirmPassword} required minLength={4} />
                </div>
              </>
            )}
            <div className="field">
              <label htmlFor="um-rol">Rol *</label>
              <select id="um-rol" className="input" value={rolId} onChange={e => setRolId(e.target.value)} required>
                {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            {error && <div className="alert-danger" role="alert">{error}</div>}
          </div>
          <div className="modal-footer">
            {isEdit && user?.activo && onDesactivar && (
              <button type="button" className="btn-danger" onClick={onDesactivar} disabled={saving} style={{ marginRight: 'auto' }}>
                Desactivar
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChangePasswordModal({ user, onClose, onSuccess }: Readonly<{ user: Usuario; onClose: () => void; onSuccess: () => void }>) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onClose, !saving);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    if (newPassword.length < 4) { setError('Mínimo 4 caracteres.'); return; }
    setSaving(true); setError(null);
    try {
      await (globalThis as any).ferreteria.usuario.changePassword({ target_user_id: user.id, new_password: newPassword });
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? 'Error');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" role="button" tabIndex={0} aria-label="Cerrar" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" tabIndex={-1} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} style={{ width: 360 }}>
        <div className="modal-header">
          <span className="modal-title">Cambiar contraseña — {user.nombre_completo}</span>
          <button className="ia" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label htmlFor="cpm-pwd-nueva">Nueva contraseña *</label>
              <PasswordInput id="cpm-pwd-nueva" value={newPassword} onChange={setNewPassword} required minLength={4} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="cpm-pwd-confirm">Confirmar *</label>
              <PasswordInput id="cpm-pwd-confirm" value={confirm} onChange={setConfirm} required />
            </div>
            {error && <div className="alert-danger" role="alert">{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving || !newPassword || !confirm}>
              {saving ? 'Guardando...' : 'Cambiar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
