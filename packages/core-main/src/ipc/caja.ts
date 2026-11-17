import { eq, and, desc, asc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '@core/db';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { verificarAutorizacion } from '../auth/verificarAutorizacion';
import { centavos, optStr, oneOf, id as vId } from '../validation/core';
import { triggerAutoBackup } from './backup';
import { parametrosGetHandler } from './parametros';

import { requireSession } from '../auth/guard';
import { leerParametroNumero } from '../configuracion';
type Db = BetterSQLite3Database<typeof schema>;

export type CajaRow = typeof schema.caja.$inferSelect;
export type CierreResumen = ReturnType<typeof cajaCalcularCierreHandler>;
export type CajaCierreCtx = {
  db: Db;
  tx: Parameters<Parameters<Db['transaction']>[0]>[0];
  cajaRow: CajaRow;
  resumen: CierreResumen;
  diferencia_centavos: number;
  monto_contado_centavos: number;
  usuarioCierreId: string;
  now: Date;
};
/** Corre DENTRO de la transacción del cierre. Puede devolver un post-commit (best-effort). */
export type OnCajaCerrada = (ctx: CajaCierreCtx) => (() => void) | void;
export type CajaHooks = { onCajaCerrada?: OnCajaCerrada };

export function cajaGetActivaHandler(db: Db) {
  const session = requireSession();
  return db.select().from(schema.caja)
    .where(and(
      eq(schema.caja.usuario_id, session.userId),
      eq(schema.caja.estado, 'abierta'),
    ))
    .get() ?? null;
}

export function cajaAbrirHandler(
  db: Db,
  payload: unknown,
) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  // ADR-157: la UI manda centavos.
  const monto_inicial_centavos = centavos(p['monto_inicial_centavos'], 'monto_inicial_centavos');
  const observaciones = optStr(p['observaciones'], 'observaciones');

  const existing = db.select({ id: schema.caja.id }).from(schema.caja)
    .where(and(
      eq(schema.caja.usuario_id, session.userId),
      eq(schema.caja.estado, 'abierta'),
    ))
    .get();
  if (existing) throw new Error('ALREADY_OPEN');

  const now = new Date();
  const id = generateId();
  db.insert(schema.caja).values({
    id,
    usuario_id: session.userId,
    fecha_apertura: now,
    monto_inicial_centavos,
    estado: 'abierta',
    observaciones: observaciones ?? null,
    version: 1,
    origin_id: getOriginId(),
    sync_state: 'pending',
    updated_at: now,
  }).run();

  return db.select().from(schema.caja).where(eq(schema.caja.id, id)).get()!;
}

export function cajaAddMovimientoHandler(
  db: Db,
  payload: unknown,
) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const caja_id = vId(p['caja_id'], 'caja_id');
  const tipo = oneOf(p['tipo'], 'tipo', ['ingreso', 'egreso'] as const);
  const motivo = oneOf(p['motivo'], 'motivo', ['retiro', 'gasto', 'aporte'] as const);
  const monto_centavos = centavos(p['monto_centavos'], 'monto_centavos');
  const forma_pago = optStr(p['forma_pago'], 'forma_pago');
  const observaciones = optStr(p['observaciones'], 'observaciones');

  const cajaRow = db.select().from(schema.caja)
    .where(eq(schema.caja.id, caja_id))
    .get();
  if (!cajaRow) throw new Error('CAJA_NOT_FOUND');
  if (cajaRow.estado !== 'abierta') throw new Error('CAJA_CERRADA');

  const now = new Date();
  const id = generateId();
  db.insert(schema.movimiento_caja).values({
    id,
    caja_id: caja_id,
    tipo: tipo,
    motivo: motivo,
    monto_centavos,
    forma_pago: forma_pago ?? 'efectivo',
    referencia_tipo: 'manual',
    referencia_id: id,
    usuario_id: session.userId,
    fecha: now,
    observaciones: observaciones ?? null,
    version: 1,
    origin_id: getOriginId(),
    sync_state: 'pending',
    updated_at: now,
  }).run();

  return db.select().from(schema.movimiento_caja)
    .where(eq(schema.movimiento_caja.id, id))
    .get()!;
}

