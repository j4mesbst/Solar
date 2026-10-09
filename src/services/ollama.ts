import type { Model, Provider } from "../domain/types";
import { solarStore } from "./store";
import { providerApi } from "./providerApi";
import { secretVault } from "./nativeVault";
import { ollamaUrl, providerFetch } from "./transport";
let discovery: Promise<void> | null = null;
export async function refreshOllama(): Promise<void> {
  if (discovery) return discovery;
  discovery = (async () => {
    const configured = (await solarStore.listProviders()).filter(p => p.protocol === "ollama");
    const candidates = configured.length ? configured.filter(p => p.enabled) : [{ id: "ollama:local", name: "Ollama", baseUrl: "http://127.0.0.1:11434", protocol: "ollama" as const, secretRef: "provider:ollama:local", enabled: true, connectionState: "unknown" as const }];
    await Promise.all(candidates.map(async provider => {
      try {
        const found = await providerApi.discoverModels(provider, secretVault, AbortSignal.timeout(2500));
        await solarStore.saveProvider({ ...provider, connectionState: "connected", lastError: undefined });
        await reconcileModels(provider, found);
      } catch { if (configured.some(item => item.id === provider.id)) await solarStore.saveProvider({ ...provider, connectionState: "error", lastError: "Instance Ollama non joignable." }).catch(() => {}); /* Discovery remains optional and cloud providers remain untouched. */ }
    }));
  })().finally(() => { discovery = null; });
  return discovery;
}
export async function reconcileModels(provider: Provider, found: Model[]) {
  const existing = (await solarStore.listModels()).filter(model => model.providerId === provider.id);
  for (const model of found) { const old = existing.find(item => item.id === model.id); await solarStore.saveModel({ ...model, displayName: old?.displayName, displayNameSource: old?.displayNameSource, enabled: old?.enabled ?? true, source: old?.source === "manual" ? "manual" : model.source, available: true }); }
  for (const model of existing) if (model.source === "remote" && !found.some(item => item.id === model.id)) await solarStore.saveModel({ ...model, available: false });
}
export async function prepareOllama(provider: Provider, model: Model, signal: AbortSignal): Promise<"ready" | "skipped"> {
  const response = await providerFetch(ollamaUrl(provider.baseUrl, "/api/ps"), { signal });
  if (!response.ok) throw new Error("État mémoire indisponible.");
  const payload = await response.json() as { models?: { name?: string; model?: string; size?: number }[] };
  const loaded = payload.models ?? []; const id = model.providerModelId ?? model.name;
  if (loaded.some(item => item.name === id || item.model === id)) return "ready";
  // Avoid evicting another resident model or consuming extra RAM just to prewarm.
  if (loaded.length) return "skipped";
  const request = await providerFetch(ollamaUrl(provider.baseUrl, "/api/chat"), { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: id, messages: [], stream: false, keep_alive: "5m" }) });
  if (!request.ok) throw new Error("Préchargement indisponible.");
  const result = await request.json() as { error?: string }; if (result.error) throw new Error("Préchargement indisponible.");
  return "ready";
}
