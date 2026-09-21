'use strict';
// Corre el seed con el runtime de Electron (mismo NMV que better-sqlite3 compilado).
// ELECTRON_RUN_AS_NODE=1 hace que electron.exe se comporte como Node.js puro: sin UI,
// sin Vite, sin IPC — solo el addon nativo y el seed script.
const { spawnSync } = require('child_process');
const path = require('path');

const clientDir   = path.resolve(__dirname, '..');
const electronExe = require(path.resolve(clientDir, 'node_modules/electron'));
const tsxCjs      = path.resolve(clientDir, '../../node_modules/tsx/dist/cjs/index.cjs');
const seedScript  = path.resolve(clientDir, 'src/main/dev-seed/index.ts');

const result = spawnSync(
  electronExe,
  ['--require', tsxCjs, seedScript, ...process.argv.slice(2)],
  { cwd: clientDir, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
);

process.exit(result.status ?? 0);
