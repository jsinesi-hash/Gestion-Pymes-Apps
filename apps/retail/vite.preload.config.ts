import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', 'better-sqlite3'],
      output: {
        entryFileNames: 'preload.js',
      },
    },
  },
  resolve: {
    alias: {
      '@ferreteria/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@core/db': path.resolve(__dirname, '../../packages/core-db/src/index.ts'),
    },
  },
});
