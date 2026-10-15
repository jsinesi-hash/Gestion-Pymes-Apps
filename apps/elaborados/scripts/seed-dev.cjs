'use strict';
// `pnpm seed:dev` — corre src/main/dev-seed/index.ts con el runtime de Electron (mismo NMV que
// better-sqlite3 compilado). ELECTRON_RUN_AS_NODE=1 hace que electron.exe se comporte como
// Node.js puro: sin UI, sin Vite, sin IPC — solo el addon nativo y el seed (vía tsx).
// BD: DB_PATH si está definida; si no %APPDATA%/elaborados-client/elaborados.db.
const { spawnSync } = require('child_process');
const path = require('path');

const clientDir   = path.resolve(__dirname, '..');
// Resolver electron/tsx caminando hacia arriba por node_modules (layout hoisted del monorepo).
const electronExe = require(require.resolve('electron', { paths: [clientDir] }));
const tsxCjs      = path.join(path.dirname(require.resolve('tsx/package.json', { paths: [clientDir] })), 'dist/cjs/index.cjs');
const seedScript  = path.resolve(clientDir, 'src/main/dev-seed/index.ts');

const result = spawnSync(
  electronExe,
  ['--require', tsxCjs, seedScript, ...process.argv.slice(2)],
  { cwd: clientDir, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', DEV_SEED_CLI: '1' } }
);

process.exit(result.status ?? 1);
