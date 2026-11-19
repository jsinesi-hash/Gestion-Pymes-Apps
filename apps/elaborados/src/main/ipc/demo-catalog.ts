import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { getModoTerminal, getSession } from '@core/main';
import * as schema from '../db/schema';
import { runDemoHeladeriaSeed } from '../catalog/demo-heladeria';
import { estadoDemo, vaciarDemo, type EstadoDemo } from '../catalog/demo-registro';

type Db = BetterSQLite3Database<typeof schema>;

// ADR-110: gestión a demanda del catálogo demo (Configuración → Datos demo), mismo patrón que Retail (ADR-062).
// Es administración de la instalación → solo con `usuario.administrar`.
function requireAdmin() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (!session.permisos.has('usuario.administrar')) throw new Error('FORBIDDEN');
  return session;
}

export function demoEstadoHandler(db: Db): EstadoDemo {
  requireAdmin();
  return estadoDemo(db);
}

export function demoHeladeriaSeedHandler(db: Db): { cargado: boolean; yaHabiaCatalogo: boolean; estado: EstadoDemo } {
  requireAdmin();
  if (estadoDemo(db).hayCatalogo) return { cargado: false, yaHabiaCatalogo: true, estado: estadoDemo(db) };
  runDemoHeladeriaSeed(db);
  return { cargado: true, yaHabiaCatalogo: false, estado: estadoDemo(db) };
}

/** Falla con `DEMO_EN_USO:<claves>` si algo demo ya tiene ventas, compras, movimientos, producciones o recetas propias. */
export function demoVaciarHandler(db: Db): { eliminados: number; estado: EstadoDemo } {
  requireAdmin();
  // ADR-150 §7 (F2 PR4): vaciar borra filas físicamente; en modo distribuido no hay borrados físicos.
  if (getModoTerminal() === 'distribuido') throw new Error('DEMO_VACIAR_NO_DISPONIBLE_EN_DISTRIBUIDO');
  const r = vaciarDemo(db);
  return { eliminados: r.articulos + r.productos, estado: estadoDemo(db) };
}

export function registerDemoCatalogHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('demo-catalog:estado', async () => demoEstadoHandler(db));
  ipcMain.handle('demo-catalog:seed-heladeria', async () => demoHeladeriaSeedHandler(db));
  ipcMain.handle('demo-catalog:vaciar', async () => demoVaciarHandler(db));
}
