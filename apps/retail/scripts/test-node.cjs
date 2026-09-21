'use strict';
// Corre los tests del main process usando el runtime de Electron (mismo NMV que
// better-sqlite3 compilado). ELECTRON_RUN_AS_NODE=1 hace que electron.exe se comporte
// como Node.js puro: sin UI, sin Vite, sin IPC.
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const clientDir   = path.resolve(__dirname, '..');
// Resolver electron caminando hacia arriba por node_modules (compatible con layout
// hoisted del monorepo, donde electron vive en la raiz y no en packages/client).
const electronExe = require(require.resolve('electron', { paths: [clientDir] }));

// Localiza el CLI de vitest desde su propio package.json (compatible con cualquier versión)
const vitestPkgPath  = require.resolve('vitest/package.json', { paths: [clientDir] });
const vitestPkg      = JSON.parse(fs.readFileSync(vitestPkgPath, 'utf8'));
const vitestBinEntry = typeof vitestPkg.bin === 'string' ? vitestPkg.bin : vitestPkg.bin.vitest;
const vitestCli      = path.resolve(path.dirname(vitestPkgPath), vitestBinEntry);

const result = spawnSync(
  electronExe,
  [vitestCli, 'run', '--config', 'vitest.node.config.ts', '--passWithNoTests'],
  {
    cwd: clientDir,
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  }
);

process.exit(result.status ?? 0);
