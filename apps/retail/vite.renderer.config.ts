import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // root: 'src/renderer' desplaza el outDir a src/renderer/.vite/... y el
  // filtro del VitePlugin (only /.vite/*) excluye el renderer del asar.
  // Se fija outDir como path absoluto para que siempre quede en .vite/renderer/main_window/
  // independientemente del root que inyecte el VitePlugin.
  root: 'src/renderer',
  plugins: [react()],
  resolve: {
    // Array form: '@core/ui' va como regex EXACTA (^@core/ui$) para que el barrel JS use
    // el source, pero los subpaths (p.ej. '@core/ui/styles/global.css') NO matcheen el alias
    // y caigan a la resolución por el mapa `exports` del package (un alias string es greedy y
    // reescribiría el subpath a '.../src/index.ts/styles/global.css').
    alias: [
      { find: /^@core\/ui$/, replacement: path.resolve(__dirname, '../../packages/core-ui/src/index.ts') },
      { find: '@core/db', replacement: path.resolve(__dirname, '../../packages/core-db/src/index.ts') },
      { find: '@ferreteria/shared', replacement: path.resolve(__dirname, '../../packages/shared/src/index.ts') },
    ],
  },
  build: {
    outDir: path.join(__dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
  },
});
