import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Tests con base de datos del hub: se ejecutan bajo el binario de Electron (ELECTRON_RUN_AS_NODE).
export default defineConfig({
  resolve: {
    alias: {
      '@ferreteria/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@core/db': path.resolve(__dirname, '../core-db/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.db.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
