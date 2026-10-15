import { eq, inArray, notInArray, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import { getOriginId } from '@core/main';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

/** Tablas que puede crear el catálogo demo, en orden de borrado (hojas primero). */
const TABLAS_DEMO = [
  ['produccion', schema.produccion],
  ['producto_venta_grupo', schema.producto_venta_grupo],
  ['producto_venta_componente', schema.producto_venta_componente],
  ['producto_venta', schema.producto_venta],
  ['grupo_modificador_opcion', schema.grupo_modificador_opcion],
  ['grupo_modificador', schema.grupo_modificador],
  ['categoria_venta', schema.categoria_venta],
  ['receta_produccion_item', schema.receta_produccion_item],
  ['receta_produccion', schema.receta_produccion],
  ['movimiento_articulo', schema.movimiento_articulo],
  ['existencia_articulo', schema.existencia_articulo],
  ['articulo', schema.articulo],
] as const;

export type SnapshotIds = Map<string, Set<string>>;

function idsDe(db: Db, tabla: (typeof TABLAS_DEMO)[number][1]): string[] {
  return (db.select({ id: tabla.id }).from(tabla).all() as { id: string }[]).map((r) => r.id);
}

/** Ids existentes por tabla; se toma antes de sembrar para registrar solo lo que el seed agrega. */
export function snapshotIds(db: Db): SnapshotIds {
  const snap: SnapshotIds = new Map();
  for (const [nombre, tabla] of TABLAS_DEMO) snap.set(nombre, new Set(idsDe(db, tabla)));
  return snap;
}

/** Anota en `demo_registro` los ids que aparecieron respecto de `antes`. */
export function registrarDiferencia(db: Db, antes: SnapshotIds): void {
  const now = new Date();
  for (const [nombre, tabla] of TABLAS_DEMO) {
    const previos = antes.get(nombre)!;
    for (const id of idsDe(db, tabla).filter((x) => !previos.has(x))) {
      db.insert(schema.demo_registro).values({
        id: generateId(), tabla: nombre, registro_id: id,
        version: 1, origin_id: getOriginId(), sync_state: 'pending', updated_at: now,
      }).run();
    }
  }
}

function idsDemo(db: Db, tabla: string): string[] {
  return db.select({ id: schema.demo_registro.registro_id }).from(schema.demo_registro)
    .where(eq(schema.demo_registro.tabla, tabla)).all().map((r) => r.id);
}

/**
 * Qué impide vaciar: filas fuera del registro que dependen de registros demo.
 * Claves: ventas, compras, movimientos, producciones, recetas.
 */
export function usoReal(db: Db): string[] {
  const productos = idsDemo(db, 'producto_venta');
  const opciones = idsDemo(db, 'grupo_modificador_opcion');
  const articulos = idsDemo(db, 'articulo');
  const uso = new Set<string>();

  if (productos.length && db.select({ id: schema.venta_linea.id }).from(schema.venta_linea)
    .where(inArray(schema.venta_linea.producto_venta_id, productos)).limit(1).all().length > 0) uso.add('ventas');
  if (opciones.length && db.select({ id: schema.venta_linea_modificador.id }).from(schema.venta_linea_modificador)
    .where(inArray(schema.venta_linea_modificador.grupo_modificador_opcion_id, opciones)).limit(1).all().length > 0) uso.add('ventas');
  if (articulos.length === 0) return [...uso];

  if (db.select({ id: schema.compra_item.id }).from(schema.compra_item)
    .where(inArray(schema.compra_item.articulo_id, articulos)).limit(1).all().length > 0) uso.add('compras');

  // Filas que referencian un artículo demo pero no pertenecen al registro (las creó el usuario después).
  const fuera = (tabla: any, nombre: string): boolean => {
    const propios = idsDemo(db, nombre);
    const cond = propios.length
      ? and(inArray(tabla.articulo_id, articulos), notInArray(tabla.id, propios))
      : inArray(tabla.articulo_id, articulos);
    return db.select({ id: tabla.id }).from(tabla).where(cond).limit(1).all().length > 0;
  };
  if (fuera(schema.movimiento_articulo, 'movimiento_articulo')) uso.add('movimientos');
  if (fuera(schema.produccion, 'produccion')) uso.add('producciones');
  if (fuera(schema.receta_produccion_item, 'receta_produccion_item')
    || fuera(schema.producto_venta_componente, 'producto_venta_componente')
    || fuera(schema.grupo_modificador_opcion, 'grupo_modificador_opcion')) uso.add('recetas');
  return [...uso];
}

export type EstadoDemo = {
  hayCatalogo: boolean; hayDemo: boolean; articulosDemo: number; productosDemo: number; enUso: string[];
};

export function estadoDemo(db: Db): EstadoDemo {
  const articulosDemo = idsDemo(db, 'articulo').length;
  const productosDemo = idsDemo(db, 'producto_venta').length;
  const hayCatalogo = db.select({ id: schema.producto_venta.id }).from(schema.producto_venta).limit(1).all().length > 0;
  return { hayCatalogo, hayDemo: articulosDemo + productosDemo > 0, articulosDemo, productosDemo, enUso: usoReal(db) };
}

/** Borra solo lo registrado como demo. Atómico: si algo depende de lo demo lanza `DEMO_EN_USO:<claves>` sin borrar nada. */
export function vaciarDemo(db: Db): { articulos: number; productos: number } {
  return db.transaction((tx) => {
    const enUso = usoReal(tx);
    if (enUso.length > 0) throw new Error(`DEMO_EN_USO:${enUso.join(',')}`);
    const articulos = idsDemo(tx, 'articulo').length;
    const prods = idsDemo(tx, 'producto_venta');
    // Precios por lista de productos demo: no se registran (los carga el usuario) y no tienen sentido sin el producto.
    if (prods.length) tx.delete(schema.producto_venta_precio).where(inArray(schema.producto_venta_precio.producto_venta_id, prods)).run();
    for (const [nombre, tabla] of TABLAS_DEMO) {
      const ids = idsDemo(tx, nombre);
      if (ids.length) tx.delete(tabla).where(inArray(tabla.id, ids)).run();
    }
    tx.delete(schema.demo_registro).run();
    return { articulos, productos: prods.length };
  });
}
