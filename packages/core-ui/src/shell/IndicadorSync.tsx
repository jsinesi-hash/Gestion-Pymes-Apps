import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EstadoSyncTerminal } from '@core/preload';
import { useAuth } from '../auth/AuthContext';
import { bridge } from '../bridge';

// F3 PR3 (análisis §4): estado de la sincronización en la barra superior, solo en una caja emparejada.
// Lo dibuja AppShell (la sincronización es universal: cada app lo tiene sin tener que pasarlo). El estado
// sale del cliente de sync local cada pocos segundos, sin pedirle nada más al hub; los conflictos
// pendientes se consultan al hub cada minuto y solo para quien puede resolverlos (`sync.conflictos`).

export type NivelIndicador = 'ok' | 'info' | 'aviso' | 'error';
export interface EstadoIndicador {
  readonly nivel: NivelIndicador;
  readonly texto: string;
  readonly detalle: string;
  readonly destino: '/config/sincronizacion' | '/config/conflictos';
}

const CADA_MS = 5000;
const CONFLICTOS_CADA_MS = 60_000;

function hora(ms: number | null | undefined): string {
  if (!ms) return 'nunca';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Qué muestra el indicador, del estado más grave al menos grave. null = no se muestra (standalone). */
export function estadoIndicador(e: EstadoSyncTerminal | null, conflictos: number): EstadoIndicador | null {
  if (!e || e.modo !== 'distribuido') return null;
  const sinc = '/config/sincronizacion' as const;
  const s = e.sync;
  if (!s) return { nivel: 'error', texto: 'Sin sincronizar', detalle: 'Esta caja está emparejada pero no puede leer los datos del hub. Revisá Configuración → Sincronización.', destino: sinc };
  if (s.versionesHub) {
    return { nivel: 'error', texto: 'Versión distinta del hub', detalle: 'El hub y esta caja tienen versiones distintas: actualizá primero el hub y después las cajas. Mientras tanto, la caja sigue vendiendo sin sincronizar.', destino: sinc };
  }
  const ultimo = Math.max(s.ultimoPushMs ?? 0, s.ultimoPullMs ?? 0) || null;
  if (s.enLinea === false) {
    return { nivel: 'error', texto: 'Sin conexión', detalle: `La caja sigue vendiendo y sube lo pendiente al volver la conexión. Último contacto con el hub: ${hora(ultimo)}`, destino: sinc };
  }
  if (s.relojDesfasado) {
    return { nivel: 'aviso', texto: 'Reloj desfasado', detalle: `El reloj de esta PC difiere ${Math.round(Math.abs(s.desfasajeMs ?? 0) / 1000)} s del hub. Corregí la fecha y hora de Windows.`, destino: sinc };
  }
  if (conflictos > 0) {
    return { nivel: 'aviso', texto: plural(conflictos, 'conflicto', 'conflictos'), detalle: 'Hay conflictos de sincronización sin revisar.', destino: '/config/conflictos' };
  }
  if (s.recibidosEnEspera > 0) {
    return { nivel: 'aviso', texto: plural(s.recibidosEnEspera, 'cambio en espera', 'cambios en espera'), detalle: 'Cambios de otras cajas que esperan a que se corrija una alta repetida en esta caja.', destino: '/config/conflictos' };
  }
  if (s.enLinea === null) return { nivel: 'info', texto: 'Conectando…', detalle: 'Todavía no hubo respuesta del hub.', destino: sinc };
  if (s.pendientes > 0) {
    return { nivel: 'info', texto: `${s.pendientes} sin subir`, detalle: 'Cambios de esta caja que suben en la próxima sincronización.', destino: sinc };
  }
  return { nivel: 'ok', texto: 'Sincronizada', detalle: `Al día con el hub. Último contacto: ${hora(ultimo)}`, destino: sinc };
}

const PUNTO: Record<NivelIndicador, string> = { ok: 'dot', info: 'dot dot-off', aviso: 'dot dot-warn', error: 'dot dot-danger' };

export function IndicadorSync() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const verConflictos = can('sync.conflictos');
  const [estado, setEstado] = useState<EstadoSyncTerminal | null>(null);
  const [conflictos, setConflictos] = useState(0);

  useEffect(() => {
    let vivo = true;
    // Dentro de la promesa: un bridge sin `sync` (una app vieja, un test) no rompe la barra superior.
    const leer = () => Promise.resolve().then(() => bridge().sync.estado()).then((e) => { if (vivo) setEstado(e); }).catch(() => undefined);
    void leer();
    const t = setInterval(() => { void leer(); }, CADA_MS);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const distribuido = estado?.modo === 'distribuido';
  const enLinea = estado?.sync?.enLinea === true;
  useEffect(() => {
    if (!verConflictos || !distribuido || !enLinea) { setConflictos(0); return; }
    let vivo = true;
    const leer = () => Promise.resolve().then(() => bridge().sync.conflictos({ pendientes: true, limite: 50 }))
      .then((r) => { if (vivo) setConflictos(r.conflictos.length); })
      .catch(() => undefined);
    void leer();
    const t = setInterval(() => { void leer(); }, CONFLICTOS_CADA_MS);
    return () => { vivo = false; clearInterval(t); };
  }, [verConflictos, distribuido, enLinea]);

  const ind = estadoIndicador(estado, conflictos);
  if (!ind) return null;
  const puedeIr = ind.destino === '/config/conflictos' ? verConflictos : can('usuario.administrar');
  const contenido = <><span className={PUNTO[ind.nivel]} />{ind.texto}</>;
  if (!puedeIr) {
    return <span className="chip" data-testid="indicador-sync" data-nivel={ind.nivel} title={ind.detalle}>{contenido}</span>;
  }
  return (
    <button type="button" className="chip chip-btn" data-testid="indicador-sync" data-nivel={ind.nivel} title={ind.detalle}
      aria-label={`${ind.texto}. ${ind.detalle}`} onClick={() => navigate(ind.destino)}>
      {contenido}
    </button>
  );
}
