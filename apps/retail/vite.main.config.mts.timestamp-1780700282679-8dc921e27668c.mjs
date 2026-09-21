// vite.main.config.mts
import { defineConfig } from "file:///C:/Users/Joaco/Downloads/Ferreteria-app/node_modules/.pnpm/vite@5.4.21_@types+node@25.9.1_terser@5.48.0/node_modules/vite/dist/node/index.js";
import { viteStaticCopy } from "file:///C:/Users/Joaco/Downloads/Ferreteria-app/node_modules/.pnpm/vite-plugin-static-copy@2.3_4e5b4ac801fd6af64d45227617a4ae96/node_modules/vite-plugin-static-copy/dist/index.js";
import path from "node:path";
var __vite_injected_original_dirname = "C:\\Users\\Joaco\\Downloads\\Ferreteria-app\\packages\\client";
var vite_main_config_default = defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "src/main/db/migrations/*",
          dest: "migrations"
        }
      ]
    })
  ],
  build: {
    rollupOptions: {
      external: ["better-sqlite3"]
    }
  },
  resolve: {
    alias: {
      "@ferreteria/shared": path.resolve(__vite_injected_original_dirname, "../shared/src/index.ts")
    }
  }
});
export {
  vite_main_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5tYWluLmNvbmZpZy5tdHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxKb2Fjb1xcXFxEb3dubG9hZHNcXFxcRmVycmV0ZXJpYS1hcHBcXFxccGFja2FnZXNcXFxcY2xpZW50XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxKb2Fjb1xcXFxEb3dubG9hZHNcXFxcRmVycmV0ZXJpYS1hcHBcXFxccGFja2FnZXNcXFxcY2xpZW50XFxcXHZpdGUubWFpbi5jb25maWcubXRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9Kb2Fjby9Eb3dubG9hZHMvRmVycmV0ZXJpYS1hcHAvcGFja2FnZXMvY2xpZW50L3ZpdGUubWFpbi5jb25maWcubXRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyB2aXRlU3RhdGljQ29weSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXN0YXRpYy1jb3B5JztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICB2aXRlU3RhdGljQ29weSh7XG4gICAgICB0YXJnZXRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzcmM6ICdzcmMvbWFpbi9kYi9taWdyYXRpb25zLyonLFxuICAgICAgICAgIGRlc3Q6ICdtaWdyYXRpb25zJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSksXG4gIF0sXG4gIGJ1aWxkOiB7XG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgZXh0ZXJuYWw6IFsnYmV0dGVyLXNxbGl0ZTMnXSxcbiAgICB9LFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAZmVycmV0ZXJpYS9zaGFyZWQnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vc2hhcmVkL3NyYy9pbmRleC50cycpLFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaVgsU0FBUyxvQkFBb0I7QUFDOVksU0FBUyxzQkFBc0I7QUFDL0IsT0FBTyxVQUFVO0FBRmpCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sMkJBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLGVBQWU7QUFBQSxNQUNiLFNBQVM7QUFBQSxRQUNQO0FBQUEsVUFDRSxLQUFLO0FBQUEsVUFDTCxNQUFNO0FBQUEsUUFDUjtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsTUFDYixVQUFVLENBQUMsZ0JBQWdCO0FBQUEsSUFDN0I7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxzQkFBc0IsS0FBSyxRQUFRLGtDQUFXLHdCQUF3QjtBQUFBLElBQ3hFO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
