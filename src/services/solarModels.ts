import type { Model, Provider } from "../domain/types";
import { pullModel, type PullProgress } from "./modelInstall";
import { inspectOllama, startOllama } from "./ollamaNative";
import { reconcileModels } from "./ollama";
import { solarStore } from "./store";
import { providerFetch, ollamaUrl } from "./transport";
import { isLegacySolar9B } from "./localModelIdentity";

export const SOLAR_RUNTIME_PROVIDER_ID = "solar:local-runtime";
export interface SolarModelDefinition {
  id: "solar-4b" | "solar-9b" | "solar-12b";
  name: string;
  base: string;
  runtimeId: string;
  sizeLabel: string;
  description: string;
  recommendedForCode: boolean;
  sourceUrl: string;
  license: string;
}

export const solarModelCatalog: SolarModelDefinition[] = [
  { id: "solar-4b", name: "Solar 4B", base: "Qwen3-4B", runtimeId: "qwen3:4b", sizeLabel: "≈ 2,6 Go", description: "Rapide et léger, pour le chat quotidien et le code simple.", recommendedForCode: false, sourceUrl: "https://huggingface.co/Qwen/Qwen3-4B", license: "Apache 2.0" },
  { id: "solar-9b", name: "Solar 9B", base: "Ornith-1.5-9B", runtimeId: "ornith-1.5:9b", sizeLabel: "≈ 6,6 Go", description: "Développement agentique avec Solar Cortex. Ancienne version conservée pendant la migration.", recommendedForCode: true, sourceUrl: "https://huggingface.co/ornith-ai/Ornith-1.5-9B", license: "MIT · Ornith AI" },
  { id: "solar-12b", name: "Solar 12B", base: "Gemma 3 12B IT", runtimeId: "gemma3:12b", sizeLabel: "≈ 8,1 Go", description: "Généraliste multimodal, adapté aux tâches de Solar Code.", recommendedForCode: true, sourceUrl: "https://huggingface.co/google/gemma-3-12b-it", license: "Licence Gemma · acceptation requise" },
];

export function solarModelIsInstalled(definition: SolarModelDefinition, models: Model[]) {
  return models.some(model => model.available !== false && (model.id === `${SOLAR_RUNTIME_PROVIDER_ID}:${definition.runtimeId}` || model.providerModelId === definition.runtimeId));
}

export const solarDownloadCommand = (definition: SolarModelDefinition) => `ollama pull ${definition.runtimeId}`;

async function runtimeProvider(): Promise<Provider> {
  const providers = await solarStore.listProviders();
  const existing = providers.find(provider => provider.id === SOLAR_RUNTIME_PROVIDER_ID);
  const provider: Provider = existing ?? { id: SOLAR_RUNTIME_PROVIDER_ID, name: "Modèles Solar", protocol: "ollama", baseUrl: "http://127.0.0.1:11434", secretRef: "provider:solar:local-runtime", enabled: true, connectionState: "unknown" };
  const normalized = { ...provider, name: "Modèles Solar", baseUrl: "http://127.0.0.1:11434", enabled: true };
  if (!existing || existing.baseUrl !== normalized.baseUrl || !existing.enabled) await solarStore.saveProvider(normalized);
  return normalized;
}

export async function downloadSolarModel(definition: SolarModelDefinition, signal: AbortSignal, onProgress: (progress: PullProgress) => void) {
  let status = await inspectOllama("http://127.0.0.1:11434");
  if (!status.supported) throw new Error("Le téléchargement des modèles locaux nécessite l’application Solar pour macOS.");
  if (!status.running && status.installed) {
    await startOllama();
    status = await inspectOllama("http://127.0.0.1:11434");
  }
  if (!status.running) throw new Error(status.error || "Installe et démarre le moteur de modèles locaux pour télécharger un modèle Solar.");
  const provider = await runtimeProvider();
  await pullModel(provider.baseUrl, definition.runtimeId, signal, onProgress);
  if(definition.id==="solar-9b"){
    onProgress({status:"Vérification du nouveau modèle…"});
    const response=await providerFetch(ollamaUrl(provider.baseUrl,"/api/chat"),{method:"POST",headers:{"Content-Type":"application/json"},signal,body:JSON.stringify({model:definition.runtimeId,messages:[{role:"user",content:"Réponds uniquement OK."}],think:false,stream:false,keep_alive:"5m",options:{num_ctx:4096,num_predict:32}})});
    const payload=await response.json() as {error?:string;message?:{content?:string}};
    if(!response.ok||payload.error||!payload.message?.content?.trim())throw new Error("Ornith 1.5 est téléchargé mais n’a pas passé le test de génération. L’ancien modèle et les conversations restent inchangés. "+(payload.error??""));
  }
  const models = status.models.filter(name => name !== definition.runtimeId);
  models.push(definition.runtimeId);
  await reconcileModels(provider, models.map(name => {
    const definitionForModel = solarModelCatalog.find(item => item.runtimeId === name);
    return { id: `${provider.id}:${name}`, providerId: provider.id, providerModelId: name, name: definitionForModel?.name ?? name, displayName: definitionForModel?.name, displayNameSource: definitionForModel?.name, capabilities: definitionForModel?.recommendedForCode ? ["solar-code-recommended"] : [], source: "remote" as const, enabled: true };
  }));
  const installed = (await solarStore.listModels()).find(model => model.id === `${provider.id}:${definition.runtimeId}`);
  if (installed && definition.recommendedForCode) await solarStore.saveModel({ ...installed, capabilities: [...new Set([...installed.capabilities, "solar-code-recommended"])] });
  if(definition.id==="solar-9b"&&installed){
    const previous=(await solarStore.listModels()).filter(item=>item.providerId===provider.id&&isLegacySolar9B(item.providerModelId??item.id));
    const oldIds=new Set(previous.map(item=>item.id));
    const settings=await solarStore.getSettings();if(settings.defaultModelId&&oldIds.has(settings.defaultModelId))await solarStore.saveSettings({...settings,defaultModelId:installed.id});
    // Existing conversations keep their explicit model choice; new conversations use the new default.
  }
}
