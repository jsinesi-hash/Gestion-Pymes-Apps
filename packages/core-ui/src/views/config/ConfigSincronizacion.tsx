import { useCallback, useEffect, useState } from 'react';
import type { CajaDelHub, EstadoHubLocal, EstadoSyncTerminal } from '@core/preload';
import { useAuth } from '../../auth/AuthContext';
import { bridge } from '../../bridge';
import { traducirError } from '../../lib/errores';

// F2 PR4 (ADR-150 §2 y §10): Configuración → Sincronización. Empareja la terminal con el hub de la red
// local (dirección, huella del certificado confirmada a ojo y código de un solo uso), muestra el estado
// del sync y permite sincronizar, volver a bajar la base del hub o desemparejar.

const ayuda: React.CSSProperties = { fontSize: 12, color: 'var(--ink-3)', marginTop: 4 };
const fila: React.CSSProperties = { display: 'flex', gap: 8, fontSize: 13, padding: '4px 0' };
const etiqueta: React.CSSProperties = { width: 170, color: 'var(--ink-3)', flexShrink: 0 };

/** Nombre visible de cada serie de correlativos por bloques (ADR-154 §2). */
const NOMBRE_SERIE: Record<string, string> = { sku: 'Códigos de producto' };

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
          <div style={fila}><span style={etiqueta}>Terminal coordinadora</span>
            <span data-testid="sync-coordinadora">{estado.coordinadora ? 'Sí (corre las tareas programadas y las alertas)' : 'No (corre en otra terminal)'}</span></div>
          {(estado.series ?? []).map((se) => (
            <div key={se.serie} style={fila}><span style={etiqueta}>{NOMBRE_SERIE[se.serie] ?? se.serie}</span>
              <span data-testid={`sync-serie-${se.serie}`}>
                {se.disponibles === null ? 'Sin tope' : se.disponibles === 0 ? '0 — esperando un bloque del hub' : `${se.disponibles} disponibles`}
              </span></div>
          ))}
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
      ) : null}
      {estado.modo === 'distribuido' && <CajasDelHub esta={estado.origin_id} />}
      {estado.modo !== 'distribuido' ? (
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
      ) : null}
      <ServidorEnEstaPC />
    </div>
  );
}

/**
 * F3 PR3: las cajas emparejadas con el hub, con su último contacto y su versión. Sirve para ver qué caja
 * está desconectada o desactualizada antes de actualizar el hub (ADR-150 §8) o de cerrar una caja compartida.
 */
