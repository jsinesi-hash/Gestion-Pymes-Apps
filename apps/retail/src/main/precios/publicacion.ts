import { eq, and, isNull } from 'drizzle-orm';
import { generateId } from '@ferreteria/shared';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getOriginId } from '@core/main';

type Db = BetterSQLite3Database<typeof schema>;

function getBatch(db: Db, id: string) {
  const b = db.select().from(schema.price_batch).where(eq(schema.price_batch.id, id)).get();
  if (!b) throw new Error('NOT_FOUND');
  return b;
}

/** Recalcula contadores y estado (validado / validacion_fallida) desde el detalle. Solo antes de aprobar. */
export function recontarBatch(db: Db, id: string): void {
  const batch = getBatch(db, id);
  if (batch.estado !== 'validado' && batch.estado !== 'validacion_fallida' && batch.estado !== 'borrador') return;
  const filas = db.select().from(schema.price_batch_detalle)
    .where(eq(schema.price_batch_detalle.price_batch_id, id)).all();
  let ok = 0, adv = 0, err = 0, exc = 0, impacto = 0;
  for (const d of filas) {
    switch (d.estado_validacion) {
      case 'ok': ok++; break;
      case 'advertencia': adv++; break;
      case 'error': err++; break;
      case 'excluida': exc++; break;
    }
    if (d.estado_validacion === 'ok' || d.estado_validacion === 'advertencia') {
      impacto += d.precio_propuesto_centavos - (d.precio_anterior_centavos ?? d.precio_propuesto_centavos);
    }
  }
  db.update(schema.price_batch).set({
    productos_ok: ok, advertencias: adv, errores: err, excluidas: exc,
    impacto_incremento_centavos: impacto,
    estado: err > 0 ? 'validacion_fallida' : 'validado',
    updated_at: new Date(),
  }).where(eq(schema.price_batch.id, id)).run();
}

/** Excluye una fila del lote (rechazada) y recalcula. */
export function excluirFila(db: Db, filaId: string): void {
  const now = new Date();
  db.update(schema.price_batch_detalle)
    .set({ estado_validacion: 'excluida', updated_at: now })
    .where(eq(schema.price_batch_detalle.id, filaId)).run();
  const fila = db.select().from(schema.price_batch_detalle).where(eq(schema.price_batch_detalle.id, filaId)).get();
  if (fila) recontarBatch(db, fila.price_batch_id);
}

/** Excluye de un saque todas las filas en error del lote. */
export function excluirErrores(db: Db, batchId: string): void {
  const now = new Date();
  db.update(schema.price_batch_detalle)
    .set({ estado_validacion: 'excluida', updated_at: now })
    .where(and(
      eq(schema.price_batch_detalle.price_batch_id, batchId),
      eq(schema.price_batch_detalle.estado_validacion, 'error'),
    )).run();
  recontarBatch(db, batchId);
}

/** Aprueba un lote validado (sin errores no excluidos). Requiere permiso precio.aprobar (guard en IPC). */
export function aprobarBatch(db: Db, id: string, userId: string): void {
  const batch = getBatch(db, id);
  if (batch.estado !== 'validado') throw new Error('BATCH_NO_APROBABLE');
  if (batch.errores > 0) throw new Error('BATCH_CON_ERRORES');
  db.update(schema.price_batch).set({
    estado: 'aprobado',
    usuario_aprobador_id: userId,
    fecha_aprobacion: new Date(),
    updated_at: new Date(),
  }).where(eq(schema.price_batch.id, id)).run();
}

/**
 * Publica un lote aprobado en una sola transacción: cierra las filas vigentes de
 * lista_precio_valor e inserta las nuevas (origen 'recalculo'). Deja el lote 'publicado'.
 */
