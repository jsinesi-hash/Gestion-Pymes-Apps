import path from 'node:path';
import fs from 'node:fs';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './db/schema';
// Los imports de electron y db/client son dinámicos para evitar que sus side-effects en
// module scope (app.getPath, new Database) rompan los tests bajo ELECTRON_RUN_AS_NODE=1
// donde app puede no estar inicializado.
import { runSeed, crearBackup, runGeoSeedOffline } from '@core/main';
import { PERMISOS_ELABORADOS, OPERADOR_PERMISOS_ELABORADOS } from './auth/seed';
import { runCatalogSeedElaborados, asegurarConsumidorFinal } from './catalog/seed';
import * as dbSchema from './db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export interface StartupOpts {
  skipBackup?: boolean;      // para tests — omite backup pre-migración
  skipMigrations?: boolean;  // para tests — la DB ya está migrada
  geoCache?: string;         // ruta al directorio geo-cache (si no se pasa, usa contexto Electron)
}

const CLAVE_SEED_BASE_APLICADO = 'sistema.seed_base_aplicado';

function isSeedBaseAplicado(db: Db): boolean {
  const row = db.select()
    .from(dbSchema.parametros_sistema)
    .where(eq(dbSchema.parametros_sistema.clave, CLAVE_SEED_BASE_APLICADO))
    .get();
  return row?.valor === 'true';
}

function marcarSeedBaseAplicado(db: Db): void {
  db.insert(dbSchema.parametros_sistema)
    .values({
      clave: CLAVE_SEED_BASE_APLICADO,
      valor: 'true',
      tipo: 'bool',
      descripcion: 'Seed base ejecutado en primer arranque',
    })
    .onConflictDoNothing()
    .run();
}

export async function runStartup(db: Db, opts: StartupOpts = {}): Promise<void> {
  const { skipBackup = false, skipMigrations = false, geoCache } = opts;

  // 1. Backup pre-migración (solo si hay migraciones pendientes y la DB ya existe)
  if (!skipBackup) {
    const { hasPendingMigrations } = await import('./db/client');
    if (hasPendingMigrations()) {
      const { app } = await import('electron');
      const backupDir = path.join(app.getPath('userData'), 'backups', 'pre-migration');
      fs.mkdirSync(backupDir, { recursive: true });
      try {
        const rutaFbk = await crearBackup({
          db,
          destino: backupDir,
          tipo: 'auto',
          incluirCerts: false,
          appVersion: app.getVersion(),
          sucursalId: 'C1',
        });
        console.log(`[startup] backup pre-migración: ${rutaFbk}`);
      } catch (e) {
        console.error('[startup] backup pre-migración falló — se cancela el arranque:', e);
        throw new Error(`BACKUP_FAILED_BEFORE_MIGRATION: ${(e as Error).message}`);
      }
    }
  }

  // 2. Migraciones Drizzle (idempotente)
  if (!skipMigrations) {
    const { runMigrations } = await import('./db/client');
    try {
      runMigrations();
    } catch (e) {
      console.error('[startup] migraciones fallaron. Revisar backup en userData/backups/pre-migration/', e);
      throw e;
    }
  }

  // 3. Seed de auth en CADA arranque. Es idempotente y estrictamente aditivo (roles solo
  //    si no hay ninguno, permisos con onConflictDoNothing, rol_permiso solo si falta,
  //    admin solo si no hay usuarios), así que correrlo siempre es seguro y hace que los
  //    permisos nuevos de una versión lleguen a instalaciones ya inicializadas.
  runSeed(db, { permisos: PERMISOS_ELABORADOS, operador: OPERADOR_PERMISOS_ELABORADOS });
  asegurarConsumidorFinal(db);

  // 4. First-run guard: geo una sola vez
  if (!isSeedBaseAplicado(db)) {
    let resolvedCache = geoCache;
    if (!resolvedCache) {
      const { app } = await import('electron');
      resolvedCache = app.isPackaged
        ? path.join(process.resourcesPath, 'geo-cache')  // producción: bundled en extraResources
        // dev: __dirname = apps/elaborados/.vite/build → el geo-cache vive en @core/main
        : path.resolve(__dirname, '../../../../packages/core-main/geo-cache');
    }
    try {
      const sqlite = (db as any).$client;
      await runGeoSeedOffline(sqlite, resolvedCache);
    } catch (e) {
      console.warn('[startup] geo seed falló (no bloqueante):', (e as Error).message);
    }
    runCatalogSeedElaborados(db);
    marcarSeedBaseAplicado(db);
  }
}
