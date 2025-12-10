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
      '/connection-admin/api': {
        target: 'http://localhost:3001', // Backend server (changed from 3000 to avoid pm2 conflict)
        changeOrigin: true,
      }
    }
  }
});
