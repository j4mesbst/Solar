import type { Effort, Message, Provider } from "../domain/types";
import type { SecretVault } from "./contracts";

export class ChatError extends Error {
  readonly code: "provider" | "model" | "unauthorized" | "network" | "invalid-response" | "interrupted";
  constructor(message: string, code: "provider" | "model" | "unauthorized" | "network" | "invalid-response" | "interrupted") { super(message); this.code = code; }
}
const completionUrl = (provider: Provider) => `${provider.baseUrl.replace(/\/$/, "")}/chat/completions`;

export async function streamChat(input: { provider: Provider; model: string; messages: Message[]; effort: Effort; vault: SecretVault; signal: AbortSignal; onDelta: (text: string) => void }) {
  const key = await input.vault.get(input.provider.secretRef);
  if (!key) throw new ChatError("Aucune clé API n’est enregistrée pour ce fournisseur.", "unauthorized");
  const apiKey = key.trim();
  const body = {
    model: input.model,
    stream: true,
    messages: input.messages.filter(message => message.role !== "assistant" || message.status === "completed").map(message => ({ role: message.role, content: message.content })),
    // Gonka's OpenAI-compatible endpoint accepts common chat fields. Effort is retained locally;
    // it is not sent because it is not a documented universal Gonka parameter.
  };
  let response: Response;
  try { response = await fetch(completionUrl(input.provider), { method: "POST", signal: input.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey, Accept: "text/event-stream" }, body: JSON.stringify(body) }); }
  catch (error) { if (input.signal.aborted) throw new ChatError("La génération a été interrompue.", "interrupted"); throw new ChatError("Impossible de joindre Gonka Router. Vérifie ta connexion et l’URL du fournisseur.", "network"); }
  if (response.status === 401 || response.status === 403) throw new ChatError("La clé API a été refusée par le fournisseur.", "unauthorized");
  if (response.status === 404) throw new ChatError("Le modèle ou l’URL de l’API est introuvable.", "model");
  if (!response.ok || !response.body) throw new ChatError(`Le fournisseur a répondu ${response.status}.`, "provider");

  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim(); if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim(); if (data === "[DONE]") return;
        try { const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: unknown } }> }; const delta = payload.choices?.[0]?.delta?.content; if (typeof delta === "string" && delta) input.onDelta(delta); }
        catch { throw new ChatError("Le flux de réponse du fournisseur est invalide.", "invalid-response"); }
      }
    }
  } catch (error) { if (input.signal.aborted) throw new ChatError("La génération a été interrompue.", "interrupted"); if (error instanceof ChatError) throw error; throw new ChatError("Le flux de réponse a été interrompu.", "network"); }
}
