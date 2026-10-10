import { providerFetch, ollamaUrl } from "./transport.ts";
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
  const response = await providerFetch(ollamaUrl(baseUrl, "/api/pull"), {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: true }),
  });
  if (!response.ok || !response.body)
    throw new Error(`Téléchargement indisponible (${response.status}).`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "",
    success = false;
  const parse = (line: string) => {
    if (!line.trim()) return;
    const p = JSON.parse(line);
    if (p.error) throw new Error(String(p.error));
    onProgress(p);
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
