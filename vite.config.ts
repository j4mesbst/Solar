import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {webReferenceProxy} from './server/webReferenceProxy';

const publicSearchProxy=(proxy:any)=>{proxy.on('proxyReq',(request:any)=>{for(const name of request.getHeaderNames())if(/^(?:cookie|authorization|origin|referer|sec-)/i.test(name))request.removeHeader(name);});};
export default defineConfig({
  plugins: [react(), tailwindcss(),{name:'solar-public-reference',configureServer(server){server.middlewares.use('/solar-web-reference',(req,res)=>{void webReferenceProxy(req,res);});}}],
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
      "/solar-web-bing": {target:"https://www.bing.com",changeOrigin:true,configure:publicSearchProxy,headers:{"User-Agent":"Solar/0.8.0"},timeout:15000,proxyTimeout:15000,rewrite:path=>path.replace(/^\/solar-web-bing/,"")},
      "/solar-web": { target: "https://html.duckduckgo.com", changeOrigin: true,configure:publicSearchProxy, headers:{"User-Agent":"Solar/0.8.0"}, timeout: 15000, proxyTimeout: 15000, rewrite: path => path.replace(/^\/solar-web/, "") },
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
