import { eq, desc, asc, sql, and } from 'drizzle-orm';
import { generateId, nombreCompletoCliente } from '@ferreteria/shared';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getSession, getOriginId, requirePermission, id, centavos, oneOf, optStr } from '@core/main';
import { cajaGetActivaHandler } from './caja';

type Db = BetterSQLite3Database<typeof schema>;

function requireSession() {
  const s = getSession();
  if (!s) throw new Error('UNAUTHENTICATED');
  return s;
}

export function ctacteListHandler(db: Db) {
  requireSession();
  const rows = db
    .select({
      id:                      schema.cuenta_corriente_cliente.id,
      cliente_id:              schema.cuenta_corriente_cliente.cliente_id,
      saldo_centavos:          schema.cuenta_corriente_cliente.saldo_centavos,
      limite_credito_centavos: schema.cuenta_corriente_cliente.limite_credito_centavos,
      nombre:                  schema.cliente.nombre,
      apellido:                schema.cliente.apellido,
      tipo_documento:          schema.cliente.tipo_documento,
      numero_documento:        schema.cliente.numero_documento,
    })
    .from(schema.cuenta_corriente_cliente)
    .innerJoin(schema.cliente, eq(schema.cuenta_corriente_cliente.cliente_id, schema.cliente.id))
    .where(and(
      eq(schema.cuenta_corriente_cliente.activo, true),
      eq(schema.cliente.activo, true),
    ))
    .orderBy(
      desc(sql<number>`CASE WHEN ${schema.cuenta_corriente_cliente.limite_credito_centavos} > 0 AND ${schema.cuenta_corriente_cliente.saldo_centavos} > ${schema.cuenta_corriente_cliente.limite_credito_centavos} THEN 1 ELSE 0 END`),
      asc(schema.cliente.nombre),
      asc(schema.cliente.apellido),
    )
    .all();
  return rows.map(r => ({ ...r, nombre_completo: nombreCompletoCliente(r) }));
}

export function ctacteGetByClienteHandler(db: Db, clienteId: string) {
  requireSession();
  const cuenta = db.select().from(schema.cuenta_corriente_cliente)
    .where(eq(schema.cuenta_corriente_cliente.cliente_id, clienteId))
    .get();
  if (!cuenta) throw new Error('NOT_FOUND');

  const movimientos = db.select({
    id:                        schema.movimiento_cuenta_corriente.id,
    tipo:                      schema.movimiento_cuenta_corriente.tipo,
    motivo:                    schema.movimiento_cuenta_corriente.motivo,
    monto_centavos:            schema.movimiento_cuenta_corriente.monto_centavos,
    saldo_resultante_centavos: schema.movimiento_cuenta_corriente.saldo_resultante_centavos,
    fecha:                     schema.movimiento_cuenta_corriente.fecha,
    observaciones:             schema.movimiento_cuenta_corriente.observaciones,
    usuario_id:                schema.movimiento_cuenta_corriente.usuario_id,
    nombre_usuario:            schema.usuario.nombre_completo,
  })
    .from(schema.movimiento_cuenta_corriente)
    .leftJoin(schema.usuario, eq(schema.movimiento_cuenta_corriente.usuario_id, schema.usuario.id))
    .where(eq(schema.movimiento_cuenta_corriente.cuenta_id, cuenta.id))
    .orderBy(
      desc(schema.movimiento_cuenta_corriente.fecha),
      desc(sql<number>`movimiento_cuenta_corriente.rowid`),
    )
    .all();

  return { cuenta, movimientos };
}

export function ctacteSetLimiteHandler(db: Db, payload: unknown) {
  requireSession();

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_cuentaId = id(p['cuentaId'], 'cuentaId');
  const v_limite_centavos = centavos(p['limite_centavos'], 'limite_centavos');

  const now = new Date();
  const cuenta = db.select({ id: schema.cuenta_corriente_cliente.id })
    .from(schema.cuenta_corriente_cliente)
    .where(eq(schema.cuenta_corriente_cliente.id, v_cuentaId))
    .get();
  if (!cuenta) throw new Error('NOT_FOUND');

  db.update(schema.cuenta_corriente_cliente)
    .set({
      limite_credito_centavos: v_limite_centavos,
      version: 1,
      origin_id: getOriginId(),
      sync_state: 'pending',
      updated_at: now,
    })
    .where(eq(schema.cuenta_corriente_cliente.id, v_cuentaId))
    .run();
  return { ok: true };
}

