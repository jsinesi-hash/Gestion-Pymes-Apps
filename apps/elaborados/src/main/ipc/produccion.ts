import { eq, desc } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import { getOriginId, requirePermission, verificarSupervisor, str, num, optStr, arr, id as vId, requireSession } from '@core/main';
import * as schema from '../db/schema';
import { escalarReceta } from '../domain/receta';
import { costoDeLote, costoPromedioEntrada } from '../domain/costo';

type Db = BetterSQLite3Database<typeof schema>;

/**
 * Lee e incrementa produccion_correlativo_<terminal> dentro de la transaccion de creacion, para
 * que un throw posterior (p. ej. STOCK_INSUFICIENTE) no "queme" un numero sin producir nada.
 * Mismo patron que siguienteNumeroInterno (@core/main, venta) / nextNumeroRemitoAtomico (remito.ts).
 */
function nextNumeroProduccion(tx: Db, terminal: string): string {
  const clave = `produccion_correlativo_${terminal}`;
  const param = tx.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave)).get();
  const correlativo = (param ? Number.parseInt(param.valor) : 0) + 1;
  if (param) {
    tx.update(schema.parametros_sistema).set({ valor: String(correlativo), actualizado_en: new Date() })
      .where(eq(schema.parametros_sistema.clave, clave)).run();
  } else {
    tx.insert(schema.parametros_sistema).values({
      clave, valor: String(correlativo), tipo: 'number',
      descripcion: 'Correlativo de números de producción', actualizado_en: new Date(),
    }).run();
  }
  return `PR-${terminal}-${String(correlativo).padStart(6, '0')}`;
}

export function produccionListHandler(db: Db) {
  requireSession();
  return db.select().from(schema.produccion).orderBy(desc(schema.produccion.fecha)).all();
}

export function produccionCrearHandler(db: Db, payload: unknown) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_articulo_id = vId(p['articulo_id'], 'articulo_id');
  const v_cantidad_producida = num(p['cantidad_producida'], 'cantidad_producida', { min: 0.001 });
  const v_observaciones = optStr(p['observaciones'], 'observaciones', 500);
  const consumosOverride = p['consumos'] != null
    ? arr(p['consumos'], 'consumos', (x) => {
        const o = x as Record<string, unknown>;
        return {
          articulo_id: vId(o['articulo_id'], 'consumos.articulo_id'),
          cantidad: num(o['cantidad'], 'consumos.cantidad', { min: 0.001 }),
        };
      })
    : undefined;

  const receta = db.select().from(schema.receta_produccion)
    .where(eq(schema.receta_produccion.articulo_id, v_articulo_id)).get();
  if (!receta) throw new Error('RECETA_NO_DEFINIDA');
  const recetaItems = db.select().from(schema.receta_produccion_item)
    .where(eq(schema.receta_produccion_item.receta_produccion_id, receta.id)).all();

  const consumos = consumosOverride ?? escalarReceta(recetaItems, v_cantidad_producida, receta.rinde_cantidad);

  const now = new Date();
  const terminal = getOriginId();
  const sync = { version: 1 as const, origin_id: terminal, sync_state: 'pending' as const, updated_at: now };

  const produccionId = db.transaction((tx) => {
    const numero = nextNumeroProduccion(tx, terminal);

    const consumosConCosto = consumos.map((c) => {
      const art = tx.select().from(schema.articulo).where(eq(schema.articulo.id, c.articulo_id)).get();
      if (!art) throw new Error('NOT_FOUND');
      const ex = tx.select().from(schema.existencia_articulo)
        .where(eq(schema.existencia_articulo.articulo_id, c.articulo_id)).get()!;
      const stock_resultante = ex.stock - c.cantidad;
      if (art.bloquea_sin_stock && stock_resultante < 0) throw new Error(`STOCK_INSUFICIENTE:${art.nombre}`);
      return { articulo: art, existencia: ex, cantidad: c.cantidad, stock_resultante };
    });

    const produccionId = generateId();

    for (const c of consumosConCosto) {
      tx.insert(schema.movimiento_articulo).values({
        id: generateId(), articulo_id: c.articulo.id, tipo: 'salida', motivo: 'produccion_consumo',
        cantidad: -c.cantidad, stock_resultante: c.stock_resultante,
        costo_unitario_centavos: c.articulo.costo_promedio_centavos, referencia_tipo: 'produccion',
        referencia_id: produccionId, usuario_id: session.userId, fecha: now, observaciones: null, ...sync,
      }).run();
      tx.update(schema.existencia_articulo).set({
        stock: c.stock_resultante, ultima_fecha_movimiento: now,
        version: c.existencia.version + 1, sync_state: 'pending', updated_at: now,
      }).where(eq(schema.existencia_articulo.articulo_id, c.articulo.id)).run();
    }

    const costoUnitarioLote = costoDeLote(
      consumosConCosto.map((c) => ({ cantidad: c.cantidad, costoPromedioCentavos: c.articulo.costo_promedio_centavos })),
      v_cantidad_producida,
    );
    const costoTotalCentavos = Math.round(costoUnitarioLote * v_cantidad_producida);

    tx.insert(schema.produccion).values({
      id: produccionId, numero, articulo_id: v_articulo_id, cantidad_producida: v_cantidad_producida,
      costo_total_centavos: costoTotalCentavos, estado: 'confirmada', fecha: now,
      usuario_id: session.userId, observaciones: v_observaciones ?? null, ...sync,
    }).run();

    const artElaborado = tx.select().from(schema.articulo).where(eq(schema.articulo.id, v_articulo_id)).get()!;
    const exElaborado = tx.select().from(schema.existencia_articulo)
      .where(eq(schema.existencia_articulo.articulo_id, v_articulo_id)).get()!;
    const nuevoStock = exElaborado.stock + v_cantidad_producida;
    const nuevoCostoPromedio = costoPromedioEntrada(
      exElaborado.stock, artElaborado.costo_promedio_centavos, v_cantidad_producida, costoUnitarioLote,
    );

    tx.insert(schema.movimiento_articulo).values({
      id: generateId(), articulo_id: v_articulo_id, tipo: 'entrada', motivo: 'produccion_alta',
      cantidad: v_cantidad_producida, stock_resultante: nuevoStock, costo_unitario_centavos: costoUnitarioLote,
      referencia_tipo: 'produccion', referencia_id: produccionId, usuario_id: session.userId, fecha: now,
      observaciones: null, ...sync,
    }).run();
    tx.update(schema.existencia_articulo).set({
      stock: nuevoStock, ultima_fecha_movimiento: now,
      version: exElaborado.version + 1, sync_state: 'pending', updated_at: now,
    }).where(eq(schema.existencia_articulo.articulo_id, v_articulo_id)).run();
    tx.update(schema.articulo).set({
      costo_promedio_centavos: nuevoCostoPromedio,
      version: artElaborado.version + 1, sync_state: 'pending', updated_at: now,
    }).where(eq(schema.articulo.id, v_articulo_id)).run();

    return produccionId;
  });

  return db.select().from(schema.produccion).where(eq(schema.produccion.id, produccionId)).get()!;
}

