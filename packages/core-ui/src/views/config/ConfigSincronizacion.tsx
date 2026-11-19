import { useCallback, useEffect, useState } from 'react';
import type { EstadoSyncTerminal } from '@core/preload';
import { useAuth } from '../../auth/AuthContext';
import { bridge } from '../../bridge';
import { traducirError } from '../../lib/errores';

// F2 PR4 (ADR-150 §2 y §10): Configuración → Sincronización. Empareja la terminal con el hub de la red
// local (dirección, huella del certificado confirmada a ojo y código de un solo uso), muestra el estado
// del sync y permite sincronizar, volver a bajar la base del hub o desemparejar.

const ayuda: React.CSSProperties = { fontSize: 12, color: 'var(--ink-3)', marginTop: 4 };
const fila: React.CSSProperties = { display: 'flex', gap: 8, fontSize: 13, padding: '4px 0' };
const etiqueta: React.CSSProperties = { width: 170, color: 'var(--ink-3)', flexShrink: 0 };

function hora(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(ms));
}

export function ConfigSincronizacion() {
  const { can, logout } = useAuth();
  const acceso = can('usuario.administrar');
  const [estado, setEstado] = useState<EstadoSyncTerminal | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Emparejar
  const [url, setUrl] = useState('');
  const [sondeo, setSondeo] = useState<{ url: string; huella: string } | null>(null);
  const [coincide, setCoincide] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');

  const cargar = useCallback(async () => {
    try { setEstado(await bridge().sync.estado()); } catch (e) { setErr(traducirError(e).mensaje); }
  }, []);

  useEffect(() => {
    if (!acceso) return;
    void cargar();
    const t = setInterval(() => { void cargar(); }, 5000);
    return () => clearInterval(t);
  }, [acceso, cargar]);

  if (!acceso) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>Sin acceso.</div>;
  if (!estado) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;

  async function accion(fn: () => Promise<void>) {
    setErr(null); setMsg(null); setOcupado(true);
    try { await fn(); } catch (e) { setErr(traducirError(e).mensaje); } finally { setOcupado(false); }
  }

  const buscar = (e: React.FormEvent) => { e.preventDefault(); void accion(async () => {
    setSondeo(null); setCoincide(false);
    setSondeo(await bridge().sync.sondear({ url }));
  }); };

  const emparejar = (e: React.FormEvent) => { e.preventDefault(); void accion(async () => {
    if (!sondeo) return;
    const r = await bridge().sync.emparejar({ url: sondeo.url, codigo, huella: sondeo.huella, ...(nombre.trim() ? { nombre: nombre.trim() } : {}) });
    setSondeo(null); setCodigo(''); setCoincide(false);
    if (r.arranque === 'snapshot') {
      window.alert(`Terminal emparejada como ${r.origin_id}. Bajó la base del hub (${r.filas} filas): volvé a iniciar sesión con un usuario del hub.`);
      await logout();
      return;
    }
    setMsg(`Terminal emparejada como ${r.origin_id}. Subió su base al hub (${r.filas} filas).`);
    await cargar();
  }); };

  const sincronizar = () => void accion(async () => { setEstado(await bridge().sync.sincronizar()); setMsg('Sincronizada.'); });

  /** Pide confirmar de nuevo si hay cambios sin subir (se perderían). */
  async function conPendientes<T>(fn: (forzar: boolean) => Promise<T>): Promise<T | null> {
    try {
      return await fn(false);
    } catch (e) {
      if (!String((e as Error)?.message ?? e).includes('CAMBIOS_SIN_SUBIR')) throw e;
      if (!window.confirm(`${traducirError(e).mensaje}\n\n¿Seguir de todos modos?`)) return null;
      return fn(true);
    }
  }

  const rebajar = () => void accion(async () => {
    if (!window.confirm('Esta terminal va a reemplazar su base por la del hub (antes se hace un backup). Lo que todavía no subió se intenta subir primero. ¿Seguir?')) return;
    const r = await conPendientes((forzar) => bridge().sync.rebajarSnapshot({ forzar }));
    if (!r) return;
    window.alert(`Se bajó la base del hub (${r.filas} filas). Volvé a iniciar sesión.`);
    await logout();
  });

  const desemparejar = () => void accion(async () => {
    if (!window.confirm('La terminal deja de sincronizar y vuelve a trabajar sola. Para volver a emparejarla hace falta un código nuevo. ¿Seguir?')) return;
    const r = await conPendientes(async (forzar) => { await bridge().sync.desemparejar({ forzar }); return true; });
    if (!r) return;
    setMsg('Terminal desemparejada: trabaja sola (standalone).');
    await cargar();
  });

  const s = estado.sync;
  const ultimoContacto = s ? Math.max(s.ultimoPushMs ?? 0, s.ultimoPullMs ?? 0) || null : null;

  return (
    <div className="flex-col gap-4">
      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Sincronización</h2>
      {msg && <div className="alert-ok" role="status">{msg}</div>}
      {err && <div className="alert-danger" role="alert">{err}</div>}

      {estado.modo === 'distribuido' ? (
        <section className="panel" style={{ padding: '1rem', maxWidth: 640 }} aria-label="Estado de la sincronización">
          <div style={fila}><span style={etiqueta}>Esta terminal</span><strong>{estado.origin_id}</strong></div>
          <div style={fila}><span style={etiqueta}>Hub</span><span>{estado.hub?.url ?? '—'}</span></div>
          <div style={fila}><span style={etiqueta}>Nombre en el hub</span><span>{estado.hub?.nombre ?? '—'}</span></div>
          <div style={fila}><span style={etiqueta}>Huella del certificado</span><code style={{ fontSize: 11, wordBreak: 'break-all' }}>{estado.hub?.huella ?? '—'}</code></div>
          <div style={fila}><span style={etiqueta}>Conexión</span>
            <span>{!s ? 'Sin cliente de sync' : s.enLinea === null ? 'Todavía sin contacto' : s.enLinea ? 'En línea' : 'Sin conexión (la terminal sigue operando)'}</span></div>
          <div style={fila}><span style={etiqueta}>Último contacto</span><span>{hora(ultimoContacto)}</span></div>
          <div style={fila}><span style={etiqueta}>Cambios sin subir</span><span>{s?.pendientes ?? '—'}</span></div>
          {s?.ultimoError && s.enLinea !== false && (
            <div className="alert-danger" role="alert" style={{ marginTop: 8 }}>{traducirError(s.ultimoError).mensaje}</div>
          )}
          {s?.relojDesfasado && (
            <div className="alert-danger" role="alert" style={{ marginTop: 8 }}>
              El reloj de esta PC difiere {Math.round(Math.abs(s.desfasajeMs ?? 0) / 1000)} s del hub. Corregí la fecha y hora de Windows.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn-primary" onClick={sincronizar} disabled={ocupado}>Sincronizar ahora</button>
            <button type="button" className="btn-secondary" onClick={rebajar} disabled={ocupado}>Volver a bajar la base del hub</button>
            <button type="button" className="btn-secondary" onClick={desemparejar} disabled={ocupado}>Desemparejar</button>
          </div>
          <div style={ayuda}>«Volver a bajar la base del hub» es la forma de restaurar esta terminal mientras sincroniza.</div>
        </section>
      ) : (
        <section className="panel" style={{ padding: '1rem', maxWidth: 640 }} aria-label="Emparejar con el hub">
          <p style={{ margin: '0 0 8px', fontSize: 13 }}>
            Esta terminal trabaja sola (terminal <strong>{estado.origin_id}</strong>). Para que comparta los datos con otras
            cajas, emparejala con el hub de la red local.
          </p>
          <form onSubmit={buscar}>
            <div className="field"><label htmlFor="sy-url">Dirección del hub</label>
              <input id="sy-url" className="input" value={url} onChange={(e) => { setUrl(e.target.value); setSondeo(null); }} placeholder="192.168.0.10" />
              <div style={ayuda}>La IP o el nombre de la PC donde corre el hub. El puerto por defecto es 7443.</div></div>
            <button type="submit" className="btn-secondary" disabled={ocupado || !url.trim()}>Buscar el hub</button>
          </form>

          {sondeo && (
            <form onSubmit={emparejar} style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div style={fila}><span style={etiqueta}>Hub encontrado</span><span>{sondeo.url}</span></div>
              <div style={fila}><span style={etiqueta}>Huella del certificado</span><code data-testid="huella-hub" style={{ fontSize: 11, wordBreak: 'break-all' }}>{sondeo.huella}</code></div>
              <div className="field"><label>
                <input type="checkbox" checked={coincide} onChange={(e) => setCoincide(e.target.checked)} />
                {' '}La huella coincide con la que muestra el hub
              </label>
                <div style={ayuda}>Si no coincide, no sigas: puede no ser tu hub.</div></div>
              <div className="field"><label htmlFor="sy-codigo">Código de emparejamiento</label>
                <input id="sy-codigo" className="input" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ABCD-EFGH" autoComplete="off" />
                <div style={ayuda}>Lo genera el hub; sirve una sola vez y dura 15 minutos.</div></div>
              <div className="field"><label htmlFor="sy-nombre">Nombre de esta terminal (opcional)</label>
                <input id="sy-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Caja del frente" /></div>
              <div style={{ ...ayuda, marginBottom: 8 }}>
                Si el hub está vacío, esta terminal le sube su base. Si ya tiene datos, esta terminal <strong>reemplaza su base</strong> por
                la del hub (antes se hace un backup) y hay que volver a iniciar sesión.
              </div>
              <button type="submit" className="btn-primary" disabled={ocupado || !coincide || !codigo.trim()}>
                {ocupado ? 'Emparejando…' : 'Emparejar'}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
