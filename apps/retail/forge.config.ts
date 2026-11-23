import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import fs from 'node:fs';
import path from 'node:path';

const config: ForgeConfig = {
  hooks: {
    // pnpm crea junctions de Windows en packages/client/node_modules que electron-packager
    // no sigue. Copiamos better-sqlite3 resolviendo el junction al path real.
    packageAfterCopy: async (_forgeConfig, buildPath, electronVersion, _platform, arch) => {
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
      // ADR-111 (mismo arreglo que Elaborados): el better-sqlite3 del root ya está compilado para Electron
      // (`pnpm rebuild:electron`) y no siempre hay toolchain de C++ (Visual Studio). Marcamos la copia como
      // "ya reconstruida" para que electron-rebuild no intente compilar desde código fuente. Si el binario
      // fuera de otro ABI, el paquete no arranca: hay que verificarlo abriendo el .exe antes de publicar.
      const meta = path.join(buildPath, 'node_modules', 'better-sqlite3', 'build', 'Release', '.forge-meta');
      if (fs.existsSync(path.dirname(meta)) && !fs.existsSync(meta)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getAbi } = require(require.resolve('node-abi', { paths: [path.join(rootModules, '@electron', 'rebuild')] }));
        fs.writeFileSync(meta, `${arch}--${getAbi(electronVersion, 'electron')}`);
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
    // F2 PR6 (ADR-158 §2): el hub corre en Windows, Linux y macOS. Un zip por plataforma, sin makers
    // nuevos (cada uno se arma en su sistema operativo).
    new MakerZIP({}, ['win32', 'linux', 'darwin']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts',    config: 'vite.main.config.mts',    target: 'main' },
        // F2 PR6: la entrada del hub (`cli.js`), al lado del main; la corre el ejecutable de la app en
        // modo Node (`ELECTRON_RUN_AS_NODE=1`) cuando esta PC es el servidor.
        { entry: 'src/main/hub/cli.ts',  config: 'vite.main.config.mts',    target: 'main' },
        { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts', target: 'preload' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.ts' },
      ],
    }),
  ],
};

export default config;
