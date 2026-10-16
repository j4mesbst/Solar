import type { AgentModelProfile, ContextBudget } from "./types.ts";

export function modelProfile(id: string, displayName: string, protocol: string, availableMemory?: number): AgentModelProfile {
  const name = `${id} ${displayName}`.toLowerCase();
  const local = protocol === "ollama";
  const small = local && /(?:solar[ _-]?4b|qwen3[:_\-. ]?4b)/.test(name);
  const medium = local && /(?:solar[ _-]?9b|ornith.*9b)/.test(name);
  const large = local && /(?:solar[ _-]?12b|gemma.*12b)/.test(name);
  const parameterClass = !local ? "cloud" : small ? "small" : large ? "largeLocal" : "medium";
  const lowMemory = availableMemory !== undefined && availableMemory < 8 * 2 ** 30;
  return {
    id, displayName, baseModel: small ? "Qwen3-4B" : medium ? (/ornith-1\.5/i.test(id) ? "Ornith-1.5-9B" : "Ornith-1.0-9B") : large ? "Gemma 3 12B IT" : displayName,
    parameterClass, contextWindow: small ? 8192 : medium ? 16384 : large ? 32768 : local ? 12288 : 64000,
    temperature: /ornith-1\.5/i.test(id) ? 0.6 : small ? 0.1 : medium ? 0.15 : large ? 0.2 : 0.3,
    supportsStructuredOutput: local, supportsToolCalling: false,
    preferredMode: large && !lowMemory ? "deep" : "balanced",
    maxFiles: small ? 2 : medium ? 5 : large ? 8 : 10,
  };
}

export function contextBudget(model: AgentModelProfile, availableMemory?: number): ContextBudget {
  const memoryLimit = availableMemory !== undefined && availableMemory < 6 * 2 ** 30 ? 0.5 : availableMemory !== undefined && availableMemory < 12 * 2 ** 30 ? 0.75 : 1;
  const maximumTokens = Math.max(3000, Math.floor(Math.min(model.contextWindow, model.parameterClass === "small" ? 8000 : model.parameterClass === "medium" ? 16000 : 30000) * memoryLimit));
  return { maximumTokens, reservedForGeneration: Math.max(1000, Math.floor(maximumTokens * 0.22)), reservedForSystem: Math.max(500, Math.floor(maximumTokens * 0.12)) };
}
