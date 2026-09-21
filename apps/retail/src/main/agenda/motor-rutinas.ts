import { eq, and, lte } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getOriginId } from '../context';
import { calcularProximoDisparo, type FrecuenciaDef } from './frecuencia';
import { insertarAvisos, despacharAviso } from './aviso-servicio';
import type { Canal } from './canales/tipos';

type Db = BetterSQLite3Database<typeof schema>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Rutina = typeof schema.rutina.$inferSelect;

function syncMeta(now: Date) {
  return { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };
}

function defDeRutina(r: Rutina): FrecuenciaDef {
  return {
    frecuencia_tipo: r.frecuencia_tipo, intervalo: r.intervalo,
    dia_semana: r.dia_semana, dia_mes: r.dia_mes, hora: r.hora,
    fecha_inicio: r.fecha_inicio, fecha_fin: r.fecha_fin,
  };
}

function canalesDeRutina(r: Pick<Rutina, 'canal_in_app' | 'canal_email'>): Canal[] {
  const canales: Canal[] = [];
  if (r.canal_in_app) canales.push('in_app');
  if (r.canal_email) canales.push('email');
  return canales.length ? canales : ['in_app'];
}

/**
 * Crea el agenda_evento para el disparo `fecha` (si no existe ya uno para esa rutina+fecha)
 * y encola sus avisos DENTRO de la misma tx. Devuelve evento_id o null si ya existia.
 */
function materializarEnTx(tx: Tx, r: Rutina, fecha: Date, now: Date): string | null {
  const yaExiste = tx.select().from(schema.agenda_evento)
    .where(and(eq(schema.agenda_evento.rutina_id, r.id), eq(schema.agenda_evento.fecha, fecha)))
    .get();
  if (yaExiste) return null;

  const eventoId = generateId();
  tx.insert(schema.agenda_evento).values({
    id: eventoId, origen: 'rutina', rutina_id: r.id,
    titulo: r.nombre, descripcion: r.descripcion, fecha, estado: 'pendiente',
    destinatario_tipo: r.destinatario_tipo,
    destinatario_usuario_id: r.destinatario_usuario_id,
    destinatario_rol: r.destinatario_rol,
    canal_in_app: r.canal_in_app, canal_email: r.canal_email,
    activo: true, usuario_creacion_id: r.usuario_creacion_id, fecha_creacion: now,
    ...syncMeta(now),
  }).run();

  insertarAvisos(tx, {
    origen_tipo: 'agenda_evento', origen_id: eventoId, agenda_evento_id: eventoId,
    titulo: r.nombre, cuerpo: r.descripcion ?? r.nombre,
    destinatario: r.destinatario_tipo === 'usuario'
      ? { tipo: 'usuario', id: r.destinatario_usuario_id ?? undefined }
      : { tipo: 'rol', rol: r.destinatario_rol ?? undefined },
    canales: canalesDeRutina(r),
    dedupe_clave: `rutina:${r.id}:${fecha.getTime()}`,
  }, now);

  return eventoId;
}

function idsDeAvisosDeEvento(db: Db | Tx, eventoId: string): string[] {
  return db.select().from(schema.aviso)
    .where(eq(schema.aviso.agenda_evento_id, eventoId)).all().map((a) => a.id);
}

/**
 * Completa un evento (de rutina o manual). Si es de rutina activa, avanza el puntero
 * (proximo_disparo) y, si la siguiente ocurrencia ya esta vencida/hoy, la materializa.
 * Los avisos se despachan best-effort FUERA de la transaccion.
 */
export function completarEventoRutina(db: Db, eventoId: string, usuarioId: string, now: Date): void {
  const nuevosAvisos: string[] = [];
  db.transaction((tx) => {
    const ev = tx.select().from(schema.agenda_evento).where(eq(schema.agenda_evento.id, eventoId)).get();
    if (!ev) throw new Error('EVENTO_NOT_FOUND');
    tx.update(schema.agenda_evento)
      .set({ estado: 'completada', completado_at: now, completado_por: usuarioId,
        usuario_modificacion_id: usuarioId, fecha_actualizacion: now, ...syncMeta(now) })
      .where(eq(schema.agenda_evento.id, eventoId)).run();

    if (ev.rutina_id) {
      const r = tx.select().from(schema.rutina).where(eq(schema.rutina.id, ev.rutina_id)).get();
      if (r && r.activa && r.activo) {
        const siguiente = calcularProximoDisparo(defDeRutina(r), now);
        tx.update(schema.rutina).set({ proximo_disparo: siguiente, ...syncMeta(now) })
          .where(eq(schema.rutina.id, r.id)).run();
        // Si la siguiente ya vencio o es dentro de las proximas 24h, materializar de una.
        if (siguiente && siguiente.getTime() <= now.getTime() + 24 * 3600 * 1000) {
          const nid = materializarEnTx(tx, { ...r, proximo_disparo: siguiente }, siguiente, now);
          if (nid) nuevosAvisos.push(...idsDeAvisosDeEvento(tx, nid));
        }
      }
    }
  });
  for (const id of nuevosAvisos) { void despacharAviso(db, id); }
}

/**
 * ADR-047 §catch-up: al abrir la app barre rutinas activas con proximo_disparo <= now,
 * materializa las ocurrencias vencidas mientras estuvo cerrada (acotado por
 * agenda_catchup_limite), genera avisos y avanza el puntero.
 */
export function ejecutarCatchUp(db: Db, now: Date): { materializados: number } {
  const catchupLimite = Number.parseInt(
    db.select().from(schema.parametros_sistema)
      .where(eq(schema.parametros_sistema.clave, 'agenda_catchup_limite')).get()?.valor ?? '90', 10);
  const piso = new Date(now.getTime() - catchupLimite * 24 * 3600 * 1000);

  const rutinas = db.select().from(schema.rutina)
    .where(and(eq(schema.rutina.activa, true), eq(schema.rutina.activo, true),
      lte(schema.rutina.proximo_disparo, now)))
    .all();

  let materializados = 0;
  const avisoIds: string[] = [];

  for (const r of rutinas) {
    if (!r.proximo_disparo) continue;
    let cursor: Date | null = r.proximo_disparo.getTime() < piso.getTime() ? piso : r.proximo_disparo;
    let guard = 0;
    while (cursor && cursor.getTime() <= now.getTime() && guard < 1000) {
      const fecha = cursor;
      db.transaction((tx) => {
        const nid = materializarEnTx(tx, r, fecha, now);
        if (nid) { materializados++; avisoIds.push(...idsDeAvisosDeEvento(tx, nid)); }
      });
      cursor = calcularProximoDisparo(defDeRutina(r), fecha);
      guard++;
    }
    const proxFutura = calcularProximoDisparo(defDeRutina(r), now);
    db.update(schema.rutina).set({ proximo_disparo: proxFutura, ...syncMeta(now) })
      .where(eq(schema.rutina.id, r.id)).run();
  }

  for (const id of avisoIds) { void despacharAviso(db, id); }
  return { materializados };
}
