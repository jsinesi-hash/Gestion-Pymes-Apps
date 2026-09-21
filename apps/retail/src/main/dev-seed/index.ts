import { runSeed } from '../auth/seed';
import { runCatalogSeed } from '../catalog/seed';
import { seedCatalog, wipeCatalog } from './catalog';
import { seedPersonas, wipePersonas } from './personas';
import { seedVentas, wipeVentas } from './ventas';
import { openDevDb, checkpointDevDb } from './db';

const force = process.argv.includes('--force');

async function main() {
  console.log(`[seed:dev] iniciando${force ? ' (--force)' : ''}...`);
  const db = openDevDb();

  // Base seeds (idempotent on their own — never wiped with --force)
  runSeed(db);
  runCatalogSeed(db);

  if (force) {
    console.log('[seed:dev] borrando datos de desarrollo...');
    wipeVentas(db);
    wipePersonas(db);
    wipeCatalog(db);
  }

  seedCatalog(db, false);
  seedPersonas(db, false);
  seedVentas(db, false);

  checkpointDevDb();
  console.log('[seed:dev] listo.');
}

main().catch(err => { console.error(err); process.exit(1); });
