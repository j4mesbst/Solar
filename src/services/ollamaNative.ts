import { Channel, invoke } from "@tauri-apps/api/core";

export interface OllamaStatus {
  supported: boolean;
  installed: boolean;
  running: boolean;
  version: string | null;
  models: string[];
  loaded_models: string[];
  downloaded_models: string[];
  error: string | null;
}

const emptyStatus = (): OllamaStatus => ({
  supported: false,
  installed: false,
  running: false,
  version: null,
  models: [],
  loaded_models: [],
  downloaded_models: [],
  error: "La détection Ollama est disponible dans l’application macOS.",
});

export function isNativeSolar() {
  return typeof window !== "undefined" && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

export async function inspectOllama(baseUrl: string): Promise<OllamaStatus> {
  if (!isNativeSolar()) return emptyStatus();
  return invoke<OllamaStatus>("ollama_status", { baseUrl });
}

export async function startOllama() {
  if (!isNativeSolar()) throw new Error("Le démarrage d’Ollama nécessite l’application macOS.");
  await invoke("ollama_start");
}

type OllamaChatEvent =
  | { type: "headers"; status: number; error?: string | null }
  | { type: "chunk"; data: string }
  | { type: "error"; message: string }
  | { type: "done" };

export async function streamNativeOllamaChat(baseUrl: string, payload: unknown, signal: AbortSignal): Promise<Response> {
  if (!isNativeSolar()) throw new Error("Le transport natif Ollama est disponible dans l’application macOS.");
  if (signal.aborted) throw new DOMException("Requête interrompue", "AbortError");
  const requestId = crypto.randomUUID();
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let headersReceived = false;
  let settleHeaders!: (event: Extract<OllamaChatEvent, { type: "headers" }>) => void;
  let rejectHeaders!: (error: Error) => void;
  const headersReady = new Promise<Extract<OllamaChatEvent, { type: "headers" }>>((resolve, reject) => { settleHeaders = resolve; rejectHeaders = reject; });
  const channel = new Channel<OllamaChatEvent>();
  let disposed = false;
  const cleanup = () => { if (!disposed) { disposed = true; signal.removeEventListener("abort", onAbort); } };
  const cancelNative = () => { void invoke("ollama_cancel", { requestId }).catch(() => {}); };
  const onAbort = () => { cancelNative(); if (!headersReceived) rejectHeaders(new DOMException("Requête interrompue", "AbortError")); };
  channel.onmessage = event => {
    if (event.type === "headers" && !headersReceived) { headersReceived = true; settleHeaders(event); return; }
    if (event.type === "chunk") { try { controller?.enqueue(encoder.encode(event.data)); } catch { /* Consumer already cancelled. */ } return; }
    if (event.type === "error") {
      const error = new Error(event.message);
      if (!headersReceived) rejectHeaders(error);
      else try { controller?.error(error); } catch { /* Stream already closed. */ }
      cleanup();
      return;
    }
    if (event.type === "done") { try { controller?.close(); } catch { /* Stream already closed. */ } cleanup(); }
  };
  signal.addEventListener("abort", onAbort, { once: true });
  const body = new ReadableStream<Uint8Array>({ start(value) { controller = value; }, cancel() { cancelNative(); cleanup(); } });
  void invoke("ollama_chat_stream", { baseUrl, requestId, payload, onEvent: channel }).catch(error => {
    const failure = error instanceof Error ? error : new Error(String(error));
    if (!headersReceived) rejectHeaders(failure);
    else try { controller?.error(failure); } catch { /* Stream already closed. */ }
    cleanup();
  });
  try {
    const response = await headersReady;
    return new Response(body, { status: response.status, headers: response.error ? { "x-ollama-error": response.error } : undefined });
  } catch (error) {
    cancelNative();
    cleanup();
    throw error;
  }
}
