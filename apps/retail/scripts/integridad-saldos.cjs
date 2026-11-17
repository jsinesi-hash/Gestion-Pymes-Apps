'use strict';
// Corre el test de integridad de saldos (ADR-151) con el runtime de Electron (mismo NMV que better-sqlite3 compilado).
// ELECTRON_RUN_AS_NODE=1 hace que electron.exe se comporte como Node.js puro: sin UI,
// sin Vite, sin IPC. Abre la base en solo lectura: no migra ni escribe.
const { spawnSync } = require('child_process');
const path = require('path');

const clientDir   = path.resolve(__dirname, '..');
// Electron está hoisteado a la raíz del monorepo: se resuelve con la búsqueda normal de módulos.
const electronExe = require(require.resolve('electron', { paths: [clientDir] }));
const tsxCjs      = path.resolve(clientDir, '../../node_modules/tsx/dist/cjs/index.cjs');
const script      = path.resolve(clientDir, 'src/main/dev-seed/integridad-saldos.ts');

const result = spawnSync(
  electronExe,
  ['--require', tsxCjs, script, ...process.argv.slice(2)],
  { cwd: clientDir, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
);

process.exit(result.status ?? 0);
