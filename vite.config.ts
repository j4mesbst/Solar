import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  clearScreen: false,
  build: { rollupOptions: { output: { manualChunks(id) { if (id.includes("node_modules/katex")) return "math"; if (id.includes("node_modules/highlight.js")) return "syntax"; } } } },
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
    // The router API does not grant browser CORS access. During `npm run dev`,
    // route only its requests through Vite; the native Tauri build uses the
    // provider URL directly.
    proxy: {
      "/solar-anthropic": {target:"https://api.anthropic.com",changeOrigin:true,timeout:120000,proxyTimeout:120000,rewrite:path=>path.replace(/^\/solar-anthropic/,"")},
      "/solar-ollama": { target: "http://127.0.0.1:11434", changeOrigin: true, timeout: 120000, proxyTimeout: 120000, rewrite: path => path.replace(/^\/solar-ollama/, "") },
      "/solar-router": {
        target: "https://api.gonkarouter.io",
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
        rewrite: (path) => path.replace(/^\/solar-router/, "")
      }
    }
  }
});
