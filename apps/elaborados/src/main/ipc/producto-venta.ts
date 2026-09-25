import { eq } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import { getSession, getOriginId, requirePermission, str, num, int, centavos, oneOf, arr, id as vId } from '@core/main';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

export function productoVentaListHandler(db: Db) {
  requireSession();
  return db.select().from(schema.producto_venta).where(eq(schema.producto_venta.activo, true)).all();
}

export function productoVentaGetHandler(db: Db, payload: { id: string }) {
  requireSession();
  const pv = db.select().from(schema.producto_venta).where(eq(schema.producto_venta.id, payload.id)).get();
  if (!pv) return null;
  const componentes = db.select().from(schema.producto_venta_componente)
    .where(eq(schema.producto_venta_componente.producto_venta_id, pv.id)).all();
  const grupos = db.select().from(schema.producto_venta_grupo)
    .where(eq(schema.producto_venta_grupo.producto_venta_id, pv.id)).all();
  return { ...pv, componentes, grupos };
}

const MODOS_DESCUENTO = ['reparto', 'por_opcion', 'sin_descuento'] as const;

export function productoVentaCreateHandler(db: Db, payload: unknown) {
  requireSession();
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_nombre = str(p['nombre'], 'nombre', { max: 120 });
  const v_categoria_id = vId(p['categoria_venta_id'], 'categoria_venta_id');
  const v_precio = centavos(p['precio_centavos'], 'precio_centavos');
  const v_impuesto_id = vId(p['impuesto_id'], 'impuesto_id');
  const v_componentes = arr(p['componentes'], 'componentes', (x) => {
    const o = x as Record<string, unknown>;
    return { articulo_id: vId(o['articulo_id'], 'componentes.articulo_id'), cantidad: num(o['cantidad'], 'componentes.cantidad', { min: 0.001 }) };
  });
  const v_grupos = arr(p['grupos'], 'grupos', (x) => {
    const o = x as Record<string, unknown>;
    return {
      grupo_modificador_id: vId(o['grupo_modificador_id'], 'grupos.grupo_modificador_id'),
      min: int(o['min'], 'grupos.min', { min: 0 }),
      max: int(o['max'], 'grupos.max', { min: 0 }),
      cantidad_total: num(o['cantidad_total'], 'grupos.cantidad_total', { min: 0 }),
      modo_descuento: oneOf(o['modo_descuento'], 'grupos.modo_descuento', MODOS_DESCUENTO),
      orden: o['orden'] == null ? 0 : int(o['orden'], 'grupos.orden', { min: 0 }),
    };
  });

  const impuesto = db.select().from(schema.impuesto).where(eq(schema.impuesto.id, v_impuesto_id)).get();
  if (!impuesto) throw new Error('IMPUESTO_NO_ENCONTRADO');
  const categoria = db.select().from(schema.categoria_venta).where(eq(schema.categoria_venta.id, v_categoria_id)).get();
  if (!categoria) throw new Error('CATEGORIA_NO_ENCONTRADA');

  const now = new Date();
  const sync = { version: 1 as const, origin_id: getOriginId(), sync_state: 'pending' as const, updated_at: now };
  const id = generateId();

  db.transaction((tx) => {
    tx.insert(schema.producto_venta).values({
      id, nombre: v_nombre, categoria_venta_id: v_categoria_id,
      precio_centavos: v_precio, impuesto_id: v_impuesto_id, activo: true, ...sync,
    }).run();

    for (const c of v_componentes) {
      tx.insert(schema.producto_venta_componente).values({
        id: generateId(), producto_venta_id: id, articulo_id: c.articulo_id, cantidad: c.cantidad, ...sync,
      }).run();
    }
    for (const g of v_grupos) {
      tx.insert(schema.producto_venta_grupo).values({
        id: generateId(), producto_venta_id: id, ...g, ...sync,
      }).run();
    }
  });

  return productoVentaGetHandler(db, { id })!;
}

export function registerProductoVentaHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('producto_venta.gestionar');
  ipcMain.handle('producto-venta:list', async () => productoVentaListHandler(db));
  ipcMain.handle('producto-venta:get', async (_e, p) => productoVentaGetHandler(db, p));
  ipcMain.handle('producto-venta:create', guard(async (_e, p) => productoVentaCreateHandler(db, p)));
}
