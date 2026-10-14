import { eq, desc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import {
  getSession, getOriginId, requirePermission, verificarSupervisor,
  str, num, int, optStr, optId, arr, id as vId,
} from '@core/main';
import * as schema from '../db/schema';
import { costoPromedioEntrada } from '../domain/costo';

type Db = BetterSQLite3Database<typeof schema>;

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

/** Correlativo dentro de la transacción de creación (mismo patrón que produccion.ts). */
function nextNumeroCompra(tx: Db, terminal: string): string {
  const clave = `compra_correlativo_${terminal}`;
  const param = tx.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get();
  const correlativo = (param ? Number.parseInt(param.valor) : 0) + 1;
  if (param) {
    tx.update(schema.parametros_sistema).set({ valor: String(correlativo), actualizado_en: new Date() })
      .where(eq(schema.parametros_sistema.clave, clave)).run();
  } else {
    tx.insert(schema.parametros_sistema).values({
      clave, valor: String(correlativo), tipo: 'number',
      descripcion: 'Correlativo de números de compra', actualizado_en: new Date(),
    }).run();
  }
  return `CP-${terminal}-${String(correlativo).padStart(6, '0')}`;
}

export function compraListHandler(db: Db) {
  requireSession();
  const filas = db.select({
    compra: schema.compra, proveedor_nombre: schema.proveedor.razon_social,
  }).from(schema.compra)
    .leftJoin(schema.proveedor, eq(schema.compra.proveedor_id, schema.proveedor.id))
    .orderBy(desc(schema.compra.fecha), desc(schema.compra.numero)).all();
  return filas.map((f) => ({ ...f.compra, proveedor_nombre: f.proveedor_nombre }));
}

export function compraGetHandler(db: Db, payload: { id: string }) {
  requireSession();
  const compra = db.select().from(schema.compra).where(eq(schema.compra.id, payload.id)).get();
  if (!compra) return null;
  const items = db.select().from(schema.compra_item).where(eq(schema.compra_item.compra_id, compra.id)).all();
  return { ...compra, items };
}

export function compraCrearHandler(db: Db, payload: unknown) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_proveedor_id = optId(p['proveedor_id'], 'proveedor_id');
  const v_comprobante = optStr(p['comprobante'], 'comprobante', 60);
  const v_observaciones = optStr(p['observaciones'], 'observaciones', 500);
  const v_items = arr(p['items'], 'items', (x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    return {
      articulo_id: vId(o['articulo_id'], 'items.articulo_id'),
      cantidad: num(o['cantidad'], 'items.cantidad', { min: 0.001 }),
      costo_unitario_centavos: int(o['costo_unitario_centavos'], 'items.costo_unitario_centavos', { min: 0 }),
    };
  });
  if (v_items.length === 0) throw new Error('SIN_LINEAS');

  if (v_proveedor_id) {
    const prov = db.select().from(schema.proveedor).where(eq(schema.proveedor.id, v_proveedor_id)).get();
    if (!prov) throw new Error('NOT_FOUND');
  }

  const now = new Date();
  const terminal = getOriginId();
  const sync = { version: 1 as const, origin_id: terminal, sync_state: 'pending' as const, updated_at: now };

  return db.transaction((tx) => {
    const numero = nextNumeroCompra(tx, terminal);
    const compraId = generateId();
    let total = 0;
    const lineas: { articulo_id: string; descripcion: string; cantidad: number; costo: number; subtotal: number }[] = [];

    // Las entradas se aplican en orden, leyendo el estado vigente en cada paso: si un artículo
    // repite en la compra, el costo promedio pondera acumulativamente.
    for (const it of v_items) {
      const art = tx.select().from(schema.articulo).where(eq(schema.articulo.id, it.articulo_id)).get();
      if (!art) throw new Error('NOT_FOUND');
      const ex = tx.select().from(schema.existencia_articulo)
        .where(eq(schema.existencia_articulo.articulo_id, it.articulo_id)).get();
      if (!ex) throw new Error('NOT_FOUND');
      const stock_resultante = ex.stock + it.cantidad;
      const subtotal = Math.round(it.cantidad * it.costo_unitario_centavos);
      total += subtotal;
      lineas.push({ articulo_id: art.id, descripcion: art.nombre, cantidad: it.cantidad, costo: it.costo_unitario_centavos, subtotal });

      tx.insert(schema.movimiento_articulo).values({
        id: generateId(), articulo_id: art.id, tipo: 'entrada', motivo: 'compra',
        cantidad: it.cantidad, stock_resultante, costo_unitario_centavos: it.costo_unitario_centavos,
        referencia_tipo: 'compra', referencia_id: compraId, usuario_id: session.userId, fecha: now,
        observaciones: v_comprobante ?? null, ...sync,
      }).run();
      tx.update(schema.existencia_articulo).set({
        stock: stock_resultante, ultima_fecha_movimiento: now,
        version: ex.version + 1, sync_state: 'pending', updated_at: now,
      }).where(eq(schema.existencia_articulo.articulo_id, art.id)).run();
      tx.update(schema.articulo).set({
        costo_promedio_centavos: costoPromedioEntrada(ex.stock, art.costo_promedio_centavos, it.cantidad, it.costo_unitario_centavos),
        version: art.version + 1, sync_state: 'pending', updated_at: now,
      }).where(eq(schema.articulo.id, art.id)).run();
    }

    tx.insert(schema.compra).values({
      id: compraId, numero, proveedor_id: v_proveedor_id ?? null, comprobante: v_comprobante ?? null,
      total_centavos: total, estado: 'confirmada', fecha: now, usuario_id: session.userId,
      observaciones: v_observaciones ?? null, ...sync,
    }).run();
    for (const l of lineas) {
      tx.insert(schema.compra_item).values({
        id: generateId(), compra_id: compraId, articulo_id: l.articulo_id, descripcion: l.descripcion,
        cantidad: l.cantidad, costo_unitario_centavos: l.costo, subtotal_centavos: l.subtotal, ...sync,
      }).run();
    }
    return tx.select().from(schema.compra).where(eq(schema.compra.id, compraId)).get()!;
  });
}

