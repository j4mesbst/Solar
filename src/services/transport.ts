export async function providerFetch(input: string, init?: RequestInit): Promise<Response> {
  if (typeof window !== "undefined" && (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    const { fetch } = await import("@tauri-apps/plugin-http"); return fetch(input, init);
  }
  return globalThis.fetch(input, init);
}
export function ollamaUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const dev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
  if (dev && typeof window !== "undefined" && !(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ && ["http://127.0.0.1:11434", "http://localhost:11434"].includes(base)) return `/solar-ollama${path}`;
  return `${base}${path}`;
}
