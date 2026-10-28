import { localRequestContext } from "./localRequestContext.ts";
import {isSolarCloudProvider,SOLAR_CLOUD_BUSY_MESSAGE,solarCloudBusyStatus,solarCloudStreamError} from "./solarCloud.ts";
import type { Metrics,PerformanceProfile } from "../domain/extensions";
import { responseReserve } from "./contextBudget.ts";
import { runtimeProfile } from "./performance.ts";
import { messagePayload } from "./messagePayload.ts";
import { providerFetch, ollamaUrl } from "./transport.ts";
import { isNativeSolar, streamNativeOllamaChat } from "./ollamaNative.ts";
import type { Effort, Message, Provider } from "../domain/types";
import type { SecretVault } from "./contracts";
import { abortable } from "../lib/cortex/reliability.ts";
import { beginUsage } from "./usage.ts";

export interface ToolChatObservation { tool:string; arguments:Record<string,unknown>; result:string }
export class ChatError extends Error {
  readonly code: "provider" | "model" | "unauthorized" | "network" | "invalid-response" | "interrupted" | "refused";
  constructor(message: string, code: ChatError["code"]) { super(message); this.code = code; }
}
const effortConfig: Record<Effort, { maxTokens: number; instruction: string }> = {
  low: { maxTokens: responseReserve("low"), instruction: "Réponds directement et de manière concise." },
  medium: { maxTokens: responseReserve("medium"), instruction: "Donne une réponse complète, claire et proportionnée à la question." },
  high: { maxTokens: responseReserve("high"), instruction: "Analyse la demande avec soin et donne une réponse approfondie et structurée." },
  xhigh: { maxTokens: responseReserve("xhigh"), instruction: "Vérifie soigneusement les contraintes et les cas limites avant de répondre. Adapte la longueur à la demande." },
  ultra: { maxTokens: responseReserve("ultra"), instruction: "Traite la demande de manière exhaustive : identifie les ambiguïtés, vérifie les hypothèses, compare les options utiles et fournis une réponse structurée et actionnable." }
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
export async function streamChat(input: Parameters<typeof streamChatRequest>[0]) {
  // Test/CLI transports without a browser do not have an account usage ledger.
  const promptEstimate = Math.ceil((JSON.stringify(input.messages.map(m => ({ role: m.role, content: m.content }))).length + (input.systemInstruction?.length ?? 0) + 500) / 3) + input.messages.reduce((sum, m) => sum + (m.attachments?.filter(a => a.kind === "image").length ?? 0) * 2048, 0);
  const reservation = typeof localStorage !== "undefined" && typeof window !== "undefined" ? await beginUsage(input.provider.protocol === "ollama", promptEstimate + (input.maxOutputTokens ?? effortConfig[input.effort].maxTokens),isSolarCloudProvider(input.provider)) : undefined;
  let received = false, characters = 0; let measured: number | undefined;
  try {
    const allowance = reservation ? Math.floor(reservation.reserved - promptEstimate) : Infinity;
    if (allowance < 1) throw new Error("Le quota cloud restant ne suffit pas à cette demande. Utilise un modèle local ou consulte Utilisation.");
    const result = await streamChatRequest({ ...input, maxOutputTokens: Math.min(input.maxOutputTokens ?? effortConfig[input.effort].maxTokens, allowance), onMetrics: metrics => { if (metrics.tokens !== undefined && metrics.promptTokens !== undefined) measured = metrics.tokens + metrics.promptTokens; input.onMetrics?.(metrics); }, onDelta: text => { if (text) received = true; characters += text.length; input.onDelta(text); } });
    await reservation?.settle(measured ?? promptEstimate + Math.ceil(characters / 3), measured === undefined); return result;
  } catch (error) { await reservation?.settle(received || (measured ?? 0) > 0 ? measured ?? promptEstimate + Math.ceil(characters / 3) : null, measured === undefined);
    if(isSolarCloudProvider(input.provider)&&!input.signal.aborted&&error instanceof ChatError&&error.code==='network')throw new ChatError(SOLAR_CLOUD_BUSY_MESSAGE,'network');throw error; }
}
async function streamChatRequest(input: { provider: Provider; model: string; messages: Message[]; effort: Effort; vault: SecretVault; signal: AbortSignal; onDelta: (text: string) => void; onProgress?: () => void; performanceProfile?:PerformanceProfile; onMetrics?:(metrics:Metrics)=>void; systemInstruction?: string; exactSystem?:boolean; maxOutputTokens?: number; format?: unknown; tools?: unknown[]; toolContext?:ToolChatObservation[]; toolChoice?:"auto"|"required"|"none"; reasoningEffort?:"low"|"medium"|"high"; jsonOutput?:boolean; localOptions?: { temperature?: number; numCtx?: number; keepAlive?: string; think?:boolean }; onActivity?: (stage: Message["activity"]) => void }) {
  const streamStarted = Date.now();
  let stage: Message["activity"]; const activity = (value: Message["activity"]) => { if (stage !== value) { stage = value; input.onActivity?.(value); } }; activity("connecting");
  const local = input.provider.protocol === "ollama";
  const key = local ? null : await input.vault.get(input.provider.secretRef);
  if (!local && !key?.trim()) throw new ChatError("Aucune clé API n’est enregistrée pour ce fournisseur.", "unauthorized");
  const effort = effortConfig[input.effort];
  const messages:any[] = [{ role: "system", content: input.exactSystem?input.systemInstruction??"":`${input.systemInstruction ?? ""} ${effort.instruction} Utilise du Markdown standard si utile : tableaux valides, code avec langage, listes simples. Évite les tableaux ASCII. Ne montre pas ton raisonnement interne. N’invente pas de recherche Internet ni d’accès à des données en temps réel.` }, ...input.messages.filter(message => message.role !== "assistant" || message.status === "completed").map(message => messagePayload(message, local))];
  for(const [index,call] of (input.toolContext??[]).entries()){
    const id=`solar_call_${index}`;
    messages.push({role:"assistant",content:"",tool_calls:[{id,type:"function",function:{name:call.tool,arguments:local?call.arguments:JSON.stringify(call.arguments)}}]});
    messages.push(local?{role:"tool",tool_name:call.tool,content:call.result}:{role:"tool",tool_call_id:id,content:call.result});
  }
  const budget = input.maxOutputTokens ?? effort.maxTokens;
  const profile=runtimeProfile(input.performanceProfile);
  const anthropic=input.provider.protocol==="anthropic";
  const anthropicMessages=messages.slice(1).map(m=>{
    if(m.role==="tool")return {role:"user",content:[{type:"tool_result",tool_use_id:m.tool_call_id,content:m.content}]};
    if(m.tool_calls)return {role:"assistant",content:m.tool_calls.map((c:any)=>({type:"tool_use",id:c.id,name:c.function.name,input:typeof c.function.arguments==="string"?JSON.parse(c.function.arguments):c.function.arguments}))};
    return {role:m.role,content:typeof m.content==="string"?m.content:m.content.map((part:any)=>{if(part.type==="image_url"){const match=String(part.image_url.url).match(/^data:([^;]+);base64,(.+)$/);if(!match)throw new ChatError("Image invalide","model");return {type:"image",source:{type:"base64",media_type:match[1],data:match[2]}};}return part;})};
  });
  // Ollama thinking models can spend the entire output budget in the separate
  // `thinking` field, leaving Solar with an apparently empty answer. Solar's
  // local effort pipeline already handles staged reasoning, so ask Ollama for
  // the user-facing answer directly on each stage.
  const body = { model: input.model, stream: true, messages:anthropic?anthropicMessages:messages, ...(anthropic?{system:messages[0].content}:{}),...(local ? {think:input.localOptions?.think??false,keep_alive:input.localOptions?.keepAlive??profile.keep_alive, options: { ...profile.options,num_predict: budget, ...(input.localOptions?.temperature !== undefined ? { temperature: input.localOptions.temperature,top_p:.95,top_k:20 } : {}), num_ctx:localRequestContext(input.localOptions?.numCtx??profile.options.num_ctx,messages,input.tools,budget) }, ...(input.format?{format:input.format}:{}),...(input.tools?{tools:input.tools}:{}) } : { max_tokens: budget }) };
  if (!local && !anthropic) Object.assign(body, { stream_options: { include_usage: true }, ...(input.tools ? { tools: input.tools,...(input.toolChoice?{tool_choice:input.toolChoice}:{}),parallel_tool_calls:false } : {}),...(input.jsonOutput?{response_format:{type:"json_object"}}:{}),...(input.reasoningEffort?{reasoning_effort:input.reasoningEffort}:{}) });
  if (anthropic && input.tools) Object.assign(body, { tools: input.tools.map((item:any) => ({ name: item.function.name, description: item.function.description, input_schema: item.function.parameters })) });
  if (anthropic && input.tools && input.toolChoice) Object.assign(body,{tool_choice:{type:input.toolChoice==="required"?"any":input.toolChoice}});
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: local ? "application/x-ndjson" : "text/event-stream" };
  if(anthropic)headers["anthropic-version"]="2023-06-01";
  if (key) { headers.Authorization = `Bearer ${key.trim()}`; headers["x-api-key"] = key.trim(); }
  let response: Response;
  try { response = local && isNativeSolar()
    ? await streamNativeOllamaChat(input.provider.baseUrl, body, input.signal)
    : await providerFetch(completionUrl(input.provider), { method: "POST", signal: input.signal, headers, body: JSON.stringify(body) }); }
  catch (error) { if (input.signal.aborted) throw new ChatError("La génération a été interrompue.", "interrupted"); if(isSolarCloudProvider(input.provider))throw new ChatError(SOLAR_CLOUD_BUSY_MESSAGE,"network"); const detail = error instanceof Error && error.message ? ` Détail : ${error.message}` : ""; throw new ChatError(`Impossible de joindre ${input.provider.name}. Vérifie que le service répond à ${input.provider.baseUrl}.${detail}`, "network"); }
  if(isSolarCloudProvider(input.provider)&&solarCloudBusyStatus(response.status))throw new ChatError(SOLAR_CLOUD_BUSY_MESSAGE,"provider");
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
    throw new ChatError(isSolarCloudProvider(input.provider)?"Solar Cloud n’a pas accepté cette image. Essaie un format ou un modèle compatible.":`Le fournisseur n’a pas accepté cette demande avec image.${detail ? ` Détail : ${detail}` : ""}`, "model");
  }
  if (!response.ok || !response.body) {
    const detail = await providerErrorDetail();
    if(isSolarCloudProvider(input.provider)){
      if([400,415,422].includes(response.status))throw new ChatError(/tool|function|format|schema/i.test(detail)?`Solar Cloud (HTTP ${response.status}) : format ou schéma d’outils non accepté.`:'Solar Cloud n’a pas accepté cette demande. Vérifie le modèle et la taille du contexte.',"model");
      throw new ChatError(SOLAR_CLOUD_BUSY_MESSAGE,"provider");
    }
    throw new ChatError(detail ? `${local ? "Ollama" : input.provider.name} (HTTP ${response.status}) : ${detail}` : `Le fournisseur a répondu ${response.status}.`, local ? "model" : "provider");
  }
  activity("waiting");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); const filter = new VisibleTextFilter(() => activity("thinking"));
  const cancelReader = () => { void reader.cancel(input.signal.reason).catch(() => {}); };
  input.signal.addEventListener("abort", cancelReader, { once: true });
  if (input.signal.aborted) cancelReader();
  let rawContentLength=0;let buffer = ""; let dataLines: string[] = []; let completed = false; let visibleLength = 0; let snapshot = "";
  let stopReason: "stop" | "length" | "tool_calls" = "stop"; let generatedTokens: number | undefined;
  const toolCalls: { name: string; arguments: unknown }[] = [];
  const cloudCalls=new Map<number,{name:string;arguments:string;initial?:unknown}>();
  let cloudPromptTokens: number | undefined, cloudOutputTokens: number | undefined;
  const emit = (text: string) => { rawContentLength+=text.length;const visible = filter.append(text); if (visible) { activity("writing"); visibleLength += visible.length; input.onDelta(visible); } };
  const parse = (data: string) => {
    if (data === "[DONE]") { completed = true; return; }
    let payload: { type?:string; delta?:{type?:string;text?:string;thinking?:string}; total_duration?:number;load_duration?:number;prompt_eval_count?:number;prompt_eval_cached_count?:number;prompt_eval_duration?:number;eval_count?:number;eval_duration?:number; error?: unknown; done?: boolean; done_reason?: string; message?: { content?: string; thinking?: string; tool_calls?: {function:{name:string;arguments:unknown}}[] }; choices?: Array<{ finish_reason?:string; delta?: { content?: string; reasoning_content?: string; reasoning?: string }; message?: { content?: string } }> };
    try { payload = JSON.parse(data); } catch { throw new ChatError(isSolarCloudProvider(input.provider)?SOLAR_CLOUD_BUSY_MESSAGE:"Le flux de réponse du fournisseur est invalide.", isSolarCloudProvider(input.provider)?"provider":"invalid-response"); }
    if (payload.error) {
      if(isSolarCloudProvider(input.provider)){
        const code=solarCloudStreamError(payload.error);
        throw new ChatError(code==='busy'?SOLAR_CLOUD_BUSY_MESSAGE:code==='unauthorized'?'La connexion Solar Cloud a été refusée. Vérifie ta clé dans les paramètres.':'Solar Cloud n’a pas accepté cette demande. Vérifie le modèle et la taille du contexte.',code==='busy'?'provider':code);
      }
      const detail = typeof payload.error === "string" ? payload.error : "";
      throw new ChatError(detail ? `Ollama : ${detail}` : "Le fournisseur a signalé une erreur pendant la génération. Vérifie le modèle sélectionné puis réessaie.", "provider");
    }
    type TokenUsage = { prompt_tokens?:number; completion_tokens?:number; input_tokens?:number; output_tokens?:number; cache_creation_input_tokens?:number; cache_read_input_tokens?:number };
    const metered = payload as typeof payload & { usage?:TokenUsage; message?:{usage?:TokenUsage} };
    const usage = metered.usage ?? metered.message?.usage;
    if (!local && usage) {
      const prompt = usage.prompt_tokens ?? usage.input_tokens;
      if (prompt !== undefined && Number.isFinite(prompt) && prompt >= 0) cloudPromptTokens = prompt + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
      const output = usage.completion_tokens ?? usage.output_tokens;
      if (output !== undefined && Number.isFinite(output) && output >= 0) cloudOutputTokens = output;
      generatedTokens = cloudOutputTokens;
      input.onMetrics?.({ totalMs: Date.now() - streamStarted, promptTokens: cloudPromptTokens, tokens: cloudOutputTokens });
    }
    if(anthropic){
      const block=payload as any;
      if(block.type==="content_block_start"&&block.content_block?.type==="tool_use")cloudCalls.set(block.index,{name:block.content_block.name,arguments:"",initial:block.content_block.input});
      if(block.type==="content_block_delta"&&block.delta?.type==="input_json_delta"){const call=cloudCalls.get(block.index);if(!call)throw new ChatError("Appel d’outil fragmenté invalide.","invalid-response");call.arguments+=block.delta.partial_json??"";}
      if(cloudCalls.size>20||[...cloudCalls.values()].some(call=>call.arguments.length>100000||call.name.length>200))throw new ChatError("Appel d’outil trop volumineux.","invalid-response");
      if(block.type==="message_delta"&&block.delta?.stop_reason==="max_tokens")stopReason="length";
      if(payload.type==="message_stop"){completed=true;return;}if(payload.delta?.type==="thinking_delta")activity("thinking");if(payload.delta?.type==="text_delta"&&typeof payload.delta.text==="string")emit(payload.delta.text);return;
    }
    if (local) { if(payload.done && payload.total_duration!==undefined)input.onMetrics?.({totalMs:payload.total_duration/1e6,loadMs:payload.load_duration===undefined?undefined:payload.load_duration/1e6,promptMs:payload.prompt_eval_duration===undefined?undefined:payload.prompt_eval_duration/1e6,decodeMs:payload.eval_duration===undefined?undefined:payload.eval_duration/1e6,promptTokens:payload.prompt_eval_count,promptCachedTokens:payload.prompt_eval_cached_count,tokens:payload.eval_count,tokensPerSecond:payload.eval_duration&&payload.eval_count!==undefined?payload.eval_count/(payload.eval_duration/1e9):undefined}); if (payload.message?.thinking) activity("thinking"); if (typeof payload.message?.content === "string") emit(payload.message.content); if(payload.message?.tool_calls)for(const call of payload.message.tool_calls)toolCalls.push({name:call.function.name,arguments:call.function.arguments}); if (payload.done) {completed = true;generatedTokens=payload.eval_count;stopReason=payload.done_reason==="length"?"length":toolCalls.length?"tool_calls":"stop";} }
    else {
      const choice = payload.choices?.[0];
      if(choice?.finish_reason==="length")stopReason="length";
      if((choice as any)?.delta?.refusal)throw new ChatError("Le modèle a refusé cette demande. Aucun nouvel outil n’a été exécuté.","refused");
      const delta=(choice as any)?.delta?.tool_calls;
      if(delta)for(const chunk of delta){const index=chunk.index??0;const call=cloudCalls.get(index)??{name:"",arguments:""};if(chunk.function?.name)call.name+=chunk.function.name;if(chunk.function?.arguments)call.arguments+=chunk.function.arguments;cloudCalls.set(index,call);if(cloudCalls.size>20||call.arguments.length>100000||call.name.length>200)throw new ChatError("Appel d’outil trop volumineux.","invalid-response");}
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
    for(const call of cloudCalls.values()){
      try{if(!call.name)throw Error();toolCalls.push({name:call.name,arguments:call.arguments?JSON.parse(call.arguments):call.initial??{}});}catch{throw new ChatError("Le fournisseur a produit des paramètres d’outil incomplets.","invalid-response");}
    }
    if(toolCalls.length&&(stopReason as string)!=="length")stopReason="tool_calls";
    if(!visibleLength&&!toolCalls.length&&(rawContentLength>0||(stopReason as string)==='length'))throw new ChatError("Le modèle n’a pas produit de réponse finale exploitable. Produis une réponse visible à partir des résultats déjà reçus, sans relancer les lectures.","invalid-response");
    if (!visibleLength && !toolCalls.length) throw new ChatError(isSolarCloudProvider(input.provider)?SOLAR_CLOUD_BUSY_MESSAGE:"Le fournisseur n’a renvoyé aucune réponse visible. Essaie un autre modèle ou un effort différent.", isSolarCloudProvider(input.provider)?"provider":"invalid-response");
    return { stopReason, tokens:generatedTokens, toolCalls };
  } catch (error) {
    if (input.signal.aborted) throw new ChatError("La génération a été interrompue.", "interrupted");
    if (error instanceof ChatError) throw error;
    const detail = error instanceof Error && error.message ? ` Détail : ${error.message}` : "";
    throw new ChatError(`Le flux de réponse a été interrompu.${detail}`, "network");
  } finally { input.signal.removeEventListener("abort", cancelReader); void reader.cancel().catch(() => {}); reader.releaseLock(); }
}
