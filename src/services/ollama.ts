import { localRequestContext } from "./localRequestContext.ts";
import type { PerformanceProfile } from "../domain/extensions";
import { runtimeProfile } from "./performance";
import type { Model, Provider } from "../domain/types";
import { solarStore } from "./store";
import { providerApi } from "./providerApi";
import { secretVault } from "./nativeVault";
import { normalizeOllamaBaseUrl, ollamaUrl, providerFetch } from "./transport";
import { inspectOllama, isNativeSolar } from "./ollamaNative";
import { modelContext } from "./contextBudget";
import { readOllamaModelInfo, modelFacts } from "./ollamaModelFacts";
import { currentAccountScope } from "./accountScope";
import { localModelIdentity } from "./localModelIdentity";
let discovery: Promise<void> | null = null;
export async function refreshOllama(): Promise<void> {
  if (discovery) return discovery;
  discovery = (async () => {
    const configured = (await solarStore.listProviders()).filter(p => p.protocol === "ollama");
    for (const provider of configured) {
      // Ollama is local-only in Solar; stale custom hosts/ports make every later
      // chat request fail even when the native detector can reach Ollama.
      const baseUrl = isNativeSolar() ? "http://127.0.0.1:11434" : normalizeOllamaBaseUrl(provider.baseUrl);
      if (baseUrl !== provider.baseUrl) {
        const normalized = { ...provider, baseUrl };
        configured[configured.indexOf(provider)] = normalized;
        await solarStore.saveProvider(normalized);
      }
    }
    const candidates = configured.length ? configured.filter(p => p.enabled) : [{ id: "solar:local-runtime", name: "Modèles Solar", baseUrl: "http://127.0.0.1:11434", protocol: "ollama" as const, secretRef: "provider:solar:local-runtime", enabled: true, connectionState: "unknown" as const }];
    if (isNativeSolar()) {
      const status = await inspectOllama("http://127.0.0.1:11434");
      if (status.supported) {
        if (status.running) {
          for (const provider of candidates) {
            const localProvider = { ...provider, baseUrl: "http://127.0.0.1:11434", connectionState: "connected" as const, lastError: undefined };
            await solarStore.saveProvider(localProvider);
            await reconcileModels(localProvider, status.models.map(name => ({ id: `${provider.id}:${name}`, providerId: provider.id, providerModelId: name, name, capabilities: [], source: "remote" as const, enabled: true })));
          }
        } else {
          for (const provider of configured.filter(item => item.enabled)) {
            await solarStore.saveProvider({ ...provider, connectionState: "error", lastError: status.error ?? "Ollama ne répond pas sur 127.0.0.1:11434." });
          }
        }
        return;
      }
    }
    await Promise.all(candidates.map(async provider => {
      try {
        const found = await providerApi.discoverModels(provider, secretVault, AbortSignal.timeout(1500));
        await solarStore.saveProvider({ ...provider, connectionState: "connected", lastError: undefined });
        await reconcileModels(provider, found);
      } catch { if (configured.some(item => item.id === provider.id)) await solarStore.saveProvider({ ...provider, connectionState: "error", lastError: "Instance Ollama non joignable." }).catch(() => {}); /* Discovery remains optional and cloud providers remain untouched. */ }
    }));
  })().finally(() => { discovery = null; });
  return discovery;
}
export async function reconcileModels(provider: Provider, found: Model[]) {
  const owner=currentAccountScope();
  const existing = (await solarStore.listModels()).filter(model => model.providerId === provider.id);
  for (let model of found) {
    const old=existing.find(item=>item.id===model.id);let metadataError:string|undefined;
    if(provider.protocol==="ollama"){
      try{
        const info=await readOllamaModelInfo(provider.baseUrl,model.providerModelId??model.name,AbortSignal.timeout(22000));
        const facts=modelFacts(info);
        model={...model,...(facts.contextWindow?{contextWindow:facts.contextWindow,contextSource:"provider" as const}:{}),capabilities:facts.capabilities??old?.capabilities??model.capabilities};
        if(!facts.contextWindow)metadataError="Ollama n’a pas déclaré la capacité de contexte. La dernière valeur confirmée est conservée.";
      }catch{metadataError="Inspection détaillée Ollama indisponible. La dernière capacité et les outils confirmés sont conservés ; réessaie Actualiser.";model={...model,capabilities:old?.capabilities??model.capabilities};}
    }
    if(owner!==currentAccountScope())throw Error("Compte Solar modifié pendant la découverte des modèles.");
    const manual=old?.contextSource==="manual";
    const merged={...model,metadataError,contextWindow:manual?old.contextWindow:model.contextWindow??old?.contextWindow,contextSource:manual?"manual" as const:model.contextSource??old?.contextSource,maxOutputTokens:model.maxOutputTokens??old?.maxOutputTokens,displayName:old?.displayName,displayNameSource:old?.displayNameSource,enabled:old?.enabled??true,source:old?.source==="manual"?"manual" as const:model.source,available:true};
    await solarStore.saveModel(provider.protocol==="ollama"?localModelIdentity(merged):merged);
  }
  for (const model of existing) if (model.source === "remote" && !found.some(item => item.id === model.id)) await solarStore.saveModel({ ...model, available: false });
}
export async function prepareOllama(provider: Provider, model: Model, signal: AbortSignal,profile:PerformanceProfile="balanced"): Promise<"ready" | "skipped"> {
  const response = await providerFetch(ollamaUrl(provider.baseUrl, "/api/ps"), { signal });
  if (!response.ok) throw new Error("État mémoire indisponible.");
  const payload = await response.json() as { models?: { name?: string; model?: string; size?: number }[] };
  const loaded = payload.models ?? []; const id = model.providerModelId ?? model.name;
  if (loaded.some(item => item.name === id || item.model === id)) return "ready";
  // Avoid evicting another resident model or consuming extra RAM just to prewarm.
  if (loaded.length) return "skipped";
  const request = await providerFetch(ollamaUrl(provider.baseUrl, "/api/chat"), { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: id, messages: [], stream: false, ...runtimeProfile(profile),options:{...runtimeProfile(profile).options,num_ctx:localRequestContext(modelContext(model,provider,profile).window,[],undefined,8192)} }) });
  if (!request.ok) throw new Error("Préchargement indisponible.");
  const result = await request.json() as { error?: string }; if (result.error) throw new Error("Préchargement indisponible.");
  return "ready";
}