export function produccionAnularHandler(db: Db, payload: unknown) {
  const session = requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = vId(p['id'], 'id');
  const v_motivo = str(p['motivo'], 'motivo', { max: 300 });
  const supervisor_credenciales = p['supervisor_credenciales'] as { nombre_usuario: string; password: string } | undefined;
  if (!supervisor_credenciales) throw new Error('ANULACION_REQUIERE_AUTORIZACION');
  verificarSupervisor(db, supervisor_credenciales);

  const prod = db.select().from(schema.produccion).where(eq(schema.produccion.id, v_id)).get();
  if (!prod) throw new Error('NOT_FOUND');
  if (prod.estado === 'anulada') throw new Error('YA_ANULADA');

  const now = new Date();
  const movs = db.select().from(schema.movimiento_articulo)
    .where(eq(schema.movimiento_articulo.referencia_id, v_id)).all();

  db.transaction((tx) => {
    for (const mov of movs) {
      const ex = tx.select().from(schema.existencia_articulo)
        .where(eq(schema.existencia_articulo.articulo_id, mov.articulo_id)).get()!;
      const cantidadInversa = -mov.cantidad;
      const stock_resultante = ex.stock + cantidadInversa;

      tx.insert(schema.movimiento_articulo).values({
        id: generateId(), articulo_id: mov.articulo_id, tipo: cantidadInversa >= 0 ? 'entrada' : 'salida',
        motivo: 'produccion_anulacion', cantidad: cantidadInversa, stock_resultante,
        costo_unitario_centavos: mov.costo_unitario_centavos, referencia_tipo: 'produccion',
        referencia_id: v_id, usuario_id: session.userId, fecha: now, observaciones: v_motivo,
        version: 1, origin_id: getOriginId(), sync_state: 'pending', updated_at: now,
      }).run();
      tx.update(schema.existencia_articulo).set({
        stock: stock_resultante, ultima_fecha_movimiento: now,
        version: ex.version + 1, sync_state: 'pending', updated_at: now,
      }).where(eq(schema.existencia_articulo.articulo_id, mov.articulo_id)).run();
      // El costo promedio no se revierte al anular (igual que el resto de la app): reabrir
      // el promedio hacia atrás exigiría guardar el historial completo de entradas.
    }

    tx.update(schema.produccion).set({
      estado: 'anulada', version: prod.version + 1, sync_state: 'pending', updated_at: now,
    }).where(eq(schema.produccion.id, v_id)).run();
  });

  return db.select().from(schema.produccion).where(eq(schema.produccion.id, v_id)).get()!;
}

export function registerProduccionHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('produccion.registrar');
  ipcMain.handle('produccion:list', async () => produccionListHandler(db));
  ipcMain.handle('produccion:crear', guard(async (_e, p) => produccionCrearHandler(db, p)));
  ipcMain.handle('produccion:anular', guard(async (_e, p) => produccionAnularHandler(db, p)));
}
