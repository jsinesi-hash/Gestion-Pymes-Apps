import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'node:path';

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'src/main/db/migrations/*',
          dest: 'migrations',
        },
      ],
    }),
  ],
  build: {
    rollupOptions: {
      external: ['better-sqlite3'],
    },
  },
  resolve: {
    alias: {
      '@ferreteria/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@core/db': path.resolve(__dirname, '../../packages/core-db/src/index.ts'),
    },
  },
});