/** ADR-157: todos los montos en centavos. */
export type ResumenCierre = {
  caja_id: string;
  monto_inicial_centavos: number;
  por_forma_pago: Array<{ forma_pago: string; ingresado_centavos: number; cantidad_operaciones: number }>;
  esperado_efectivo_centavos: number;
  ventas_count: number;
  total_ventas_centavos: number;
};

export function cajaCalcularCierreHandler(db: Db, payload: { caja_id: string }): ResumenCierre {
  const cajaRow = db.select().from(schema.caja)
    .where(eq(schema.caja.id, payload.caja_id))
    .get();
  if (!cajaRow) throw new Error('CAJA_NOT_FOUND');

  const movimientos = db.select().from(schema.movimiento_caja)
    .where(eq(schema.movimiento_caja.caja_id, payload.caja_id))
    .all();

  const byFP = new Map<string, { ingresado_centavos: number; cantidad_operaciones: number }>();
  let esperado_efectivo_centavos = cajaRow.monto_inicial_centavos;

  for (const mov of movimientos) {
    const fp = mov.forma_pago ?? 'efectivo';
    if (!byFP.has(fp)) byFP.set(fp, { ingresado_centavos: 0, cantidad_operaciones: 0 });
    const entry = byFP.get(fp)!;
    if (mov.tipo === 'ingreso') {
      entry.ingresado_centavos += mov.monto_centavos;
      entry.cantidad_operaciones += 1;
    }
    if (fp === 'efectivo') {
      esperado_efectivo_centavos += mov.tipo === 'ingreso' ? mov.monto_centavos : -mov.monto_centavos;
    }
  }

  const ventas = db.select({ total: schema.venta.total }).from(schema.venta)
    .where(and(eq(schema.venta.caja_id, payload.caja_id), eq(schema.venta.estado, 'confirmada')))
    .all();

  return {
    caja_id: payload.caja_id,
    monto_inicial_centavos: cajaRow.monto_inicial_centavos,
    por_forma_pago: Array.from(byFP.entries()).map(([forma_pago, data]) => ({ forma_pago, ...data })),
    esperado_efectivo_centavos,
    ventas_count: ventas.length,
    // venta.total sigue en pesos hasta PR-C2: se convierte por venta para no arrastrar float.
    total_ventas_centavos: ventas.reduce((s, v) => s + Math.round(v.total * 100), 0),
  };
}

