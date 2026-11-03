import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { IpcMain } from 'electron';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { movimientoStockListHandler, registerMovimientoStockHandlers } from '../movimiento-stock';

type Db = ReturnType<typeof setupDb>;
function createTestProduct(db: Db) {
  runCatalogSeed(db);
  const cat = categoriaCreateHandler(db, { nombre: 'T' });
  const imp = db.select().from(schema.impuesto).all()[0];
  return productoCreateHandler(db, { nombre_corto: 'P', categoria_id: cat.id, impuesto_id: imp.id, unidad_venta: 'u', precio_venta_lista: 100 });
}

describe('movimiento-stock handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('list incluye movimiento inicial', () => {
    loginAsAdmin(db);
    const p = createTestProduct(db);
    const movs = movimientoStockListHandler(db, { producto_id: p.id });
    expect(movs).toHaveLength(1);
    expect(movs[0].motivo).toBe('inicial');
  });

  // Revisión 2026-10-20 (P0): `movimiento-stock:create` aceptaba tipo/motivo/cantidad arbitrarios
  // con solo sesión (incluso NaN o negativos) y esquivaba `stock.ajustar`/`stock.entrada`. Ninguna
  // pantalla lo usaba: el stock manual pasa por los canales `stock:*`, que sí validan y exigen
  // permiso. Se eliminó el canal en vez de endurecerlo.
  it('el registro solo expone la lectura: no existe movimiento-stock:create', () => {
    const canales: string[] = [];
    const ipcMain = { handle: (canal: string) => { canales.push(canal); } } as unknown as IpcMain;
    registerMovimientoStockHandlers(ipcMain, db);
    expect(canales).toEqual(['movimiento-stock:list']);
  });

  it('el módulo ya no exporta un handler de creación', async () => {
    const modulo = await import('../movimiento-stock');
    expect('movimientoStockCreateHandler' in modulo).toBe(false);
  });

  it('el preload no expone movimientoStock.create', () => {
    const preload = fs.readFileSync(path.join(__dirname, '../../../preload/index.ts'), 'utf8');
    expect(preload).not.toContain("'movimiento-stock:create'");
    expect(preload).toContain("'movimiento-stock:list'");
  });
});
