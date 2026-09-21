import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import fs from 'node:fs';
import path from 'node:path';

const config: ForgeConfig = {
  hooks: {
    // pnpm crea junctions de Windows en packages/client/node_modules que electron-packager
    // no sigue. Copiamos better-sqlite3 resolviendo el junction al path real.
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      // better-sqlite3 y sus deps de runtime viven en el root node_modules (hoisted);
      // electron-packager no sigue junctions de Windows así que no las incluye.
      const rootModules = path.join(__dirname, '..', '..', 'node_modules');
      const pkgs = ['better-sqlite3', 'bindings', 'file-uri-to-path'];
      for (const pkg of pkgs) {
        const src = path.join(rootModules, pkg);
        const dest = path.join(buildPath, 'node_modules', pkg);
        if (!fs.existsSync(dest)) {
          fs.cpSync(src, dest, { recursive: true, dereference: true });
        }
      }
    },
  },
  packagerConfig: {
    name: 'Ferretería',
    executableName: 'ferreteria',
    icon: path.join(__dirname, 'assets/icon'),  // electron-packager agrega .ico/.icns automáticamente
    // Manual de usuario (HTML): viaja fuera del asar, en Resources/guias/. El main lo
    // localiza vía process.resourcesPath (ver src/main/menu/appMenu.ts:resolveManualPath).
    extraResource: ['../../docs/Documentacion/Usuario/guias'],
    asar: {
      // migrate() lee los archivos de migración en runtime; no pueden estar comprimidos.
      // better-sqlite3 es un native module binario; tampoco puede ir comprimido.
      unpack: '**/*.node',
      unpackDir: '**/migrations',
    },
  },
  rebuildConfig: {
    extraModules: ['better-sqlite3'],
  },
  makers: [
    new MakerZIP({}, ['win32']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts',    config: 'vite.main.config.mts',    target: 'main' },
        { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts', target: 'preload' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.ts' },
      ],
    }),
  ],
};

export default config;
