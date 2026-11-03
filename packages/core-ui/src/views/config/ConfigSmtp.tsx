import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { bridge } from '../../bridge';

type Cfg = { host: string; port: number; secure: boolean; from: string; user: string; tiene_password: boolean };

// El campo `user` se guarda en parametros_sistema EN TEXTO PLANO (solo la contraseña va a
// safeStorage, ADR-048). Una contraseña tipeada por error en Usuario queda sin cifrar y
// entra en los backups .fbk. Chequeamos forma completa de direccion (algo@dominio.tld):
// alcanza para detectar cadenas tipo "Secreta123@@", que un simple test de "@" dejaria pasar.
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ayuda: React.CSSProperties = { fontSize: 12, color: 'var(--ink-3)', marginTop: 4 };
const advertencia: React.CSSProperties = { fontSize: 12, color: 'var(--danger)', marginTop: 4, fontWeight: 600 };

/** 465 = TLS implicita (secure on). 587 = STARTTLS (secure off). Otras combinaciones suelen fallar. */
function avisoPuerto(port: number, secure: boolean): string | null {
  if (port === 465 && !secure) return 'El puerto 465 usa TLS directa: marcá "Conexión segura" o la conexión se va a cortar.';
  if (port === 587 && secure) return 'El puerto 587 usa STARTTLS: destildá "Conexión segura".';
  return null;
}

export function ConfigSmtp() {
  const { can } = useAuth();
  const acceso = can('config.fiscal');
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);
  const [avisarCierre, setAvisarCierre] = useState(false);

  useEffect(() => {
    if (!acceso) return;
    const f = bridge();
    f.smtp.getConfig().then(setCfg);
    // notif_cierre_caja_email vive en parametros_sistema, que no tiene pantalla propia:
    // se administra desde acá, que es donde el usuario configura el canal email.
    f.parametros.get({ clave: 'notif_cierre_caja_email' })
      .then((v: string | null) => setAvisarCierre(v === 'true'));
  }, [acceso]);

  if (!acceso) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>Sin acceso.</div>;
  if (!cfg) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  const usuarioSospechoso = cfg.user.trim() !== '' && !RE_EMAIL.test(cfg.user.trim());

  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setMsg(null);
    // El Usuario se guarda sin cifrar: si no parece una direccion, confirmamos antes de
    // escribirlo (evita dejar una contraseña en texto plano en la BD y en los backups).
    if (cfg!.user.trim() !== '' && !RE_EMAIL.test(cfg!.user.trim())) {
      const ok = window.confirm(
        'El campo "Usuario" no parece una dirección de correo.\n\n' +
        'Ojo: el Usuario se guarda SIN CIFRAR. Si lo que escribiste es la contraseña, ' +
        'cancelá y ponela en el campo "Contraseña" (ese sí se guarda cifrado).\n\n' +
        'Si tu servidor usa un nombre de usuario que no es un mail, continuá.',
      );
      if (!ok) return;
    }
    const f = bridge();
    try {
      await f.smtp.setConfig({ host: cfg!.host, port: cfg!.port, secure: cfg!.secure, from: cfg!.from, user: cfg!.user });
      if (password) { await f.smtp.setPassword({ password }); setPassword(''); }
      await f.parametros.set({ clave: 'notif_cierre_caja_email', valor: avisarCierre ? 'true' : 'false' });
      setMsg('Configuración guardada.');
      setCfg(await f.smtp.getConfig());
    } catch (e2: any) { setErr(e2?.message ?? 'Error'); }
  }

  async function probar() {
    setProbando(true); setErr(null); setMsg(null);
    try {
      const r = await bridge().smtp.probar();
      if (r.ok) setMsg('Conexión OK.'); else setErr(`Falló la conexión: ${r.error}`);
    } catch (e: any) {
      setErr(e?.message ?? 'Error al probar la conexión.');
    } finally { setProbando(false); }
  }

  return (
    <div className="flex-col gap-4">
      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Email / SMTP</h2>
      {msg && <div className="alert-ok" role="status">{msg}</div>}
      {err && <div className="alert-danger" role="alert">{err}</div>}
      <form onSubmit={guardar} className="panel" style={{ padding: '1rem', maxWidth: 480 }}>
        <div className="field"><label htmlFor="s-host">Host</label>
          <input id="s-host" className="input" value={cfg.host} onChange={e => setCfg({ ...cfg, host: e.target.value })} /></div>
        <div className="field"><label htmlFor="s-port">Puerto</label>
          <input id="s-port" className="input" type="number" value={cfg.port} onChange={e => setCfg({ ...cfg, port: Number(e.target.value) })} />
          <div style={ayuda}>587 = STARTTLS (lo habitual) · 465 = TLS directa</div></div>
        <div className="field"><label><input type="checkbox" checked={cfg.secure} onChange={e => setCfg({ ...cfg, secure: e.target.checked })} /> Conexión segura (TLS directa / 465)</label></div>
        {avisoPuerto(cfg.port, cfg.secure) && (
          <div style={advertencia} role="alert">{avisoPuerto(cfg.port, cfg.secure)}</div>
        )}
        <div className="field"><label htmlFor="s-from">Remitente (From)</label>
          <input id="s-from" className="input" type="email" value={cfg.from} onChange={e => setCfg({ ...cfg, from: e.target.value })} placeholder="nombre@tudominio.com" /></div>
        <div className="field"><label htmlFor="s-user">Usuario</label>
          <input id="s-user" className="input" value={cfg.user} onChange={e => setCfg({ ...cfg, user: e.target.value })} placeholder="tu dirección completa, ej. nombre@gmail.com" />
          <div style={ayuda}>Casi siempre es tu dirección completa, no solo el nombre. Se guarda <strong>sin cifrar</strong>.</div>
          {usuarioSospechoso && (
            <div style={advertencia} role="alert">
              Esto no parece una dirección de correo. Si es tu contraseña, va en el campo de abajo —
              el Usuario se guarda sin cifrar.
            </div>
          )}
        </div>
        <div className="field"><label htmlFor="s-pass">Contraseña</label>
          <input id="s-pass" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                 placeholder={cfg.tiene_password ? 'Dejar en blanco para no cambiarla' : 'Sin configurar'} />
          <div style={ayuda}>Se guarda cifrada con safeStorage, fuera de la base y de los backups.</div></div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          {cfg.tiene_password ? 'Ya hay una contraseña guardada.' : 'Todavía no hay contraseña configurada.'}
        </div>
        <div style={{ ...ayuda, marginTop: 8, lineHeight: 1.5 }}>
          <strong>Gmail, Outlook y similares no aceptan la contraseña de tu cuenta.</strong> Necesitás
          una <strong>contraseña de aplicación</strong>: activá la verificación en 2 pasos y generala
          desde la configuración de seguridad de tu cuenta. Para Gmail: host <code>smtp.gmail.com</code>,
          puerto <code>587</code>, sin conexión segura, y usuario = tu dirección completa.
        </div>
        <div className="field" style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}>
          <label htmlFor="s-notif-cierre">
            <input id="s-notif-cierre" type="checkbox" checked={avisarCierre}
                   onChange={e => setAvisarCierre(e.target.checked)} />
            {' '}Avisar los cierres de caja por email
          </label>
          <div style={ayuda}>
            Con esto apagado, el cierre igual queda registrado en la bandeja de avisos (in-app);
            solo no se manda el mail.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="submit" className="btn-primary">Guardar</button>
          <button type="button" className="btn-secondary" onClick={probar} disabled={probando}>{probando ? 'Probando...' : 'Probar conexión'}</button>
        </div>
      </form>
    </div>
  );
}
