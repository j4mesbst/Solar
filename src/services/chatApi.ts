import type { Effort, Message, Provider } from "../domain/types";
import type { SecretVault } from "./contracts";

export class ChatError extends Error {
  readonly code: "provider" | "model" | "unauthorized" | "network" | "invalid-response" | "interrupted";
  constructor(message: string, code: "provider" | "model" | "unauthorized" | "network" | "invalid-response" | "interrupted") { super(message); this.code = code; }
}
const effortConfig: Record<Effort, { maxTokens: number; instruction: string }> = {
  low: { maxTokens: 512, instruction: "Réponds directement et de manière concise." },
  medium: { maxTokens: 1024, instruction: "Donne une réponse complète, claire et proportionnée à la question." },
  high: { maxTokens: 3072, instruction: "Analyse la demande avec soin, vérifie les points importants et donne une réponse approfondie et structurée." },
  ultra: { maxTokens: 4096, instruction: "Traite la demande de manière exhaustive : identifie les ambiguïtés, vérifie les hypothèses, compare les options utiles et fournis une réponse structurée et actionnable. Ne montre jamais ton raisonnement interne." }
};
const cleanVisibleText = (text: string) => text
  .replace(/<think>[\s\S]*?(<\/think>|$)/gi, "")
  .replace(/<analysis>[\s\S]*?(<\/analysis>|$)/gi, "");
const isGonkaRouter = (provider: Provider) => {
  try { return new URL(provider.baseUrl).hostname === "api.gonkarouter.io"; }
  catch { return false; }
};
const completionUrl = (provider: Provider) => {
  const baseUrl = provider.baseUrl.replace(/\/$/, "");
  const isDev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
  // Keep chat requests on the same Vite proxy as model discovery in browser preview.
  if (isDev && typeof window !== "undefined" && isGonkaRouter(provider)) return `/solar-router${new URL(baseUrl).pathname}/chat/completions`;
  return `${baseUrl}/chat/completions`;
};

export async function streamChat(input: { provider: Provider; model: string; messages: Message[]; effort: Effort; vault: SecretVault; signal: AbortSignal; onDelta: (text: string) => void }) {
  const key = await input.vault.get(input.provider.secretRef);
  if (!key) throw new ChatError("Aucune clé API n’est enregistrée pour ce fournisseur.", "unauthorized");
  const apiKey = key.trim();
  const effort = effortConfig[input.effort];
  const body = {
    model: input.model,
    stream: true,
    max_tokens: effort.maxTokens,
    messages: [{ role: "system", content: effort.instruction }, ...input.messages.filter(message => message.role !== "assistant" || message.status === "completed").map(message => ({ role: message.role, content: message.content }))],
  };
  let response: Response;
  try { response = await fetch(completionUrl(input.provider), { method: "POST", signal: input.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey, Accept: "text/event-stream" }, body: JSON.stringify(body) }); }
  catch (error) { if (input.signal.aborted) throw new ChatError("La génération a été interrompue.", "interrupted"); throw new ChatError("Impossible de joindre Gonka Router. Vérifie ta connexion et l’URL du fournisseur.", "network"); }
  if (response.status === 401 || response.status === 403) throw new ChatError("La clé API a été refusée par le fournisseur.", "unauthorized");
  if (response.status === 404) throw new ChatError("Le modèle ou l’URL de l’API est introuvable.", "model");
  if (!response.ok || !response.body) throw new ChatError(`Le fournisseur a répondu ${response.status}.`, "provider");

  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let generated = ""; let visible = "";
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim(); if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim(); if (data === "[DONE]") return;
        try { const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: unknown } }> }; const maybeDelta = payload.choices?.[0]?.delta?.content; if (typeof maybeDelta === "string" && maybeDelta) { let delta = maybeDelta; if (delta.startsWith(generated)) delta = delta.slice(generated.length); if (!delta || generated.endsWith(delta)) continue; generated += delta; const nextVisible = cleanVisibleText(generated); if (nextVisible.startsWith(visible)) { input.onDelta(nextVisible.slice(visible.length)); visible = nextVisible; } } }
        catch { throw new ChatError("Le flux de réponse du fournisseur est invalide.", "invalid-response"); }
      }
    }
  } catch (error) { if (input.signal.aborted) throw new ChatError("La génération a été interrompue.", "interrupted"); if (error instanceof ChatError) throw error; throw new ChatError("Le flux de réponse a été interrompu.", "network"); }
}