export function cajaCerrarHandler(
  db: Db,
  payload: unknown,
  hooks: CajaHooks = {},
) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const caja_id = vId(p['caja_id'], 'caja_id');
  const monto_contado_centavos = centavos(p['monto_contado_centavos'], 'monto_contado_centavos');
  const observaciones = optStr(p['observaciones'], 'observaciones');
  const supervisor_credenciales = p['supervisor_credenciales'] as { nombre_usuario: string; password: string } | undefined;

  const cajaRow = db.select().from(schema.caja)
    .where(eq(schema.caja.id, caja_id))
    .get();
  if (!cajaRow) throw new Error('CAJA_NOT_FOUND');
  if (cajaRow.estado !== 'abierta') throw new Error('CAJA_CERRADA');

  const resumen = cajaCalcularCierreHandler(db, { caja_id: caja_id });
  const diferencia_centavos = monto_contado_centavos - resumen.esperado_efectivo_centavos;

  // ADR-157: el umbral se guarda en centavos (antes, 50000 comparado contra pesos = $ 50.000).
  const umbral = leerParametroNumero(db, 'umbral_diferencia_caja_centavos', 5_000_000);

  let supervisorId: string | null = null;
  if (Math.abs(diferencia_centavos) > umbral) {
    if (!supervisor_credenciales) throw new Error('DIFERENCIA_REQUIERE_AUTORIZACION');
    supervisorId = verificarAutorizacion(db, supervisor_credenciales, 'caja.autorizar_diferencia');
  }

  const now = new Date();
  const postCommit = db.transaction((tx) => {
    tx.update(schema.caja).set({
      estado: 'cerrada',
      fecha_cierre: now,
      monto_esperado_centavos: resumen.esperado_efectivo_centavos,
      monto_contado_centavos,
      diferencia_centavos,
      usuario_cierre_id: session.userId,
      supervisor_autorizacion_id: supervisorId,
      observaciones: observaciones ?? cajaRow.observaciones,
      version: cajaRow.version + 1,
      updated_at: now,
      sync_state: 'pending',
    }).where(eq(schema.caja.id, caja_id)).run();
    // El hook corre DENTRO de la transacción del cierre (p. ej. Retail inserta el aviso,
    // ADR-047 §6): si lanza, el cierre se revierte.
    return hooks.onCajaCerrada?.({
      db, tx, cajaRow, resumen, diferencia_centavos, monto_contado_centavos,
      usuarioCierreId: session.userId, now,
    });
  });
  // Post-commit best-effort FUERA de la transacción (p. ej. despacho del aviso).
  if (postCommit) postCommit();

  return db.select().from(schema.caja).where(eq(schema.caja.id, caja_id)).get()!;
}

export function cajaListMovimientosHandler(db: Db, payload: { caja_id: string }) {
  return db.select().from(schema.movimiento_caja)
    .where(eq(schema.movimiento_caja.caja_id, payload.caja_id))
    .orderBy(desc(schema.movimiento_caja.fecha))
    .all();
}

export function cajaArqueosQueryAll(db: Db) {
  const rows = db.select({
    cajero_nombre:  schema.usuario.nombre_completo,
    fecha_apertura: schema.caja.fecha_apertura,
    fecha_cierre:   schema.caja.fecha_cierre,
    monto_inicial_centavos:  schema.caja.monto_inicial_centavos,
    monto_esperado_centavos: schema.caja.monto_esperado_centavos,
    monto_contado_centavos:  schema.caja.monto_contado_centavos,
    diferencia_centavos:     schema.caja.diferencia_centavos,
  })
    .from(schema.caja)
    .leftJoin(schema.usuario, eq(schema.usuario.id, schema.caja.usuario_id))
    .orderBy(asc(schema.caja.fecha_apertura))
    .all();

  return rows.map((r, i) => ({ turno: i + 1, ...r }));
}

export function registerCajaHandlers(ipcMain: IpcMain, db: Db, hooks: CajaHooks = {}): void {
  ipcMain.handle('caja:getActiva',        async ()       => cajaGetActivaHandler(db));
  ipcMain.handle('caja:abrir',            async (_e, p)  => cajaAbrirHandler(db, p));
  ipcMain.handle('caja:addMovimiento',    async (_e, p)  => cajaAddMovimientoHandler(db, p));
  ipcMain.handle('caja:calcularCierre',   async (_e, p)  => cajaCalcularCierreHandler(db, p));
  ipcMain.handle('caja:cerrar', async (_e, p) => {
    const result = cajaCerrarHandler(db, p, hooks);
    const autoHabilitado = parametrosGetHandler(db, { clave: 'backup_auto_habilitado' });
    const destino = parametrosGetHandler(db, { clave: 'backup_destino_local' });
    if (autoHabilitado === 'true' && destino) {
      triggerAutoBackup(db, { appVersion: '1.0.0', sucursalId: 'local', destino })
        .catch(e => console.error('[backup-auto]', e));
    }
    return result;
  });
  ipcMain.handle('caja:listMovimientos',  async (_e, p)  => cajaListMovimientosHandler(db, p));
}
