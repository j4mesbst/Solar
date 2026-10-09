import { messagePayload } from "./messagePayload.ts";
import { providerFetch, ollamaUrl } from "./transport.ts";
import type { Effort, Message, Provider } from "../domain/types";
import type { SecretVault } from "./contracts";

export class ChatError extends Error {
  readonly code: "provider" | "model" | "unauthorized" | "network" | "invalid-response" | "interrupted";
  constructor(message: string, code: ChatError["code"]) { super(message); this.code = code; }
}
const effortConfig: Record<Effort, { maxTokens: number; instruction: string }> = {
  low: { maxTokens: 512, instruction: "Réponds directement et de manière concise." },
  medium: { maxTokens: 1024, instruction: "Donne une réponse complète, claire et proportionnée à la question." },
  high: { maxTokens: 3072, instruction: "Analyse la demande avec soin et donne une réponse approfondie et structurée." },
  ultra: { maxTokens: 4096, instruction: "Traite la demande de manière exhaustive : identifie les ambiguïtés, vérifie les hypothèses, compare les options utiles et fournis une réponse structurée et actionnable." }
};
// Buffer partial tags so internal analysis cannot briefly flash on screen when a tag
// crosses token boundaries. Ordinary repeated tokens are valid and are never deduplicated.
class VisibleTextFilter {
  private pending = "";
  private hidden: string | null = null;
  append(text: string): string {
    this.pending += text; let output = "";
    while (this.pending) {
      if (this.hidden) {
        const end = `</${this.hidden}>`; const index = this.pending.toLowerCase().indexOf(end);
        if (index < 0) { this.pending = this.pending.slice(-(end.length - 1)); break; }
        this.pending = this.pending.slice(index + end.length); this.hidden = null; continue;
      }
      const index = this.pending.indexOf("<");
      if (index < 0) { output += this.pending; this.pending = ""; break; }
      output += this.pending.slice(0, index); this.pending = this.pending.slice(index);
      const lower = this.pending.toLowerCase();
      const tag = ["think", "analysis"].find(value => lower.startsWith(`<${value}>`));
      if (tag) { this.hidden = tag; this.pending = this.pending.slice(tag.length + 2); continue; }
      if (["<think>", "<analysis>"].some(value => value.startsWith(lower))) break;
      output += "<"; this.pending = this.pending.slice(1);
    }
    return output;
  }
}
const completionUrl = (provider: Provider) => {
  const base = provider.baseUrl.replace(/\/$/, "");
  if (provider.protocol === "ollama") return ollamaUrl(base, "/api/chat");
  const dev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
  try { if (dev && typeof window !== "undefined" && !(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ && new URL(base).hostname === "api.gonkarouter.io") return `/solar-router${new URL(base).pathname}/chat/completions`; } catch { /* Validation is handled by settings. */ }
  return `${base}/chat/completions`;
};
export async function streamChat(input: { provider: Provider; model: string; messages: Message[]; effort: Effort; vault: SecretVault; signal: AbortSignal; onDelta: (text: string) => void; systemInstruction?: string }) {
  const local = input.provider.protocol === "ollama";
  const key = local ? null : await input.vault.get(input.provider.secretRef);
  if (!local && !key?.trim()) throw new ChatError("Aucune clé API n’est enregistrée pour ce fournisseur.", "unauthorized");
  const effort = effortConfig[input.effort];
  const messages = [{ role: "system", content: `${input.systemInstruction ?? ""} ${effort.instruction} Utilise du Markdown standard si utile : tableaux valides, code avec langage, listes simples. Évite les tableaux ASCII. Ne montre pas ton raisonnement interne. N’invente pas de recherche Internet ni d’accès à des données en temps réel.` }, ...input.messages.filter(message => message.role !== "assistant" || message.status === "completed").map(message => messagePayload(message, local))];
  const body = { model: input.model, stream: true, messages, ...(local ? { options: { num_predict: effort.maxTokens } } : { max_tokens: effort.maxTokens }) };
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: local ? "application/x-ndjson" : "text/event-stream" };
  if (key) { headers.Authorization = `Bearer ${key.trim()}`; headers["x-api-key"] = key.trim(); }
  let response: Response;
  try { response = await providerFetch(completionUrl(input.provider), { method: "POST", signal: input.signal, headers, body: JSON.stringify(body) }); }
  catch { if (input.signal.aborted) throw new ChatError("La génération a été interrompue.", "interrupted"); throw new ChatError(`Impossible de joindre ${input.provider.name}. Vérifie ta connexion et l’URL du fournisseur.`, "network"); }
  if (response.status === 401 || response.status === 403) throw new ChatError("La clé API a été refusée par le fournisseur.", "unauthorized");
  if (response.status === 404) throw new ChatError("Le modèle ou l’URL de l’API est introuvable.", "model");
  if ([400, 415, 422].includes(response.status) && input.messages.some(message => message.attachments?.some(item => item.kind === "image"))) throw new ChatError("Le fournisseur n’a pas accepté cette demande avec image. Choisis un modèle compatible vision ou vérifie son format d’API.", "model");
  if (!response.ok || !response.body) throw new ChatError(`Le fournisseur a répondu ${response.status}.`, "provider");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); const filter = new VisibleTextFilter();
  let buffer = ""; let dataLines: string[] = []; let completed = false; let visibleLength = 0; let snapshot = "";
  const emit = (text: string) => { const visible = filter.append(text); if (visible) { visibleLength += visible.length; input.onDelta(visible); } };
  const parse = (data: string) => {
    if (data === "[DONE]") { completed = true; return; }
    let payload: { error?: unknown; done?: boolean; message?: { content?: string }; choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }> };
    try { payload = JSON.parse(data); } catch { throw new ChatError("Le flux de réponse du fournisseur est invalide.", "invalid-response"); }
    if (payload.error) throw new ChatError("Le fournisseur a signalé une erreur pendant la génération. Vérifie le modèle sélectionné puis réessaie.", "provider");
    if (local) { if (typeof payload.message?.content === "string") emit(payload.message.content); if (payload.done) completed = true; }
    else {
      const choice = payload.choices?.[0];
      if (typeof choice?.delta?.content === "string") emit(choice.delta.content);
      else if (typeof choice?.message?.content === "string") {
        // Explicit full-message snapshots are different from deltas. Accept only
        // monotonic snapshots to avoid replaying an entire answer.
        const content = choice.message.content;
        if (!content.startsWith(snapshot)) throw new ChatError("Le fournisseur a envoyé une réponse incohérente.", "invalid-response");
        emit(content.slice(snapshot.length)); snapshot = content;
      }
    }
  };
  const line = (value: string) => {
    if (completed) return;
    if (local) { if (value.trim()) parse(value); return; }
    if (!value) { if (dataLines.length) { parse(dataLines.join("\n")); dataLines = []; } }
    else if (value.startsWith("data:")) dataLines.push(value.slice(5).replace(/^ /, ""));
  };
  try {
    while (!completed) {
      const { value, done } = await reader.read(); buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const raw of lines) line(raw.replace(/\r$/, ""));
      if (done) { if (buffer) line(buffer.replace(/\r$/, "")); if (dataLines.length) parse(dataLines.join("\n")); break; }
    }
    if (input.signal.aborted) throw new ChatError("La génération a été interrompue.", "interrupted");
    if (!completed) throw new ChatError("Le flux s’est arrêté avant la fin de la réponse. Tu peux réessayer.", "network");
    if (!visibleLength) throw new ChatError("Le fournisseur n’a renvoyé aucune réponse visible. Essaie un autre modèle ou un effort différent.", "invalid-response");
  } catch (error) {
    if (input.signal.aborted) throw new ChatError("La génération a été interrompue.", "interrupted");
    if (error instanceof ChatError) throw error;
    throw new ChatError("Le flux de réponse a été interrompu.", "network");
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
