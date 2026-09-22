import type { IpcMain } from 'electron';
import { eq, and, inArray, lte, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, getOriginId } from '@core/main';
import { calcularProximoDisparo, type FrecuenciaDef } from '../agenda/frecuencia';
import { completarEventoRutina } from '../agenda/motor-rutinas';
import { insertarAvisos, despacharAviso } from '../agenda/aviso-servicio';
import type { Canal } from '../agenda/canales/tipos';

type Db = BetterSQLite3Database<typeof schema>;

function syncMeta(now: Date) {
  return { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };
}

function requireUser() {
  const s = getSession();
  if (!s) throw new Error('UNAUTHENTICATED');
  return s;
}

function defDesde(p: {
  frecuencia_tipo: FrecuenciaDef['frecuencia_tipo']; intervalo?: number;
  dia_semana?: number | null; dia_mes?: number | null; hora?: string | null;
  fecha_inicio: Date; fecha_fin?: Date | null;
}): FrecuenciaDef {
  return {
    frecuencia_tipo: p.frecuencia_tipo, intervalo: p.intervalo ?? 1,
    dia_semana: p.dia_semana ?? null, dia_mes: p.dia_mes ?? null, hora: p.hora ?? null,
    fecha_inicio: p.fecha_inicio, fecha_fin: p.fecha_fin ?? null,
  };
}

// ── rutina.* ────────────────────────────────────────────────────────────────

export interface RutinaPayload {
  id?: string;
  nombre: string;
  descripcion?: string | null;
  frecuencia_tipo: FrecuenciaDef['frecuencia_tipo'];
  intervalo?: number;
  dia_semana?: number | null;
  dia_mes?: number | null;
  hora?: string | null;
  fecha_inicio: string | Date;
  fecha_fin?: string | Date | null;
  destinatario: { tipo: 'usuario' | 'rol'; id?: string; rol?: string };
  canal_in_app?: boolean;
  canal_email?: boolean;
}

export function rutinaCrearHandler(db: Db, p: RutinaPayload) {
  const s = requireUser();
  const now = new Date();
  const fechaInicio = new Date(p.fecha_inicio);
  const def = defDesde({ ...p, fecha_inicio: fechaInicio, fecha_fin: p.fecha_fin ? new Date(p.fecha_fin) : null });
  // Primera ocurrencia >= ahora; si fecha_inicio es futura, la propia fecha_inicio.
  const proximo = calcularProximoDisparo(def, new Date(now.getTime() - 1000)) ?? fechaInicio;
  const id = generateId();
  db.insert(schema.rutina).values({
    id, nombre: p.nombre, descripcion: p.descripcion ?? null,
    frecuencia_tipo: p.frecuencia_tipo, intervalo: p.intervalo ?? 1,
    dia_semana: p.dia_semana ?? null, dia_mes: p.dia_mes ?? null, hora: p.hora ?? null,
    fecha_inicio: fechaInicio, fecha_fin: def.fecha_fin, proximo_disparo: proximo,
    destinatario_tipo: p.destinatario.tipo,
    destinatario_usuario_id: p.destinatario.id ?? null, destinatario_rol: p.destinatario.rol ?? null,
    canal_in_app: p.canal_in_app ?? true, canal_email: p.canal_email ?? false,
    activa: true, activo: true,
    usuario_creacion_id: s.userId, fecha_creacion: now, ...syncMeta(now),
  }).run();
  return db.select().from(schema.rutina).where(eq(schema.rutina.id, id)).get();
}

