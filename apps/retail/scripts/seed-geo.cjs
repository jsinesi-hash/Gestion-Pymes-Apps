'use strict';
// Lanza el seed de geografía con el runtime de Electron (mismo ABI que better-sqlite3).
// Calcado de seed-dev.cjs: ELECTRON_RUN_AS_NODE=1 hace que electron.exe corra como Node puro.
const { spawnSync } = require('child_process');
const path = require('path');

const clientDir   = path.resolve(__dirname, '..');
const electronExe = require(path.resolve(clientDir, 'node_modules/electron'));
const tsxCjs      = path.resolve(clientDir, '../../node_modules/tsx/dist/cjs/index.cjs');
const seedScript  = path.resolve(clientDir, '../../packages/core-main/src/seed/geo.ts');
// El seed vive en @core/main: corre con cwd = packages/core-main (su CACHE_DIR es
// `<cwd>/geo-cache`) y recibe la carpeta de migraciones de Retail por env.
const coreMainDir   = path.resolve(clientDir, '../../packages/core-main');
const migrationsDir = path.resolve(clientDir, 'src/main/db/migrations');

const result = spawnSync(
  electronExe,
  ['--require', tsxCjs, seedScript, ...process.argv.slice(2)],
  { cwd: coreMainDir, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', GEO_SEED_CLI: '1', GEO_SEED_MIGRATIONS_DIR: migrationsDir } }
);

process.exit(result.status ?? 0);
