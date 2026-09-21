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
    alias: {
      '@ferreteria/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@core/db': path.resolve(__dirname, '../../packages/core-db/src/index.ts'),
    },
  },
  build: {
    outDir: path.join(__dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
  },
});
