import {isSolarCloudProvider,SOLAR_CLOUD_BUSY_MESSAGE,solarCloudBusyStatus} from "./solarCloud.ts";
import { modelWithProviderLimits } from "./providerCapabilities.ts";
import { providerFetch, ollamaUrl } from "./transport.ts";
import type { Model, Provider } from "../domain/types";
import type { SecretVault } from "./contracts";

export class ProviderError extends Error {
  readonly code: "invalid-url" | "unauthorized" | "unavailable" | "invalid-response";
  constructor(message: string, code: "invalid-url" | "unauthorized" | "unavailable" | "invalid-response") { super(message); this.code = code; }
}
export function validateProviderInput(name: string, baseUrl: string, secret: string, protocol: Provider["protocol"] = "openai-compatible") {
  if (!name.trim()) return "Donne un nom au fournisseur.";
  try { const url = new URL(baseUrl); if (!["http:", "https:"].includes(url.protocol)) return "L’URL doit commencer par http:// ou https://."; }
  catch { return "L’URL de base n’est pas valide."; }
  if (protocol !== "ollama" && !secret.trim()) return "La clé API est obligatoire.";
  return null;
}
const isGonkaRouter = (provider: Provider) => {
  try { return new URL(provider.baseUrl).hostname === "api.gonkarouter.io"; }
  catch { return false; }
};
const endpoint = (provider: Provider) => {
  const baseUrl = provider.baseUrl.replace(/\/$/, "");
  if (provider.protocol === "ollama") return ollamaUrl(baseUrl, "/api/tags");
  if(provider.protocol==="anthropic" && Boolean((import.meta as ImportMeta & {env?:{DEV?:boolean}}).env?.DEV) && typeof window!=="undefined" && !(window as Window & {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__ && new URL(baseUrl).hostname==="api.anthropic.com")return "/solar-anthropic/v1/models";
  const isDev = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
  if (isDev && typeof window !== "undefined" && !(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ && isGonkaRouter(provider)) return `/solar-router${new URL(baseUrl).pathname}/models`;
  return `${baseUrl}/models`;
};
async function requestModels(provider: Provider, secret: string, signal?: AbortSignal): Promise<Model[]> {
  let response: Response;
  const apiKey = secret.trim();
  try { response = await providerFetch(endpoint(provider), { headers: { ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey } : {}), Accept: "application/json",...(provider.protocol==="anthropic"?{"anthropic-version":"2023-06-01"}:{}) }, signal: signal ?? AbortSignal.timeout(15000) }); }
  catch (error) { if(signal?.aborted)throw error;if(isSolarCloudProvider(provider))throw new ProviderError(SOLAR_CLOUD_BUSY_MESSAGE,"unavailable");const detail = error instanceof Error && error.message ? ` Détail : ${error.message}` : ""; throw new ProviderError(`Connexion au fournisseur impossible. Vérifie l’URL et l’état du service.${detail}`, "unavailable"); }
  if(isSolarCloudProvider(provider)&&solarCloudBusyStatus(response.status))throw new ProviderError(SOLAR_CLOUD_BUSY_MESSAGE,"unavailable");
  if (response.status === 401 || response.status === 403) throw new ProviderError("La clé API a été refusée par le fournisseur.", "unauthorized");
  if (!response.ok) throw new ProviderError(`L’endpoint /models a répondu ${response.status}.`, "unavailable");
  let payload: unknown; try { payload = await response.json(); } catch { throw new ProviderError("La réponse /models n’est pas un JSON valide.", "invalid-response"); }
  const rows = Array.isArray(payload) ? payload : (provider.protocol === "ollama" ? (payload as { models?: unknown })?.models : (payload as { data?: unknown })?.data);
  if (!Array.isArray(rows)) throw new ProviderError("La réponse /models ne contient pas de liste de modèles.", "invalid-response");
  return rows.flatMap((item) => {
    const data=typeof item==='object'&&item!==null?item as Record<string,unknown>:{};
    const id=typeof item==='string'?item:provider.protocol==='ollama'?data.name:data.id;
    if(typeof id!=='string'||!id.trim())return [];
    const exposed=Array.isArray(data.capabilities)?data.capabilities.filter((value):value is string=>typeof value==='string'):[];
    const context=Number(data.context_window??data.context_length??data.max_context_length??data.max_context_tokens??data.max_model_len??data.max_input_tokens??(data.top_provider as {context_length?:number}|undefined)?.context_length);
    const maxOutput=Number(data.max_output_tokens??(data.top_provider as {max_completion_tokens?:number}|undefined)?.max_completion_tokens);
    return [modelWithProviderLimits({id:`${provider.id}:${id}`,providerId:provider.id,providerModelId:id,name:id,capabilities:exposed,...(Number.isInteger(maxOutput)&&Number(maxOutput)>0?{maxOutputTokens:Number(maxOutput)}:{}),...(Number.isInteger(context)&&Number(context)>=1024?{contextWindow:Number(context),contextSource:"provider" as const}:{}),...(provider.protocol==='ollama'&&typeof data.size==='number'?{sizeBytes:data.size}:{}),source:'remote' as const,enabled:true},provider)];
  });
}
export const providerApi = {
  async test(provider: Provider, vault: SecretVault) { const secret = provider.protocol === "ollama" ? null : await vault.get(provider.secretRef); if (!secret && provider.protocol !== "ollama") throw new ProviderError("Aucune clé API enregistrée pour ce fournisseur.", "unauthorized"); await requestModels(provider, secret ?? ""); },
  async discoverModels(provider: Provider, vault: SecretVault, signal?: AbortSignal) { const secret = provider.protocol === "ollama" ? null : await vault.get(provider.secretRef); if (!secret && provider.protocol !== "ollama") throw new ProviderError("Aucune clé API enregistrée pour ce fournisseur.", "unauthorized"); return requestModels(provider, secret ?? "", signal); }
};
