import type { SolarStore } from "./contracts";
import type { AppSettings, Conversation, Message, Model, Provider } from "../domain/types";

const key = "solar.providers.v1";
const modelsKey = "solar.models.v1";
const read = <T>(name: string, fallback: T): T => {
  try { const value = localStorage.getItem(name); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};
const write = (name: string, value: unknown) => localStorage.setItem(name, JSON.stringify(value));
const providers: Provider[] = read(key, []);
const models: Model[] = read(modelsKey, []);
const conversations: Conversation[] = [{ id: "welcome", title: "Welcome to Solar", updatedAt: new Date().toISOString() }];
const messages: Message[] = [];
let settings: AppSettings = { theme: "dark" };

export const mockStore: SolarStore = {
  async listProviders() { return [...providers]; }, async listModels() { return [...models]; },
  async listConversations() { return conversations; }, async listMessages() { return messages; },
  async getSettings() { return settings; }, async saveSettings(next) { settings = next; },
  async saveProvider(provider) { const i = providers.findIndex(item => item.id === provider.id); if (i === -1) providers.push(provider); else providers[i] = provider; write(key, providers); },
  async deleteProvider(providerId) { for (let i = providers.length - 1; i >= 0; i--) if (providers[i].id === providerId) providers.splice(i, 1); for (let i = models.length - 1; i >= 0; i--) if (models[i].providerId === providerId) models.splice(i, 1); write(key, providers); write(modelsKey, models); },
  async saveModel(model) { const i = models.findIndex(item => item.id === model.id); if (i === -1) models.push(model); else models[i] = model; write(modelsKey, models); },
  async deleteModel(modelId) { const i = models.findIndex(item => item.id === modelId); if (i !== -1) models.splice(i, 1); write(modelsKey, models); }
};

// Preview only: secrets are held in memory and never written to localStorage.
const memory = new Map<string, string>();
export const previewVault = { async get(k: string) { return memory.get(k) ?? null; }, async set(k: string, v: string) { memory.set(k, v); }, async delete(k: string) { memory.delete(k); } };