export function ctacteRegistrarSaldoInicialHandler(db: Db, payload: unknown) {
  const session = requireSession();

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_cuentaId = id(p['cuentaId'], 'cuentaId');
  const v_monto_centavos = centavos(p['monto_centavos'], 'monto_centavos');
  const v_tipo = oneOf(p['tipo'], 'tipo', ['cargo', 'pago'] as const);

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  const cuenta = db.select().from(schema.cuenta_corriente_cliente)
    .where(eq(schema.cuenta_corriente_cliente.id, v_cuentaId))
    .get();
  if (!cuenta) throw new Error('NOT_FOUND');

  const movExistente = db.select({ id: schema.movimiento_cuenta_corriente.id })
    .from(schema.movimiento_cuenta_corriente)
    .where(eq(schema.movimiento_cuenta_corriente.cuenta_id, v_cuentaId))
    .get();
  if (movExistente) throw new Error('CCC_YA_TIENE_MOVIMIENTOS');

  const delta = v_tipo === 'cargo' ? v_monto_centavos : -v_monto_centavos;
  const nuevo_saldo = cuenta.saldo_centavos + delta;

  return db.transaction((tx) => {
    tx.insert(schema.movimiento_cuenta_corriente).values({
      id: generateId(),
      cuenta_id: v_cuentaId,
      tipo: v_tipo,
      motivo: 'saldo_inicial',
      monto_centavos: v_monto_centavos,
      saldo_resultante_centavos: nuevo_saldo,
      usuario_id: session.userId,
      fecha: now,
      observaciones: null,
      ...sync,
    }).run();

    tx.update(schema.cuenta_corriente_cliente)
      .set({ saldo_centavos: nuevo_saldo, fecha_ultimo_movimiento: now, ...sync })
      .where(eq(schema.cuenta_corriente_cliente.id, v_cuentaId))
      .run();

    return { saldo_centavos: nuevo_saldo };
  });
}

export function ctacteRegistrarCobroHandler(db: Db, payload: unknown) {
  const session = requireSession();

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_cuentaId = id(p['cuentaId'], 'cuentaId');
  const v_monto_centavos = centavos(p['monto_centavos'], 'monto_centavos');
  const v_forma_pago = oneOf(p['forma_pago'], 'forma_pago', ['efectivo', 'transferencia'] as const);
  const v_observaciones = optStr(p['observaciones'], 'observaciones', 1000);

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  return db.transaction((tx) => {
    const cuenta = tx.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.id, v_cuentaId))
      .get();
    if (!cuenta) throw new Error('NOT_FOUND');

    const nuevo_saldo = cuenta.saldo_centavos - v_monto_centavos;

    const movId = generateId();
    tx.insert(schema.movimiento_cuenta_corriente).values({
      id: movId,
      cuenta_id: v_cuentaId,
      tipo: 'pago',
      motivo: 'cobro',
      monto_centavos: v_monto_centavos,
      saldo_resultante_centavos: nuevo_saldo,
      usuario_id: session.userId,
      fecha: now,
      observaciones: v_observaciones ?? null,
      ...sync,
    }).run();

    tx.update(schema.cuenta_corriente_cliente)
      .set({ saldo_centavos: nuevo_saldo, fecha_ultimo_movimiento: now, ...sync })
      .where(eq(schema.cuenta_corriente_cliente.id, v_cuentaId))
      .run();

    if (v_forma_pago === 'efectivo') {
      const caja = cajaGetActivaHandler(db);
      if (!caja) throw new Error('CAJA_NO_ABIERTA');

      tx.insert(schema.movimiento_caja).values({
        id: generateId(),
        caja_id: caja.id,
        tipo: 'ingreso',
        motivo: 'cobro_cta_cte',
        monto: v_monto_centavos / 100,  // real ARS, not centavos
        forma_pago: 'efectivo',
        referencia_tipo: 'movimiento_cc',
        referencia_id: movId,
        usuario_id: session.userId,
        fecha: now,
        observaciones: v_observaciones ?? null,
        ...sync,
      }).run();
    }

    return { saldo_centavos: nuevo_saldo };
  });
}

/** Used by the export module */
export function ctacteQueryAll(db: Db) {
  return db.select({
    nombre:          schema.cliente.nombre,
    apellido:        schema.cliente.apellido,
    tipo_documento:  schema.cliente.tipo_documento,
    numero_documento: schema.cliente.numero_documento,
    saldo:           sql<number>`CAST(${schema.cuenta_corriente_cliente.saldo_centavos} AS REAL) / 100`,
    limite_credito:  sql<number>`CAST(${schema.cuenta_corriente_cliente.limite_credito_centavos} AS REAL) / 100`,
  })
    .from(schema.cuenta_corriente_cliente)
    .innerJoin(schema.cliente, eq(schema.cuenta_corriente_cliente.cliente_id, schema.cliente.id))
    .where(and(
      eq(schema.cuenta_corriente_cliente.activo, true),
      eq(schema.cliente.activo, true),
    ))
    .orderBy(asc(schema.cliente.nombre), asc(schema.cliente.apellido))
    .all();
}

export function registerCtaCteHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('ctacte.cobrar');
  ipcMain.handle('ctacte:list',                  guard(async ()               => ctacteListHandler(db)));
  ipcMain.handle('ctacte:getByCliente',          guard(async (_e, clienteId) => ctacteGetByClienteHandler(db, clienteId as string)));
  ipcMain.handle('ctacte:setLimite',             guard(async (_e, p)         => ctacteSetLimiteHandler(db, p)));
  ipcMain.handle('ctacte:registrarSaldoInicial', guard(async (_e, p)         => ctacteRegistrarSaldoInicialHandler(db, p)));
  ipcMain.handle('ctacte:registrarCobro',        guard(async (_e, p)         => ctacteRegistrarCobroHandler(db, p)));
}