export function rutinaEditarHandler(db: Db, p: RutinaPayload & { id: string }) {
  const s = requireUser();
  const now = new Date();
  const existing = db.select().from(schema.rutina).where(eq(schema.rutina.id, p.id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  const fechaInicio = new Date(p.fecha_inicio);
  const def = defDesde({ ...p, fecha_inicio: fechaInicio, fecha_fin: p.fecha_fin ? new Date(p.fecha_fin) : null });
  const proximo = calcularProximoDisparo(def, new Date(now.getTime() - 1000)) ?? fechaInicio;
  db.update(schema.rutina).set({
    nombre: p.nombre, descripcion: p.descripcion ?? null,
    frecuencia_tipo: p.frecuencia_tipo, intervalo: p.intervalo ?? 1,
    dia_semana: p.dia_semana ?? null, dia_mes: p.dia_mes ?? null, hora: p.hora ?? null,
    fecha_inicio: fechaInicio, fecha_fin: def.fecha_fin, proximo_disparo: proximo,
    destinatario_tipo: p.destinatario.tipo,
    destinatario_usuario_id: p.destinatario.id ?? null, destinatario_rol: p.destinatario.rol ?? null,
    canal_in_app: p.canal_in_app ?? true, canal_email: p.canal_email ?? false,
    usuario_modificacion_id: s.userId, fecha_actualizacion: now, ...syncMeta(now),
  }).where(eq(schema.rutina.id, p.id)).run();
  return db.select().from(schema.rutina).where(eq(schema.rutina.id, p.id)).get();
}

export function rutinaPausarHandler(db: Db, p: { id: string }) {
  const s = requireUser();
  const now = new Date();
  db.update(schema.rutina).set({ activa: false, usuario_modificacion_id: s.userId, fecha_actualizacion: now, ...syncMeta(now) })
    .where(eq(schema.rutina.id, p.id)).run();
  return { ok: true };
}

export function rutinaReanudarHandler(db: Db, p: { id: string }) {
  const s = requireUser();
  const now = new Date();
  const r = db.select().from(schema.rutina).where(eq(schema.rutina.id, p.id)).get();
  if (!r) throw new Error('NOT_FOUND');
  // Recalcula el puntero desde ahora (evita disparar toda la ventana en que estuvo pausada).
  const proximo = calcularProximoDisparo(defDesde({
    frecuencia_tipo: r.frecuencia_tipo, intervalo: r.intervalo, dia_semana: r.dia_semana,
    dia_mes: r.dia_mes, hora: r.hora, fecha_inicio: r.fecha_inicio, fecha_fin: r.fecha_fin,
  }), now);
  db.update(schema.rutina).set({ activa: true, proximo_disparo: proximo,
    usuario_modificacion_id: s.userId, fecha_actualizacion: now, ...syncMeta(now) })
    .where(eq(schema.rutina.id, p.id)).run();
  return { ok: true };
}

export function rutinaEliminarHandler(db: Db, p: { id: string }) {
  const s = requireUser();
  const now = new Date();
  db.update(schema.rutina).set({ activo: false, activa: false,
    usuario_modificacion_id: s.userId, fecha_actualizacion: now, ...syncMeta(now) })
    .where(eq(schema.rutina.id, p.id)).run();
  return { ok: true };
}

export function rutinaListHandler(db: Db, _p: unknown = {}) {
  requireUser();
  return db.select().from(schema.rutina)
    .where(eq(schema.rutina.activo, true))
    .orderBy(schema.rutina.nombre).all();
}

// ── agenda.* ────────────────────────────────────────────────────────────────

export interface EventoManualPayload {
  titulo: string;
  descripcion?: string | null;
  fecha: string | Date;
  destinatario?: { tipo: 'usuario' | 'rol'; id?: string; rol?: string };
  canal_in_app?: boolean;
  canal_email?: boolean;
  proveedor_id?: string | null;
  orden_compra_id?: string | null;
  producto_id?: string | null;
}

export function agendaCrearEventoHandler(db: Db, p: EventoManualPayload) {
  const s = requireUser();
  const now = new Date();
  const eventoId = generateId();
  const dest = p.destinatario ?? { tipo: 'usuario' as const, id: s.userId };
  const canales: Canal[] = [];
  if (p.canal_in_app ?? true) canales.push('in_app');
  if (p.canal_email) canales.push('email');

  db.transaction((tx) => {
    tx.insert(schema.agenda_evento).values({
      id: eventoId, origen: 'manual', rutina_id: null,
      titulo: p.titulo, descripcion: p.descripcion ?? null, fecha: new Date(p.fecha), estado: 'pendiente',
      destinatario_tipo: dest.tipo, destinatario_usuario_id: dest.id ?? null, destinatario_rol: dest.rol ?? null,
      canal_in_app: p.canal_in_app ?? true, canal_email: p.canal_email ?? false,
      proveedor_id: p.proveedor_id ?? null, orden_compra_id: p.orden_compra_id ?? null, producto_id: p.producto_id ?? null,
      activo: true, usuario_creacion_id: s.userId, fecha_creacion: now, ...syncMeta(now),
    }).run();
    insertarAvisos(tx, {
      origen_tipo: 'agenda_evento', origen_id: eventoId, agenda_evento_id: eventoId,
      titulo: p.titulo, cuerpo: p.descripcion ?? p.titulo,
      destinatario: dest, canales: canales.length ? canales : ['in_app'],
      dedupe_clave: `evento:${eventoId}`,
    }, now);
  });

  for (const a of db.select().from(schema.aviso).where(eq(schema.aviso.agenda_evento_id, eventoId)).all()) {
    void despacharAviso(db, a.id);
  }
  return db.select().from(schema.agenda_evento).where(eq(schema.agenda_evento.id, eventoId)).get();
}

export function agendaListarHandler(db: Db, _p: unknown = {}) {
  requireUser();
  // Trae todo lo activo ordenado por fecha; el filtrado por zona/estado/origen es client-side.
  return db.select().from(schema.agenda_evento)
    .where(eq(schema.agenda_evento.activo, true))
    .orderBy(schema.agenda_evento.fecha).all();
}

export function agendaCompletarHandler(db: Db, p: { id: string }) {
  const s = requireUser();
  completarEventoRutina(db, p.id, s.userId, new Date());   // sirve para rutina y manual
  return { ok: true };
}

export function agendaPosponerHandler(db: Db, p: { id: string; pospuesto_para: string | Date; nota?: string }) {
  const s = requireUser();
  const now = new Date();
  const nuevaFecha = new Date(p.pospuesto_para);
  db.update(schema.agenda_evento).set({
    estado: 'pospuesta', pospuesto_para: nuevaFecha, fecha: nuevaFecha, nota: p.nota ?? null,
    usuario_modificacion_id: s.userId, fecha_actualizacion: now, ...syncMeta(now),
  }).where(eq(schema.agenda_evento.id, p.id)).run();
  return { ok: true };
}

export function agendaDescartarHandler(db: Db, p: { id: string; nota?: string }) {
  const s = requireUser();
  const now = new Date();
  db.update(schema.agenda_evento).set({
    estado: 'descartada', nota: p.nota ?? null,
    usuario_modificacion_id: s.userId, fecha_actualizacion: now, ...syncMeta(now),
  }).where(eq(schema.agenda_evento.id, p.id)).run();
  return { ok: true };
}

// ── aviso.* ─────────────────────────────────────────────────────────────────

export function avisoListarHandler(db: Db, _p: unknown = {}) {
  requireUser();
  return db.select().from(schema.aviso).orderBy(desc(schema.aviso.generado_at)).all();
}

export async function avisoReintentarHandler(db: Db, p: { id: string }) {
  requireUser();
  db.update(schema.aviso).set({ estado: 'pendiente', proximo_intento_at: new Date() })
    .where(eq(schema.aviso.id, p.id)).run();
  await despacharAviso(db, p.id);
  return db.select().from(schema.aviso).where(eq(schema.aviso.id, p.id)).get();
}

export function avisoDescartarHandler(db: Db, p: { id: string }) {
  requireUser();
  db.update(schema.aviso).set({ estado: 'descartado' }).where(eq(schema.aviso.id, p.id)).run();
  return { ok: true };
}

export function avisoBadgeHandler(db: Db) {
  requireUser();
  const now = new Date();
  const atrasadas = db.select().from(schema.agenda_evento)
    .where(and(
      inArray(schema.agenda_evento.estado, ['pendiente', 'pospuesta']),
      lte(schema.agenda_evento.fecha, now),
      eq(schema.agenda_evento.activo, true),
    )).all().length;
  const avisos_fallidos = db.select().from(schema.aviso)
    .where(eq(schema.aviso.estado, 'fallido')).all().length;
  return { atrasadas, avisos_fallidos };
}

// ── Registro ──────────────────────────────────────────────────────────────

export function registerAgendaHandlers(ipcMain: IpcMain, db: Db) {
  ipcMain.handle('rutina:list',     (_e, p) => rutinaListHandler(db, p));
  ipcMain.handle('rutina:crear',    (_e, p) => rutinaCrearHandler(db, p));
  ipcMain.handle('rutina:editar',   (_e, p) => rutinaEditarHandler(db, p));
  ipcMain.handle('rutina:pausar',   (_e, p) => rutinaPausarHandler(db, p));
  ipcMain.handle('rutina:reanudar', (_e, p) => rutinaReanudarHandler(db, p));
  ipcMain.handle('rutina:eliminar', (_e, p) => rutinaEliminarHandler(db, p));

  ipcMain.handle('agenda:crearEvento', (_e, p) => agendaCrearEventoHandler(db, p));
  ipcMain.handle('agenda:listar',      (_e, p) => agendaListarHandler(db, p));
  ipcMain.handle('agenda:completar',   (_e, p) => agendaCompletarHandler(db, p));
  ipcMain.handle('agenda:posponer',    (_e, p) => agendaPosponerHandler(db, p));
  ipcMain.handle('agenda:descartar',   (_e, p) => agendaDescartarHandler(db, p));

  ipcMain.handle('aviso:listar',     (_e, p) => avisoListarHandler(db, p));
  ipcMain.handle('aviso:reintentar', (_e, p) => avisoReintentarHandler(db, p));
  ipcMain.handle('aviso:descartar',  (_e, p) => avisoDescartarHandler(db, p));
  ipcMain.handle('aviso:badge',      () => avisoBadgeHandler(db));
}
