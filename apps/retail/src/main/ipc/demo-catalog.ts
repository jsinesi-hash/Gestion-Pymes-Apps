import { sql } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import {
  runDemoCatalogSeed,
  vaciarCatalogoDemo,
  productosDemoIds,
} from '../base-seed/demo-catalog';

type Db = BetterSQLite3Database<typeof schema>;

// ADR-062: gestión a demanda del catálogo demo desde Configuración → Datos demo.
// Acciones de administración (setup del catálogo) → sólo Supervisor.
function requireAdmin() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (!session.permisos.has('usuario.administrar')) throw new Error('FORBIDDEN');
  return session;
}

export type DemoCatalogEstado = {
  totalProductos: number;
  productosDemo: number;
  hayProductos: boolean;
  hayDemo: boolean;
};

export function demoCatalogEstadoHandler(db: Db): DemoCatalogEstado {
  requireAdmin();
  const [{ total }] = db.select({ total: sql<number>`count(*)` }).from(schema.producto).all();
  const productosDemo = productosDemoIds(db).length;
  return {
    totalProductos: total,
    productosDemo,
    hayProductos: total > 0,
    hayDemo: productosDemo > 0,
  };
}

export type DemoCatalogCargarResult = {
  sembrados: number;
  yaHabiaProductos: boolean;
  estado: DemoCatalogEstado;
};

export function demoCatalogCargarHandler(db: Db): DemoCatalogCargarResult {
  requireAdmin();
  const [{ total }] = db.select({ total: sql<number>`count(*)` }).from(schema.producto).all();
  if (total > 0) {
    // El seeder se negaría igual; lo cortamos acá para informar con precisión.
    return { sembrados: 0, yaHabiaProductos: true, estado: demoCatalogEstadoHandler(db) };
  }
  runDemoCatalogSeed(db);
  const estado = demoCatalogEstadoHandler(db);
  return { sembrados: estado.productosDemo, yaHabiaProductos: false, estado };
}

export type DemoCatalogVaciarResult = {
  eliminados: number;
  estado: DemoCatalogEstado;
};

export function demoCatalogVaciarHandler(db: Db): DemoCatalogVaciarResult {
  requireAdmin();
  const eliminados = vaciarCatalogoDemo(db);
  return { eliminados, estado: demoCatalogEstadoHandler(db) };
}

export function registerDemoCatalogHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('demoCatalog:estado', async () => demoCatalogEstadoHandler(db));
  ipcMain.handle('demoCatalog:cargar', async () => demoCatalogCargarHandler(db));
  ipcMain.handle('demoCatalog:vaciar', async () => demoCatalogVaciarHandler(db));
}