export function compraAnularHandler(db: Db, payload: unknown) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = vId(p['id'], 'id');
  const v_motivo = str(p['motivo'], 'motivo', { max: 300 });
  const cred = p['supervisor_credenciales'] as { nombre_usuario: string; password: string } | undefined;
  if (!cred) throw new Error('ANULACION_REQUIERE_AUTORIZACION');
  verificarSupervisor(db, cred);

  const compra = db.select().from(schema.compra).where(eq(schema.compra.id, v_id)).get();
  if (!compra) throw new Error('NOT_FOUND');
  if (compra.estado === 'anulada') throw new Error('YA_ANULADA');

  const now = new Date();
  const terminal = getOriginId();
  const sync = { version: 1 as const, origin_id: terminal, sync_state: 'pending' as const, updated_at: now };
  const movs = db.select().from(schema.movimiento_articulo)
    .where(eq(schema.movimiento_articulo.referencia_id, v_id)).all()
    .filter((m) => m.motivo === 'compra');

  db.transaction((tx) => {
    for (const mov of movs) {
      const art = tx.select().from(schema.articulo).where(eq(schema.articulo.id, mov.articulo_id)).get()!;
      const ex = tx.select().from(schema.existencia_articulo)
        .where(eq(schema.existencia_articulo.articulo_id, mov.articulo_id)).get()!;
      const stock_resultante = ex.stock - mov.cantidad;
      // Política de stock R2: la reventa bloquea; el granel puede quedar en negativo.
      if (art.bloquea_sin_stock && stock_resultante < 0) throw new Error(`STOCK_INSUFICIENTE:${art.nombre}`);
      tx.insert(schema.movimiento_articulo).values({
        id: generateId(), articulo_id: mov.articulo_id, tipo: 'salida', motivo: 'compra_anulacion',
        cantidad: -mov.cantidad, stock_resultante, costo_unitario_centavos: mov.costo_unitario_centavos,
        referencia_tipo: 'compra', referencia_id: v_id, usuario_id: session.userId, fecha: now,
        observaciones: v_motivo, ...sync,
      }).run();
      tx.update(schema.existencia_articulo).set({
        stock: stock_resultante, ultima_fecha_movimiento: now,
        version: ex.version + 1, sync_state: 'pending', updated_at: now,
      }).where(eq(schema.existencia_articulo.articulo_id, mov.articulo_id)).run();
      // El costo promedio no se revierte (igual que producción y el resto de la app).
    }
    tx.update(schema.compra).set({
      estado: 'anulada', motivo_anulacion: v_motivo,
      version: compra.version + 1, sync_state: 'pending', updated_at: now,
    }).where(eq(schema.compra.id, v_id)).run();
  });

  return db.select().from(schema.compra).where(eq(schema.compra.id, v_id)).get()!;
}

export function registerCompraHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('compra.registrar');
  ipcMain.handle('compra:list', async () => compraListHandler(db));
  ipcMain.handle('compra:get', async (_e, p) => compraGetHandler(db, p));
  ipcMain.handle('compra:crear', guard(async (_e, p) => compraCrearHandler(db, p)));
  ipcMain.handle('compra:anular', guard(async (_e, p) => compraAnularHandler(db, p)));
}
