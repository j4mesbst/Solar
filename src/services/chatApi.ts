import type { Metrics,PerformanceProfile } from "../domain/extensions";
import { runtimeProfile } from "./performance.ts";
import { messagePayload } from "./messagePayload.ts";
import { providerFetch, ollamaUrl } from "./transport.ts";
import { isNativeSolar, streamNativeOllamaChat } from "./ollamaNative.ts";
import type { Effort, Message, Provider } from "../domain/types";
import type { SecretVault } from "./contracts";
import { abortable } from "../lib/cortex/reliability.ts";

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
  private onThinking?: () => void;
  constructor(onThinking?: () => void) { this.onThinking = onThinking; }
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
      if (tag) { this.onThinking?.(); this.hidden = tag; this.pending = this.pending.slice(tag.length + 2); continue; }
      if (["<think>", "<analysis>"].some(value => value.startsWith(lower))) break;
      output += "<"; this.pending = this.pending.slice(1);
    }
    return output;
  }
}
const completionUrl = (provider: Provider) => {
  const base = provider.baseUrl.replace(/\/$/, "");
  if (provider.protocol === "ollama") return ollamaUrl(base, "/api/chat");
  if(provider.protocol === "anthropic") return Boolean((import.meta as ImportMeta & {env?:{DEV?:boolean}}).env?.DEV) && typeof window!=="undefined" && !(window as Window & {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__ && new URL(base).hostname==="api.anthropic.com" ? "/solar-anthropic/v1/messages" : `${base}/messages`;
  const dev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
  try { if (dev && typeof window !== "undefined" && !(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ && new URL(base).hostname === "api.gonkarouter.io") return `/solar-router${new URL(base).pathname}/chat/completions`; } catch { /* Validation is handled by settings. */ }
  return `${base}/chat/completions`;
};
export async function streamChat(input: { provider: Provider; model: string; messages: Message[]; effort: Effort; vault: SecretVault; signal: AbortSignal; onDelta: (text: string) => void; onProgress?: () => void; performanceProfile?:PerformanceProfile; onMetrics?:(metrics:Metrics)=>void; systemInstruction?: string; exactSystem?:boolean; maxOutputTokens?: number; format?: unknown; tools?: unknown[]; localOptions?: { temperature?: number; numCtx?: number; keepAlive?: string }; onActivity?: (stage: Message["activity"]) => void }) {
  let stage: Message["activity"]; const activity = (value: Message["activity"]) => { if (stage !== value) { stage = value; input.onActivity?.(value); } }; activity("connecting");
  const local = input.provider.protocol === "ollama";
  const key = local ? null : await input.vault.get(input.provider.secretRef);
  if (!local && !key?.trim()) throw new ChatError("Aucune clé API n’est enregistrée pour ce fournisseur.", "unauthorized");
  const effort = effortConfig[input.effort];
  const messages = [{ role: "system", content: input.exactSystem?input.systemInstruction??"":`${input.systemInstruction ?? ""} ${effort.instruction} Utilise du Markdown standard si utile : tableaux valides, code avec langage, listes simples. Évite les tableaux ASCII. Ne montre pas ton raisonnement interne. N’invente pas de recherche Internet ni d’accès à des données en temps réel.` }, ...input.messages.filter(message => message.role !== "assistant" || message.status === "completed").map(message => messagePayload(message, local))];
  const budget = input.maxOutputTokens ?? effort.maxTokens;
  const profile=runtimeProfile(input.performanceProfile);
  const anthropic=input.provider.protocol==="anthropic";
  const anthropicMessages=messages.slice(1).map(m=>({role:m.role,content:typeof m.content==="string"?m.content:m.content.map((part:any)=>{if(part.type==="image_url"){const match=String(part.image_url.url).match(/^data:([^;]+);base64,(.+)$/);if(!match)throw new ChatError("Image invalide", "model");return {type:"image",source:{type:"base64",media_type:match[1],data:match[2]}};}return part;})}));
  // Ollama thinking models can spend the entire output budget in the separate
  // `thinking` field, leaving Solar with an apparently empty answer. Solar's
  // local effort pipeline already handles staged reasoning, so ask Ollama for
  // the user-facing answer directly on each stage.
  const body = { model: input.model, stream: true, messages:anthropic?anthropicMessages:messages, ...(anthropic?{system:messages[0].content}:{}),...(local ? {think:false,keep_alive:input.localOptions?.keepAlive??profile.keep_alive, options: { ...profile.options,num_predict: budget, ...(input.localOptions?.temperature !== undefined ? { temperature: input.localOptions.temperature,top_p:.95,top_k:20 } : {}), ...(input.localOptions?.numCtx !== undefined ? { num_ctx: input.localOptions.numCtx } : {}) }, ...(input.format?{format:input.format}:{}),...(input.tools?{tools:input.tools}:{}) } : { max_tokens: budget }) };
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: local ? "application/x-ndjson" : "text/event-stream" };
  if(anthropic)headers["anthropic-version"]="2023-06-01";
  if (key) { headers.Authorization = `Bearer ${key.trim()}`; headers["x-api-key"] = key.trim(); }
  let response: Response;
  try { response = local && isNativeSolar()
    ? await streamNativeOllamaChat(input.provider.baseUrl, body, input.signal)
    : await providerFetch(completionUrl(input.provider), { method: "POST", signal: input.signal, headers, body: JSON.stringify(body) }); }
  catch (error) { if (input.signal.aborted) throw new ChatError("La génération a été interrompue.", "interrupted"); const detail = error instanceof Error && error.message ? ` Détail : ${error.message}` : ""; throw new ChatError(`Impossible de joindre ${input.provider.name}. Vérifie que le service répond à ${input.provider.baseUrl}.${detail}`, "network"); }
  if (response.status === 401 || response.status === 403) throw new ChatError("La clé API a été refusée par le fournisseur.", "unauthorized");
  if (response.status === 404) throw new ChatError("Le modèle ou l’URL de l’API est introuvable.", "model");
  const providerErrorDetail = async () => {
    const header = response.headers.get("x-ollama-error");
    if (header?.trim()) return header.trim().slice(0, 1200);
    try {
      const body = await response.clone().text();
      if (!body.trim()) return "";
      const parsed = JSON.parse(body) as { error?: unknown };
      return (typeof parsed.error === "string" ? parsed.error : body).trim().slice(0, 1200);
    } catch { return ""; }
  };
  if ([400, 415, 422].includes(response.status) && input.messages.some(message => message.attachments?.some(item => item.kind === "image"))) {
    const detail = await providerErrorDetail();
    throw new ChatError(`Le fournisseur n’a pas accepté cette demande avec image.${detail ? ` Détail : ${detail}` : ""}`, "model");
  }
  if (!response.ok || !response.body) {
    const detail = await providerErrorDetail();
    throw new ChatError(detail ? `${local ? "Ollama" : input.provider.name} (HTTP ${response.status}) : ${detail}` : `Le fournisseur a répondu ${response.status}.`, local ? "model" : "provider");
  }
  activity("waiting");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); const filter = new VisibleTextFilter(() => activity("thinking"));
  const cancelReader = () => { void reader.cancel(input.signal.reason).catch(() => {}); };
  input.signal.addEventListener("abort", cancelReader, { once: true });
  if (input.signal.aborted) cancelReader();
  let buffer = ""; let dataLines: string[] = []; let completed = false; let visibleLength = 0; let snapshot = "";
  let stopReason: "stop" | "length" | "tool_calls" = "stop"; let generatedTokens: number | undefined;
  const toolCalls: { name: string; arguments: unknown }[] = [];
  const emit = (text: string) => { const visible = filter.append(text); if (visible) { activity("writing"); visibleLength += visible.length; input.onDelta(visible); } };
  const parse = (data: string) => {
    if (data === "[DONE]") { completed = true; return; }
    let payload: { type?:string; delta?:{type?:string;text?:string;thinking?:string}; total_duration?:number;load_duration?:number;prompt_eval_count?:number;prompt_eval_cached_count?:number;prompt_eval_duration?:number;eval_count?:number;eval_duration?:number; error?: unknown; done?: boolean; done_reason?: string; message?: { content?: string; thinking?: string; tool_calls?: {function:{name:string;arguments:unknown}}[] }; choices?: Array<{ finish_reason?:string; delta?: { content?: string; reasoning_content?: string; reasoning?: string }; message?: { content?: string } }> };
    try { payload = JSON.parse(data); } catch { throw new ChatError("Le flux de réponse du fournisseur est invalide.", "invalid-response"); }
    if (payload.error) {
      const detail = typeof payload.error === "string" ? payload.error : "";
      throw new ChatError(detail ? `Ollama : ${detail}` : "Le fournisseur a signalé une erreur pendant la génération. Vérifie le modèle sélectionné puis réessaie.", "provider");
    }
    if(anthropic){if(payload.type==="message_stop"){completed=true;return;}if(payload.delta?.type==="thinking_delta")activity("thinking");if(payload.delta?.type==="text_delta"&&typeof payload.delta.text==="string")emit(payload.delta.text);return;}
    if (local) { if(payload.done && payload.total_duration!==undefined)input.onMetrics?.({totalMs:payload.total_duration/1e6,loadMs:payload.load_duration===undefined?undefined:payload.load_duration/1e6,promptMs:payload.prompt_eval_duration===undefined?undefined:payload.prompt_eval_duration/1e6,decodeMs:payload.eval_duration===undefined?undefined:payload.eval_duration/1e6,promptTokens:payload.prompt_eval_count,promptCachedTokens:payload.prompt_eval_cached_count,tokens:payload.eval_count,tokensPerSecond:payload.eval_duration&&payload.eval_count!==undefined?payload.eval_count/(payload.eval_duration/1e9):undefined}); if (payload.message?.thinking) activity("thinking"); if (typeof payload.message?.content === "string") emit(payload.message.content); if(payload.message?.tool_calls)for(const call of payload.message.tool_calls)toolCalls.push({name:call.function.name,arguments:call.function.arguments}); if (payload.done) {completed = true;generatedTokens=payload.eval_count;stopReason=payload.done_reason==="length"?"length":toolCalls.length?"tool_calls":"stop";} }
    else {
      const choice = payload.choices?.[0];
      if(choice?.finish_reason==="length")stopReason="length";
      if (choice?.delta?.reasoning_content || choice?.delta?.reasoning) activity("thinking");
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
      const { value, done } = await abortable(reader.read(), input.signal); buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (value?.byteLength) input.onProgress?.();
      const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const raw of lines) line(raw.replace(/\r$/, ""));
      if (done) { if (buffer) line(buffer.replace(/\r$/, "")); if (dataLines.length) parse(dataLines.join("\n")); break; }
    }
    if (input.signal.aborted) throw new ChatError("La génération a été interrompue.", "interrupted");
    if (!completed) throw new ChatError("Le flux s’est arrêté avant la fin de la réponse. Tu peux réessayer.", "network");
    if (!visibleLength && !toolCalls.length) throw new ChatError("Le fournisseur n’a renvoyé aucune réponse visible. Essaie un autre modèle ou un effort différent.", "invalid-response");
    return { stopReason, tokens:generatedTokens, toolCalls };
  } catch (error) {
    if (input.signal.aborted) throw new ChatError("La génération a été interrompue.", "interrupted");
    if (error instanceof ChatError) throw error;
    const detail = error instanceof Error && error.message ? ` Détail : ${error.message}` : "";
    throw new ChatError(`Le flux de réponse a été interrompu.${detail}`, "network");
  } finally { input.signal.removeEventListener("abort", cancelReader); void reader.cancel().catch(() => {}); reader.releaseLock(); }
}
