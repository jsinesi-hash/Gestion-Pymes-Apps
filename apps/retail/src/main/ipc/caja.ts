import { eq, and, desc, asc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, getOriginId, verificarSupervisor, num, optStr, oneOf, id as vId } from '@core/main';
import { triggerAutoBackup } from '@core/main';
import { parametrosGetHandler } from '@core/main';
import { insertarAvisos, despacharAviso } from '../agenda/aviso-servicio';
import { construirComandoCierre } from './caja-cierre-aviso';

type Db = BetterSQLite3Database<typeof schema>;

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

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
  const monto_inicial = num(p['monto_inicial'], 'monto_inicial', { min: 0 });
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
    monto_inicial: monto_inicial,
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
  const monto = num(p['monto'], 'monto', { min: 0 });
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
    monto: monto,
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

export type ResumenCierre = {
  caja_id: string;
  monto_inicial: number;
  por_forma_pago: Array<{ forma_pago: string; ingresado: number; cantidad_operaciones: number }>;
  esperado_efectivo: number;
  ventas_count: number;
  total_ventas: number;
};

export function cajaCalcularCierreHandler(db: Db, payload: { caja_id: string }): ResumenCierre {
  const cajaRow = db.select().from(schema.caja)
    .where(eq(schema.caja.id, payload.caja_id))
    .get();
  if (!cajaRow) throw new Error('CAJA_NOT_FOUND');

  const movimientos = db.select().from(schema.movimiento_caja)
    .where(eq(schema.movimiento_caja.caja_id, payload.caja_id))
    .all();

  const byFP = new Map<string, { ingresado: number; cantidad_operaciones: number }>();
  let esperado_efectivo = cajaRow.monto_inicial;

  for (const mov of movimientos) {
    const fp = mov.forma_pago ?? 'efectivo';
    if (!byFP.has(fp)) byFP.set(fp, { ingresado: 0, cantidad_operaciones: 0 });
    const entry = byFP.get(fp)!;
    if (mov.tipo === 'ingreso') {
      entry.ingresado += mov.monto;
      entry.cantidad_operaciones += 1;
    }
    if (fp === 'efectivo') {
      esperado_efectivo += mov.tipo === 'ingreso' ? mov.monto : -mov.monto;
    }
  }

  const ventas = db.select({ total: schema.venta.total }).from(schema.venta)
    .where(and(eq(schema.venta.caja_id, payload.caja_id), eq(schema.venta.estado, 'confirmada')))
    .all();

  return {
    caja_id: payload.caja_id,
    monto_inicial: cajaRow.monto_inicial,
    por_forma_pago: Array.from(byFP.entries()).map(([forma_pago, data]) => ({ forma_pago, ...data })),
    esperado_efectivo,
    ventas_count: ventas.length,
    total_ventas: ventas.reduce((s, v) => s + v.total, 0),
  };
}

export function cajaCerrarHandler(
  db: Db,
  payload: unknown,
) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const caja_id = vId(p['caja_id'], 'caja_id');
  const monto_contado = num(p['monto_contado'], 'monto_contado', { min: 0 });
  const observaciones = optStr(p['observaciones'], 'observaciones');
  const supervisor_credenciales = p['supervisor_credenciales'] as { nombre_usuario: string; password: string } | undefined;

  const cajaRow = db.select().from(schema.caja)
    .where(eq(schema.caja.id, caja_id))
    .get();
  if (!cajaRow) throw new Error('CAJA_NOT_FOUND');
  if (cajaRow.estado !== 'abierta') throw new Error('CAJA_CERRADA');

  const resumen = cajaCalcularCierreHandler(db, { caja_id: caja_id });
  const diferencia = monto_contado - resumen.esperado_efectivo;

  const umbralRow = db.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'umbral_diferencia_caja'))
    .get();
  const umbral = Number.parseFloat(umbralRow?.valor ?? '50000');

  let supervisorId: string | null = null;
  if (Math.abs(diferencia) > umbral) {
    if (!supervisor_credenciales) throw new Error('DIFERENCIA_REQUIERE_AUTORIZACION');
    supervisorId = verificarSupervisor(db, supervisor_credenciales);
  }

  const now = new Date();
  const cmd = construirComandoCierre(db, {
    cajaRow, resumen, diferencia,
    monto_contado: monto_contado,
    usuarioCierreId: session.userId, now,
  });
  const avisoIds = db.transaction((tx) => {
    tx.update(schema.caja).set({
      estado: 'cerrada',
      fecha_cierre: now,
      monto_esperado: resumen.esperado_efectivo,
      monto_contado: monto_contado,
      diferencia,
      usuario_cierre_id: session.userId,
      supervisor_autorizacion_id: supervisorId,
      observaciones: observaciones ?? cajaRow.observaciones,
      version: cajaRow.version + 1,
      updated_at: now,
      sync_state: 'pending',
    }).where(eq(schema.caja.id, caja_id)).run();
    // ADR-047 §6: el INSERT de aviso va DENTRO de la transaccion del hecho de negocio.
    return insertarAvisos(tx, cmd, now);
  });
  // Envio best-effort FUERA de la transaccion; no bloquea el cierre.
  for (const aid of avisoIds) { void despacharAviso(db, aid); }

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
    monto_inicial:  schema.caja.monto_inicial,
    monto_esperado: schema.caja.monto_esperado,
    monto_contado:  schema.caja.monto_contado,
    diferencia:     schema.caja.diferencia,
  })
    .from(schema.caja)
    .leftJoin(schema.usuario, eq(schema.usuario.id, schema.caja.usuario_id))
    .orderBy(asc(schema.caja.fecha_apertura))
    .all();

  return rows.map((r, i) => ({ turno: i + 1, ...r }));
}

export function registerCajaHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('caja:getActiva',        async ()       => cajaGetActivaHandler(db));
  ipcMain.handle('caja:abrir',            async (_e, p)  => cajaAbrirHandler(db, p));
  ipcMain.handle('caja:addMovimiento',    async (_e, p)  => cajaAddMovimientoHandler(db, p));
  ipcMain.handle('caja:calcularCierre',   async (_e, p)  => cajaCalcularCierreHandler(db, p));
  ipcMain.handle('caja:cerrar', async (_e, p) => {
    const result = cajaCerrarHandler(db, p);
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
