'use strict';
// Construye el instalador NSIS de Elaborados con electron-builder usando la salida de electron-forge.
// Mismo flujo que Retail pero SIN auto-update ni publicación (ADR-111: instalación manual).
// Uso: node scripts/dist.cjs
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const appDir  = path.resolve(__dirname, '..');
const rootDir = path.resolve(appDir, '../..');
const outDir  = path.join(appDir, 'out');

// electron-builder no autodetecta la versión de Electron en el layout de pnpm (vive hoisteada en el
// node_modules raíz y en package.json es un rango). Con --prepackaged solo es metadato: la resolvemos a mano.
function detectElectronVersion() {
  for (const p of [
    path.join(appDir, 'node_modules', 'electron', 'package.json'),
    path.join(rootDir, 'node_modules', 'electron', 'package.json'),
  ]) {
    try {
      const v = require(p).version;
      if (v) return v;
    } catch { /* probar el siguiente candidato */ }
  }
  return null;
}

console.log('\n── Paso 1: electron-forge package ──────────────────────────');
const forgeCli = path.join(rootDir, 'node_modules', '@electron-forge', 'cli', 'dist', 'electron-forge.js');
const forge = spawnSync(process.execPath, [forgeCli, 'package'], { cwd: appDir, stdio: 'inherit' });
if (forge.status !== 0) {
  console.error('electron-forge package falló.');
  process.exit(forge.status ?? 1);
}

const packages = fs.existsSync(outDir)
  ? fs.readdirSync(outDir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('make')).map((d) => d.name)
  : [];
if (packages.length === 0) {
  console.error('No se encontró directorio de app en out/ tras el packaging.');
  process.exit(1);
}
const prepackaged = path.join(outDir, packages[0]);

console.log('\n── Paso 2: electron-builder NSIS ────────────────────────────');
console.log(`Usando prepackaged: ${prepackaged}`);
const builderCli = path.join(rootDir, 'node_modules', 'electron-builder', 'cli.js');
const electronVersion = detectElectronVersion();
const versionArgs = electronVersion ? [`-c.electronVersion=${electronVersion}`] : [];
if (electronVersion) console.log(`electronVersion detectada: ${electronVersion}`);
else console.warn('No se pudo detectar la versión de Electron; electron-builder intentará autodetectarla.');

const builder = spawnSync(
  process.execPath,
  [builderCli, '--win', 'nsis', '--prepackaged', prepackaged, ...versionArgs, '--publish', 'never'],
  { cwd: appDir, stdio: 'inherit' },
);
process.exit(builder.status ?? 0);
