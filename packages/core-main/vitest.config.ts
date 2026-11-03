import { defineConfig } from 'vitest/config';

// Tests puros (Node del sistema). Los que abren SQLite (`*.db.test.ts`) necesitan el NMV de Electron
// y corren aparte con `scripts/test-node.cjs` (vitest.node.config.ts).
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.db.test.ts'],
  },
});
