import { eq, isNull, or } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { normalizarTermino } from './normalizar';

type Db = BetterSQLite3Database<typeof schema>;

// Versión del algoritmo de normalización de `nombre_corto_norm`. Se sube cada vez que un
// cambio en `normalizar()` puede alterar el valor derivado de nombres ya almacenados.
//   v2: enmienda ADR-063/067 — canonicalización de unidad con espacio (`8 mm` → `8mm`).
const NOMBRE_NORM_VERSION = 2;
const CLAVE_VERSION = 'nombre_norm_version';

// ADR-067 — Rellena `producto.nombre_corto_norm` en las filas que quedaron sin normalizar
// (existentes antes de la migración 0037). Idempotente y barato: sólo toca filas con
// `nombre_corto_norm` NULL o vacío. Se corre en el arranque, después de las migraciones.
// Devuelve cuántas filas actualizó.
export function backfillNombreCortoNorm(db: Db): number {
  const pendientes = db.select({ id: schema.producto.id, nombre_corto: schema.producto.nombre_corto })
    .from(schema.producto)
    .where(or(isNull(schema.producto.nombre_corto_norm), eq(schema.producto.nombre_corto_norm, '')))
    .all();
  if (pendientes.length === 0) return 0;

  db.transaction((tx) => {
    for (const p of pendientes) {
      tx.update(schema.producto)
        .set({ nombre_corto_norm: normalizarTermino(p.nombre_corto) })
        .where(eq(schema.producto.id, p.id))
        .run();
    }
  });
  return pendientes.length;
}

// Enmienda ADR-063/067 — Re-derivación one-shot de `producto.nombre_corto_norm` para TODOS
// los productos, guardada por `parametros_sistema.nombre_norm_version`. Necesaria cuando
// `normalizar()` cambia y deja stale los valores ya almacenados (p. ej. la unidad separada
// por espacio pasa a pegarse). Corre una sola vez tras subir la versión del algoritmo: en el
// segundo arranque la versión ya está al día y no toca nada (idempotente). Igual que el
// backfill, sólo escribe la proyección derivada; no toca campos de sync. Devuelve el nº de
// filas recomputadas (0 si ya estaba al día).
export function rederivarNombreCortoNorm(db: Db): number {
  const fila = db.select({ valor: schema.parametros_sistema.valor })
    .from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, CLAVE_VERSION))
    .get();
  const versionActual = fila ? Number(fila.valor) : 1; // ausente = pre-enmienda (v1)
  if (versionActual >= NOMBRE_NORM_VERSION) return 0;

  const productos = db.select({ id: schema.producto.id, nombre_corto: schema.producto.nombre_corto })
    .from(schema.producto).all();

  db.transaction((tx) => {
    for (const p of productos) {
      tx.update(schema.producto)
        .set({ nombre_corto_norm: normalizarTermino(p.nombre_corto) })
        .where(eq(schema.producto.id, p.id))
        .run();
    }
    tx.insert(schema.parametros_sistema)
      .values({
        clave: CLAVE_VERSION,
        valor: String(NOMBRE_NORM_VERSION),
        tipo: 'number',
        descripcion: 'Versión del algoritmo de normalización de nombre_corto_norm (re-derivación one-shot).',
        actualizado_en: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.parametros_sistema.clave,
        set: { valor: String(NOMBRE_NORM_VERSION), actualizado_en: new Date() },
      })
      .run();
  });
  return productos.length;
}
