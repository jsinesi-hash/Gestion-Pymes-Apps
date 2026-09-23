import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@ferreteria/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@core/db': path.resolve(__dirname, '../../packages/core-db/src/index.ts'),
      '@core/main': path.resolve(__dirname, '../../packages/core-main/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/main/**/*.test.ts'],
  },
});
