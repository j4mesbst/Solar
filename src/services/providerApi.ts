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
  catch { throw new ProviderError("Connexion au fournisseur impossible. Vérifie l’URL, ta connexion, puis redémarre Solar après une mise à jour.", "unavailable"); }
  if (response.status === 401 || response.status === 403) throw new ProviderError("La clé API a été refusée par le fournisseur.", "unauthorized");
  if (!response.ok) throw new ProviderError(`L’endpoint /models a répondu ${response.status}.`, "unavailable");
  let payload: unknown; try { payload = await response.json(); } catch { throw new ProviderError("La réponse /models n’est pas un JSON valide.", "invalid-response"); }
  const rows = Array.isArray(payload) ? payload : (provider.protocol === "ollama" ? (payload as { models?: unknown })?.models : (payload as { data?: unknown })?.data);
  if (!Array.isArray(rows)) throw new ProviderError("La réponse /models ne contient pas de liste de modèles.", "invalid-response");
  return rows.flatMap((item) => { const id = typeof item === "string" ? item : (provider.protocol === "ollama" ? (item as { name?: unknown })?.name : (item as { id?: unknown })?.id); return typeof id === "string" && id.trim() ? [{ id: `${provider.id}:${id}`, providerId: provider.id, providerModelId: id, name: id, capabilities: [], ...(provider.protocol === "ollama" && typeof (item as any)?.size === "number" ? {sizeBytes:(item as any).size}:{}),source: "remote" as const, enabled: true }] : []; });
}
export const providerApi = {
  async test(provider: Provider, vault: SecretVault) { const secret = provider.protocol === "ollama" ? null : await vault.get(provider.secretRef); if (!secret && provider.protocol !== "ollama") throw new ProviderError("Aucune clé API enregistrée pour ce fournisseur.", "unauthorized"); await requestModels(provider, secret ?? ""); },
  async discoverModels(provider: Provider, vault: SecretVault, signal?: AbortSignal) { const secret = provider.protocol === "ollama" ? null : await vault.get(provider.secretRef); if (!secret && provider.protocol !== "ollama") throw new ProviderError("Aucune clé API enregistrée pour ce fournisseur.", "unauthorized"); return requestModels(provider, secret ?? "", signal); }
};
