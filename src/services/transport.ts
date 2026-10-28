export async function providerFetch(input: string, init?: RequestInit): Promise<Response> {
  if (typeof window !== "undefined" && (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    const { fetch } = await import("@tauri-apps/plugin-http"); return fetch(input, init);
  }
  return globalThis.fetch(input, init);
}
export function normalizeOllamaBaseUrl(baseUrl: string): string {
  try {
    const parsed = new URL(baseUrl.trim());
    if (parsed.hostname === "localhost") parsed.hostname = "127.0.0.1";
    return parsed.toString().replace(/\/$/, "");
  } catch { return baseUrl.trim().replace(/\/$/, ""); }
}
export function ollamaUrl(baseUrl: string, path: string): string {
  const base = normalizeOllamaBaseUrl(baseUrl);
  const dev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
  if (dev && typeof window !== "undefined" && !(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ && base === "http://127.0.0.1:11434") return `/solar-ollama${path}`;
  return `${base}${path}`;
}
