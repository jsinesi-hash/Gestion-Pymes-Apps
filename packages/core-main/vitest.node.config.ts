import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Tests con base de datos del núcleo: se ejecutan bajo el binario de Electron (ELECTRON_RUN_AS_NODE).
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
    setupFiles: ['src/testing/setup-db.ts'],
    // El seed hashea con scrypt (a propósito lento): el primer test de cada archivo en frío pasa de 5 s.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
