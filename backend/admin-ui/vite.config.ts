import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/connection-admin/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    port: 3002, // Admin UI dev server on :3002 to avoid conflicts
    proxy: {
      '/api': {
        target: 'http://localhost:4310', // Backend server
        changeOrigin: true,
      }
    }
  }
});
