import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    // Bajo contención de CPU (varias corridas a la vez, o la suite completa con muchos workers jsdom) un
    // test normal de ~0,5 s puede tardar más de 5 s en arrancar: el límite por defecto daba falsos
    // timeouts en tests distintos según la corrida (AppShell, StockAjusteModal, PosView). Se midió.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
