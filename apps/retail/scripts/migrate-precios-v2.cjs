'use strict';
// Migración de datos ADR-034: crea Lista General + siembra lista_precio_valor
// para todos los productos × listas activas.
// Corre bajo el binario de Electron (mismo NMV que better-sqlite3).
const { spawnSync } = require('child_process');
const path = require('path');

const clientDir   = path.resolve(__dirname, '..');
const electronExe = require(path.resolve(clientDir, 'node_modules/electron'));
const tsxCjs      = path.resolve(clientDir, '../../node_modules/tsx/dist/cjs/index.cjs');
const seedScript  = path.resolve(clientDir, 'src/main/dev-seed/precios-v2.ts');

const result = spawnSync(
  electronExe,
  ['--require', tsxCjs, seedScript, ...process.argv.slice(2)],
  { cwd: clientDir, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
);

process.exit(result.status ?? 0);
