import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // '@core/ui' como regex EXACTA para no romper subpaths (CSS) — ver nota en vite.renderer.config.ts.
    alias: [
      { find: /^@core\/ui$/, replacement: path.resolve(__dirname, '../../packages/core-ui/src/index.ts') },
      { find: '@core/db', replacement: path.resolve(__dirname, '../../packages/core-db/src/index.ts') },
      { find: '@ferreteria/shared', replacement: path.resolve(__dirname, '../../packages/shared/src/index.ts') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/renderer/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/renderer/test-setup.ts'],
  },
});
