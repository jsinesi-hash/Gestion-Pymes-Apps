'use strict';
// Construye el instalador NSIS con electron-builder usando la salida de electron-forge.
// Llama a electron-forge desde el root node_modules para evitar el shim corrupto
// en packages/client/node_modules/.bin (residuo del incidente npm anterior).
// Uso: node scripts/dist.cjs [--publish always]
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const clientDir  = path.resolve(__dirname, '..');
const rootDir    = path.resolve(clientDir, '../..');
const outDir     = path.join(clientDir, 'out');

// electron-builder no logra autodetectar la versión de Electron en el layout de pnpm:
// `electron` vive hoisteado en el node_modules RAÍZ (no en packages/client/node_modules)
// y en package.json la versión es un rango (`^32.x`), no un valor fijo. Con --prepackaged
// sólo la necesita como metadato, así que la resolvemos a mano leyendo el package.json de
// electron (client primero, root como fallback) y se la pasamos explícita más abajo.
// Ref: electron-userland/electron-builder#3984.
function detectElectronVersion() {
  const candidates = [
    path.join(clientDir, 'node_modules', 'electron', 'package.json'),
    path.join(rootDir, 'node_modules', 'electron', 'package.json'),
  ];
  for (const p of candidates) {
    try {
      const v = require(p).version;
      if (v) return v;
    } catch { /* probar siguiente candidato */ }
  }
  return null;
}

// 1. Empaquetar con electron-forge (equivalente a pnpm build)
console.log('\n── Paso 1: electron-forge package ──────────────────────────');
const forgeCli = path.join(rootDir, 'node_modules', '@electron-forge', 'cli', 'dist', 'electron-forge.js');
const forgeResult = spawnSync(
  process.execPath,
  [forgeCli, 'package'],
  { cwd: clientDir, stdio: 'inherit' }
);
if (forgeResult.status !== 0) {
  console.error('electron-forge package falló.');
  process.exit(forgeResult.status ?? 1);
}

// 2. Encuentra el directorio empaquetado en out/
const packages = fs.readdirSync(outDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('make'))
  .map(d => d.name);

if (packages.length === 0) {
  console.error('No se encontró directorio de app en out/ tras el packaging.');
  process.exit(1);
}
const prepackaged = path.join(outDir, packages[0]);

// 2.b Inyectar app-update.yml en resources/ del paquete prepackaged.
// electron-updater lo lee en runtime desde process.resourcesPath. Con
// --prepackaged, electron-builder NO ejecuta el afterPack que normalmente lo
// genera, así que sin esta copia el auto-update queda muerto (no arranca el
// updater). Copiamos el archivo versionado de build/app-update.yml y verificamos.
const appUpdateSrc  = path.join(clientDir, 'build', 'app-update.yml');
const resourcesDir  = path.join(prepackaged, 'resources');
const appUpdateDest = path.join(resourcesDir, 'app-update.yml');
if (!fs.existsSync(appUpdateSrc)) {
  console.error(`No existe ${appUpdateSrc}; sin él no hay auto-update.`);
  process.exit(1);
}
fs.mkdirSync(resourcesDir, { recursive: true });
fs.copyFileSync(appUpdateSrc, appUpdateDest);
if (!fs.existsSync(appUpdateDest)) {
  console.error(`Falló la copia de app-update.yml a ${appUpdateDest}.`);
  process.exit(1);
}
console.log(`app-update.yml inyectado en: ${appUpdateDest}`);

console.log(`\n── Paso 2: electron-builder NSIS ────────────────────────────`);
console.log(`Usando prepackaged: ${prepackaged}`);

// 3. Generar instalador NSIS con electron-builder
const builderCli = path.join(rootDir, 'node_modules', 'electron-builder', 'cli.js');
const extraArgs  = process.argv.slice(2);  // ej. --publish always

const electronVersion = detectElectronVersion();
const versionArgs = electronVersion ? [`-c.electronVersion=${electronVersion}`] : [];
if (electronVersion) {
  console.log(`electronVersion detectada: ${electronVersion}`);
} else {
  console.warn('No se pudo detectar la versión de Electron; electron-builder intentará autodetectarla.');
}

const builderResult = spawnSync(
  process.execPath,
  [builderCli, '--win', 'nsis', '--prepackaged', prepackaged, ...versionArgs, ...extraArgs],
  { cwd: clientDir, stdio: 'inherit' }
);

process.exit(builderResult.status ?? 0);
