'use strict';
// Hub de sync de Retail en desarrollo (F2, ADR-158): corre src/main/hub/cli.ts con el runtime de
// Electron en modo Node (mismo NMV que better-sqlite3). Uso: pnpm hub [iniciar|codigo|terminales|revocar <id>|huella].
// La carpeta de datos por defecto es la del hub del sistema operativo; GESTION_HUB_DIR la pisa.
const { spawnSync } = require('child_process');
const path = require('path');

const clientDir   = path.resolve(__dirname, '..');
const electronExe = require(require.resolve('electron', { paths: [clientDir] }));
const tsxCjs      = path.resolve(clientDir, '../../node_modules/tsx/dist/cjs/index.cjs');
const script      = path.resolve(clientDir, 'src/main/hub/cli.ts');

const result = spawnSync(
  electronExe,
  ['--require', tsxCjs, script, ...process.argv.slice(2)],
  { cwd: clientDir, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
);

process.exit(result.status ?? 0);
