import { providerFetch, ollamaUrl } from "./transport.ts";
function errorText(reason: unknown) {
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === "string" && reason.trim()) return reason.trim();
  if (reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string") return reason.message;
  try { return JSON.stringify(reason); } catch { return String(reason); }
}

async function responseError(response: Response) {
  const body = await response.text().catch(() => "");
  if (body) {
    try {
      const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
      const detail = parsed.error ?? parsed.message;
      if (typeof detail === "string" && detail.trim()) return detail.trim().slice(0, 700);
    } catch { /* Keep a plain-text server error below. */ }
    return body.trim().slice(0, 700);
  }
  return [response.status, response.statusText].filter(Boolean).join(" ");
}

export interface PullProgress {
  status: string;
  completed?: number;
  total?: number;
}
export async function pullModel(
  baseUrl: string,
  model: string,
  signal: AbortSignal,
  onProgress: (p: PullProgress) => void,
) {
  if (!/^[a-zA-Z0-9_.:/-]+$/.test(model) || model.length > 160)
    throw new Error("Nom de modèle invalide");
  let response: Response;
  try {
    response = await providerFetch(ollamaUrl(baseUrl, "/api/pull"), {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
    });
  } catch (reason) {
    if (signal.aborted) throw new Error("Téléchargement annulé.");
    throw new Error(`Connexion à Ollama impossible : ${errorText(reason)}`);
  }
  if (!response.ok) throw new Error(`Ollama a refusé le téléchargement (${await responseError(response)}).`);
  if (!response.body) throw new Error("Ollama n’a pas fourni le flux de progression du téléchargement.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "",
    success = false;
  const parse = (line: string) => {
    if (!line.trim()) return;
    let p: { error?: unknown; status?: unknown };
    try { p = JSON.parse(line); }
    catch (reason) { throw new Error(`Flux Ollama illisible : ${errorText(reason)}`); }
    if (p.error) throw new Error(String(p.error));
    onProgress({ status: String(p.status ?? "Téléchargement…"), ...(typeof (p as { completed?: unknown }).completed === "number" ? { completed: (p as { completed: number }).completed } : {}), ...(typeof (p as { total?: unknown }).total === "number" ? { total: (p as { total: number }).total } : {}) });
    if (p.status === "success") success = true;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) parse(line);
      if (done) {
        parse(buffer);
        break;
      }
    }
    if (!success)
      throw new Error(
        "Le téléchargement s’est arrêté avant sa confirmation. Réessaie pour reprendre les couches déjà téléchargées.",
      );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
