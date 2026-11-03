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
    // Bajo contención de CPU (varias corridas a la vez, o la suite completa con muchos workers jsdom) un
    // test normal de ~0,5 s puede tardar más de 5 s en arrancar: el límite por defecto daba falsos
    // timeouts en tests distintos según la corrida (AppShell, StockAjusteModal, PosView). Se midió.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
