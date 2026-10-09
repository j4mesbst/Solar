import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
    // The router API does not grant browser CORS access. During `npm run dev`,
    // route only its requests through Vite; the native Tauri build uses the
    // provider URL directly.
    proxy: {
      "/solar-router": {
        target: "https://api.gonkarouter.io",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/solar-router/, "")
      }
    }
  }
});