export function publicarBatch(db: Db, id: string, userId: string): { publicados: number } {
  const batch = getBatch(db, id);
  if (batch.estado !== 'aprobado') throw new Error('BATCH_NO_APROBADO');
  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };

  return db.transaction((tx) => {
    const filas = tx.select().from(schema.price_batch_detalle)
      .where(eq(schema.price_batch_detalle.price_batch_id, id)).all();
    let publicados = 0;
    for (const d of filas) {
      if (d.estado_validacion !== 'ok' && d.estado_validacion !== 'advertencia') continue;
      tx.update(schema.lista_precio_valor)
        .set({ fecha_hasta: now, updated_at: now })
        .where(and(
          eq(schema.lista_precio_valor.lista_precio_id, batch.lista_precio_id),
          eq(schema.lista_precio_valor.producto_id, d.producto_id),
          isNull(schema.lista_precio_valor.fecha_hasta),
        )).run();
      tx.insert(schema.lista_precio_valor).values({
        id: generateId(),
        lista_precio_id: batch.lista_precio_id,
        producto_id: d.producto_id,
        precio_centavos: d.precio_propuesto_centavos,
        fecha_desde: now,
        fecha_hasta: null,
        origen: 'recalculo',
        recalculo_masivo_id: null,
        presentacion_id: d.presentacion_id,
        usuario_id: userId,
        ...sync,
      }).run();
      publicados++;
    }
    tx.update(schema.price_batch).set({
      estado: 'publicado', fecha_publicacion: now, updated_at: now,
    }).where(eq(schema.price_batch.id, id)).run();
    return { publicados };
  });
}

/**
 * Genera un lote nuevo de reversión (origen ROLLBACK) cuyo detalle son los precios
 * anteriores del lote publicado. Pasa por el mismo camino de aprobación/publicación.
 * Nunca modifica historia (ADR-006).
 */
export function revertirBatch(db: Db, id: string, userId: string): { id: string } {
  const original = getBatch(db, id);
  if (original.estado !== 'publicado') throw new Error('BATCH_NO_PUBLICADO');
  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };
  const nuevoId = generateId();

  return db.transaction((tx) => {
    const filas = tx.select().from(schema.price_batch_detalle)
      .where(eq(schema.price_batch_detalle.price_batch_id, id)).all();

    // El padre primero (FK price_batch_detalle.price_batch_id).
    tx.insert(schema.price_batch).values({
      id: nuevoId,
      lista_precio_id: original.lista_precio_id,
      proveedor_id: original.proveedor_id,
      origen: 'ROLLBACK',
      referencia_tipo: 'price_batch',
      referencia_id: id,
      estado: 'validado',
      batch_revertido_id: id,
      productos_ok: 0,
      advertencias: 0,
      errores: 0,
      excluidas: 0,
      impacto_incremento_centavos: 0,
      usuario_creacion_id: userId,
      usuario_aprobador_id: null,
      fecha_creacion: now,
      fecha_aprobacion: null,
      fecha_publicacion: null,
      observaciones: `Reversión del lote ${id}`,
      ...sync,
    }).run();

    let count = 0;
    for (const d of filas) {
      if (d.estado_validacion !== 'ok' && d.estado_validacion !== 'advertencia') continue;
      if (d.precio_anterior_centavos == null) continue; // nada que restaurar
      tx.insert(schema.price_batch_detalle).values({
        id: generateId(),
        price_batch_id: nuevoId,
        producto_id: d.producto_id,
        presentacion_id: d.presentacion_id,
        costo_neto_centavos: d.costo_neto_centavos,
        precio_anterior_centavos: d.precio_propuesto_centavos, // lo que quedó publicado
        precio_propuesto_centavos: d.precio_anterior_centavos, // volver al valor previo
        margen_anterior_pct: d.margen_nuevo_pct,
        margen_nuevo_pct: d.margen_anterior_pct,
        regla_precio_id: d.regla_precio_id,
        variacion_pct: null,
        estado_validacion: 'ok',
        motivo_validacion: 'Reversión de lote',
        ...sync,
      }).run();
      count++;
    }

    tx.update(schema.price_batch).set({ productos_ok: count, updated_at: now })
      .where(eq(schema.price_batch.id, nuevoId)).run();
    // marcar el original como revertido (traza; no toca su historia publicada)
    tx.update(schema.price_batch).set({ estado: 'revertido', updated_at: now })
      .where(eq(schema.price_batch.id, id)).run();
    return { id: nuevoId };
  });
}