function CajasDelHub({ esta }: { esta: string }) {
  const [cajas, setCajas] = useState<CajaDelHub[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const leer = () => Promise.resolve().then(() => bridge().sync.terminales())
      .then((c) => { if (vivo) { setCajas(c); setErr(null); } })
      .catch((e) => { if (vivo) { setCajas(null); setErr(traducirError(e).mensaje); } });
    void leer();
    const t = setInterval(() => { void leer(); }, 30_000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  return (
    <section className="panel" style={{ padding: '1rem', maxWidth: 640 }} aria-label="Cajas del hub">
      <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700 }}>Cajas del hub</h3>
      {err && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{err}</div>}
      {!err && !cajas && <div style={{ fontSize: 13, opacity: 0.5 }}>Cargando...</div>}
      {cajas && (
        <div className="table-wrap">
          <table aria-label="Cajas del hub">
            <thead><tr><th>Caja</th><th>Nombre</th><th>Último contacto</th><th>Versión de datos</th></tr></thead>
            <tbody>
              {cajas.map((c) => (
                <tr key={c.origin_id} style={{ opacity: c.revocada_en ? 0.5 : 1 }}>
                  <td className="num">{c.origin_id}{c.origin_id === esta ? ' (esta caja)' : ''}</td>
                  <td>{c.nombre}</td>
                  <td className="text-sm">{c.revocada_en ? 'Revocada' : hora(c.ultimo_contacto ? c.ultimo_contacto * 1000 : null)}</td>
                  <td className="num">{c.version_esquema ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * F2 PR6 (ADR-156 §1): «Usar esta PC como servidor». Instala el hub de la app como servicio del sistema
 * operativo (arranca con la PC; en Windows pide permiso de administrador y abre el puerto en el firewall),
 * muestra si está en marcha, las direcciones de la PC para las otras cajas y la huella, y genera códigos.
 * Si la app no lo configura, la sección no aparece.
 */
function ServidorEnEstaPC() {
  const [estado, setEstado] = useState<EstadoHubLocal | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [codigo, setCodigo] = useState<{ codigo: string; vence_en: number } | null>(null);

  const cargar = useCallback(async () => {
    const api = bridge().hubLocal;
    if (!api) return;
    try { setEstado(await api.estado()); } catch { setEstado(null); }
  }, []);

  useEffect(() => {
    void cargar();
    const t = setInterval(() => { void cargar(); }, 5000);
    return () => clearInterval(t);
  }, [cargar]);

  if (!estado) return null;

  async function accion(fn: () => Promise<void>) {
    setErr(null); setMsg(null); setOcupado(true);
    try { await fn(); } catch (e) { setErr(traducirError(e).mensaje); } finally { setOcupado(false); }
  }

  const instalar = () => void accion(async () => {
    const aviso = estado.plataforma === 'win32'
      ? 'Se va a instalar el servidor (hub) en esta PC: arranca solo con la PC, aunque nadie inicie sesión. Windows te va a pedir permiso de administrador y se abre el puerto en el firewall. ¿Seguir?'
      : 'Se va a instalar el servidor (hub) en esta PC: arranca solo con la PC. El sistema te va a pedir la contraseña de administrador. ¿Seguir?';
    if (!window.confirm(aviso)) return;
    setEstado(await bridge().hubLocal.instalar());
    setMsg('Servidor instalado. Ahora generá un código y emparejá cada caja (también esta) con una de las direcciones de abajo.');
  });

  const desinstalar = () => void accion(async () => {
    if (!window.confirm('El servidor deja de correr en esta PC y las cajas emparejadas no van a poder sincronizar. Los datos del hub no se borran. ¿Seguir?')) return;
    setEstado(await bridge().hubLocal.desinstalar());
    setCodigo(null);
    setMsg('Servidor desinstalado.');
  });

  const generar = () => void accion(async () => { setCodigo(await bridge().hubLocal.codigo()); });

  const estadoTexto = !estado.instalado ? 'No instalado' : estado.enMarcha ? 'En marcha' : 'Instalado, todavía no responde';

  return (
    <section className="panel" style={{ padding: '1rem', maxWidth: 640 }} aria-label="Servidor en esta PC">
      <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700 }}>Servidor en esta PC</h3>
      <p style={{ margin: '0 0 8px', fontSize: 13 }}>
        Una PC del local hace de servidor (hub): guarda la base compartida y las cajas sincronizan contra ella. Conviene que
        sea una que quede siempre encendida.
      </p>
      {msg && <div className="alert-ok" role="status">{msg}</div>}
      {err && <div className="alert-danger" role="alert">{err}</div>}
      <div style={fila}><span style={etiqueta}>Estado</span><strong>{estadoTexto}</strong></div>
      {estado.instalado && (
        <>
          <div style={fila}><span style={etiqueta}>Direcciones de esta PC</span>
            <span>{estado.direcciones.length ? estado.direcciones.join(' · ') : '—'}</span></div>
          <div style={fila}><span style={etiqueta}>Puerto</span><span>{estado.puerto}</span></div>
          <div style={fila}><span style={etiqueta}>Huella del certificado</span>
            <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{estado.huella ?? '—'}</code></div>
          <div style={ayuda}>En cada caja: Configuración → Sincronización, la dirección de esta PC y el código. La huella tiene que coincidir.</div>
        </>
      )}
      {codigo && (
        <div style={{ ...fila, marginTop: 8 }}><span style={etiqueta}>Código de emparejamiento</span>
          <span><strong data-testid="codigo-hub" style={{ fontSize: 16, letterSpacing: 1 }}>{codigo.codigo}</strong>
            <span style={{ ...ayuda, marginLeft: 8 }}>un solo uso, vence {hora(codigo.vence_en * 1000)}</span></span></div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {!estado.instalado && (
          <button type="button" className="btn-primary" onClick={instalar} disabled={ocupado}>Instalar el servidor en esta PC</button>
        )}
        {estado.instalado && (
          <>
            <button type="button" className="btn-primary" onClick={generar} disabled={ocupado || !estado.enMarcha}>Generar código de emparejamiento</button>
            <button type="button" className="btn-secondary" onClick={desinstalar} disabled={ocupado}>Desinstalar el servidor</button>
          </>
        )}
      </div>
    </section>
  );
}
