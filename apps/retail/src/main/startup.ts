import path from 'node:path';
import fs from 'node:fs';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './db/schema';
// Todos los imports de electron y db/client son dinámicos para evitar que sus
// side-effects en module scope (app.getPath, new Database) rompan los tests bajo
// ELECTRON_RUN_AS_NODE=1 donde app puede no estar inicializado.
import { runBaseSeed, isSeedBaseAplicado } from './base-seed/index';
import { runSeed } from './auth/seed';
import { crearBackup } from '@core/main';
import { iniciarActualizador } from './actualizacion/estado';

type Db = BetterSQLite3Database<typeof schema>;

export interface StartupOpts {
  skipBackup?: boolean;      // para tests — omite backup pre-migración
  skipMigrations?: boolean;  // para tests — la DB ya está migrada
  geoCache?: string;         // ruta al directorio geo-cache (si no se pasa, usa contexto Electron)
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

  // 2b. Backfill ADR-067: normaliza producto.nombre_corto_norm en filas previas a la
  //     migración 0037 (idempotente; sólo toca filas sin normalizar).
  {
    const { backfillNombreCortoNorm, rederivarNombreCortoNorm } = await import('./sinonimos/backfill');
    try {
      const n = backfillNombreCortoNorm(db);
      if (n > 0) console.log(`[startup] backfill nombre_corto_norm: ${n} productos`);
    } catch (e) {
      console.warn('[startup] backfill nombre_corto_norm falló (no bloqueante):', (e as Error).message);
    }
    // Enmienda ADR-063/067: re-derivación one-shot cuando cambió el algoritmo de normalización
    // (guardada por parametros_sistema.nombre_norm_version; corre una sola vez).
    try {
      const n = rederivarNombreCortoNorm(db);
      if (n > 0) console.log(`[startup] re-derivación nombre_corto_norm (v2): ${n} productos`);
    } catch (e) {
      console.warn('[startup] re-derivación nombre_corto_norm falló (no bloqueante):', (e as Error).message);
    }
  }

  // 3. Seed de auth en CADA arranque. Es idempotente y estrictamente aditivo
  //    (roles solo si no hay ninguno, permisos con onConflictDoNothing, rol_permiso
  //    solo si falta, admin solo si no hay usuarios), asi que correrlo siempre es
  //    seguro y hace que los permisos nuevos de una version lleguen a instalaciones
  //    ya inicializadas. Antes vivia solo dentro del first-run guard de abajo, con lo
  //    cual todo permiso agregado despues del primer arranque nunca se sembraba y el
  //    modulo asociado quedaba invisible por RBAC.
  runSeed(db);

  // 3b. Sinónimos de búsqueda (ADR-067): dataset base de REFERENCIA. Idempotente y aditivo
  //     (se salta si ya hay filas origen='seed'), igual que runSeed — por eso corre en CADA
  //     arranque y no sólo en el first-run: así llega también a instalaciones ya inicializadas
  //     (donde el guard `seed_base_aplicado` de abajo nunca vuelve a correr). Sin esto, una
  //     base creada antes de esta feature muestra el ABM de Sinónimos vacío.
  {
    const { runSinonimoSeed } = await import('./sinonimos/seed');
    try {
      runSinonimoSeed(db);
    } catch (e) {
      console.warn('[startup] seed sinónimos falló (no bloqueante):', (e as Error).message);
    }
  }

  // 4. First-run guard: el resto de seed:base (catálogo, geo) una sola vez
  if (!isSeedBaseAplicado(db)) {
    let resolvedCache = geoCache;
    if (!resolvedCache) {
      const { app } = await import('electron');
      resolvedCache = app.isPackaged
        ? path.join(process.resourcesPath, 'geo-cache')  // producción: bundled en extraResources
        // dev: __dirname = apps/retail/.vite/build → el geo-cache vive en @core/main
        : path.resolve(__dirname, '../../../../packages/core-main/geo-cache');
    }
    await runBaseSeed(db, resolvedCache);
  }

  // 5. Auto-update (solo en app empaquetada — no en dev ni tests).
  // La descarga es silenciosa en background; la propuesta de instalar la muestra el
  // renderer al login del Supervisor (ver ipc/actualizacion.ts + AppShell).
  {
    const { app } = await import('electron');
    if (app) await iniciarActualizador(app);
  }
}
