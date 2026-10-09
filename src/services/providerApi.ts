import type { Model, Provider } from "../domain/types";
import type { SecretVault } from "./contracts";

export class ProviderError extends Error {
  readonly code: "invalid-url" | "unauthorized" | "unavailable" | "invalid-response";
  constructor(message: string, code: "invalid-url" | "unauthorized" | "unavailable" | "invalid-response") { super(message); this.code = code; }
}
export function validateProviderInput(name: string, baseUrl: string, secret: string) {
  if (!name.trim()) return "Donne un nom au fournisseur.";
  try { const url = new URL(baseUrl); if (!["http:", "https:"].includes(url.protocol)) return "L’URL doit commencer par http:// ou https://."; }
  catch { return "L’URL de base n’est pas valide."; }
  if (!secret.trim()) return "La clé API est obligatoire.";
  return null;
}
const endpoint = (provider: Provider) => `${provider.baseUrl.replace(/\/$/, "")}/models`;
async function requestModels(provider: Provider, secret: string): Promise<Model[]> {
  let response: Response;
  try { response = await fetch(endpoint(provider), { headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" } }); }
  catch { throw new ProviderError("Impossible de joindre cet endpoint /models.", "unavailable"); }
  if (response.status === 401 || response.status === 403) throw new ProviderError("La clé API a été refusée par le fournisseur.", "unauthorized");
  if (!response.ok) throw new ProviderError(`L’endpoint /models a répondu ${response.status}.`, "unavailable");
  let payload: unknown; try { payload = await response.json(); } catch { throw new ProviderError("La réponse /models n’est pas un JSON valide.", "invalid-response"); }
  const rows = Array.isArray(payload) ? payload : (payload as { data?: unknown })?.data;
  if (!Array.isArray(rows)) throw new ProviderError("La réponse /models ne contient pas de liste de modèles.", "invalid-response");
  return rows.flatMap((item) => { const id = typeof item === "string" ? item : (item as { id?: unknown })?.id; return typeof id === "string" && id.trim() ? [{ id: `${provider.id}:${id}`, providerId: provider.id, providerModelId: id, name: id, capabilities: [], source: "remote" as const, enabled: true }] : []; });
}
export const providerApi = {
  async test(provider: Provider, vault: SecretVault) { const secret = await vault.get(provider.secretRef); if (!secret) throw new ProviderError("Aucune clé API enregistrée pour ce fournisseur.", "unauthorized"); await requestModels(provider, secret); },
  async discoverModels(provider: Provider, vault: SecretVault) { const secret = await vault.get(provider.secretRef); if (!secret) throw new ProviderError("Aucune clé API enregistrée pour ce fournisseur.", "unauthorized"); return requestModels(provider, secret); }
};
