'use strict';
// Corre seed:base con el runtime de Electron (mismo NMV que better-sqlite3).
// Aplica migraciones y siembra auth+catalog+geo en la DB de producción.
const { spawnSync } = require('child_process');
const path = require('path');

const clientDir   = path.resolve(__dirname, '..');
const electronExe = require(path.resolve(clientDir, 'node_modules/electron'));
const tsxCjs      = path.resolve(clientDir, '../../node_modules/tsx/dist/cjs/index.cjs');
const seedScript  = path.resolve(clientDir, 'src/main/base-seed/index.ts');

const result = spawnSync(
  electronExe,
  ['--require', tsxCjs, seedScript, ...process.argv.slice(2)],
  { cwd: clientDir, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', BASE_SEED_CLI: '1' } }
);

process.exit(result.status ?? 0);
