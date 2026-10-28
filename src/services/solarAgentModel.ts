import type { Model, Provider } from "../domain/types.ts";
import type { SolarAgent } from "./solarAgentStore.ts";
export function agentModel(agent: SolarAgent, providers: Provider[], models: Model[]) {
  const model = models.find(item => item.id === agent.modelId && item.providerId === agent.providerId && item.enabled && item.available !== false);
  const provider = providers.find(item => item.id === agent.providerId && item.enabled);
  if (!model || !provider) throw new Error("Le modèle de cet agent est indisponible. Sélectionne un autre modèle dans sa configuration.");
  return { model, provider };
}
