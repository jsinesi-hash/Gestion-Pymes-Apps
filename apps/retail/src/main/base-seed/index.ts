import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';
import { runSeed } from '../auth/seed';
import { runCatalogSeed } from '../catalog/seed';
import { runSinonimoSeed } from '../sinonimos/seed';
import { runGeoSeedOffline } from '@core/main';
import * as dbSchema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export async function runBaseSeed(db: Db, cacheDir?: string): Promise<void> {
  // 1. Auth: roles, permisos, usuario admin
  runSeed(db);

  // 2. Catálogo: IVA 21%, unidades base
  //    NOTA (ADR-062): el catálogo demo NO se siembra acá. Una instalación arranca en
  //    blanco; el demo se carga a demanda desde Configuración → Datos demo
  //    (runDemoCatalogSeed vía ipc/demo-catalog).
  runCatalogSeed(db);

  // 2c. Sinónimos de búsqueda (ADR-067): dataset base para el rubro. Reference data,
  //     inofensiva con el flag `sinonimos_habilitado` apagado (nadie la consulta).
  runSinonimoSeed(db);

  // 3. Geo: provincias/departamentos/localidades (offline desde geo-cache)
  const resolvedCache = cacheDir ?? path.join(__dirname, '../../../../../packages/core-main/geo-cache');
  try {
    const sqlite = (db as any).$client;
    await runGeoSeedOffline(sqlite, resolvedCache);
  } catch (e) {
    console.warn('[seed:base] geo seed falló (no bloqueante):', (e as Error).message);
  }

  // 4. Flag: marcar que seed:base ya corrió (idempotente)
  db.insert(dbSchema.parametros_sistema)
    .values({
      clave: 'sistema.seed_base_aplicado',
      valor: 'true',
      tipo: 'bool',
      descripcion: 'Seed base ejecutado en primer arranque',
    })
    .onConflictDoNothing()
    .run();
}

export function isSeedBaseAplicado(db: Db): boolean {
  const row = db.select()
    .from(dbSchema.parametros_sistema)
    .where(eq(dbSchema.parametros_sistema.clave, 'sistema.seed_base_aplicado'))
    .get();
  return row?.valor === 'true';
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entry point (solo cuando se pide explícitamente: BASE_SEED_CLI=1, lo setea scripts/seed-base.cjs)
// ─────────────────────────────────────────────────────────────────────────────
// OJO: NO usar `require.main === module`: startup.ts importa este archivo, que queda bundleado en el main de
// Electron, donde `module` ES el entry y la condición daba true en cada arranque (ADR-111/113).

if (process.env['BASE_SEED_CLI'] === '1') {
  (async () => {
    const Database  = (await import('better-sqlite3')).default;
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    const os = await import('node:os');
    const fs = await import('node:fs');

    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    const dbPath  = path.join(appData, 'ferreteria-client', 'ferreteria.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    console.log(`seed:base — DB: ${dbPath}\n`);

    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    const db = drizzle(sqlite, { schema: dbSchema });
    migrate(db, { migrationsFolder: path.join(__dirname, '../db/migrations') });

    const geoCache = path.join(__dirname, '../../../../../packages/core-main/geo-cache');
    await runBaseSeed(db, geoCache);

    console.log('\n✓ seed:base completado.');
    sqlite.close();
  })().catch((err) => {
    console.error('\n✗ seed:base falló:', err.message);
    process.exit(1);
  });
}
