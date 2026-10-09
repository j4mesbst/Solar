import type { SolarStore } from "./contracts";
import type { AppSettings, Conversation, Message, Model, Provider } from "../domain/types";

const keys = { providers: "solar.providers.v1", models: "solar.models.v1", conversations: "solar.conversations.v1", messages: "solar.messages.v1", settings: "solar.settings.v1" };
const read = <T>(key: string, fallback: T): T => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } };
const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));
const providers: Provider[] = read(keys.providers, []);
const models: Model[] = read(keys.models, []);
const conversations: Conversation[] = read(keys.conversations, []);
const messages: Message[] = read(keys.messages, []);
let settings: AppSettings = read(keys.settings, { theme: "dark" });

const upsert = <T extends { id: string }>(items: T[], item: T) => { const index = items.findIndex(value => value.id === item.id); if (index < 0) items.push(item); else items[index] = item; };

export const mockStore: SolarStore = {
  async listProviders() { return [...providers]; }, async listModels() { return [...models]; },
  async listConversations() { return [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
  async listMessages(conversationId) { return messages.filter(message => message.conversationId === conversationId).sort((a, b) => a.order - b.order); },
  async getSettings() { return settings; }, async saveSettings(next) { settings = next; write(keys.settings, settings); },
  async saveConversation(conversation) { upsert(conversations, conversation); write(keys.conversations, conversations); },
  async deleteConversation(conversationId) { for (let i = conversations.length - 1; i >= 0; i--) if (conversations[i].id === conversationId) conversations.splice(i, 1); for (let i = messages.length - 1; i >= 0; i--) if (messages[i].conversationId === conversationId) messages.splice(i, 1); write(keys.conversations, conversations); write(keys.messages, messages); },
  async saveMessage(message) { upsert(messages, message); write(keys.messages, messages); },
  async saveProvider(provider) { upsert(providers, provider); write(keys.providers, providers); },
  async deleteProvider(providerId) { for (let i = providers.length - 1; i >= 0; i--) if (providers[i].id === providerId) providers.splice(i, 1); for (let i = models.length - 1; i >= 0; i--) if (models[i].providerId === providerId) models.splice(i, 1); write(keys.providers, providers); write(keys.models, models); },
  async saveModel(model) { upsert(models, model); write(keys.models, models); },
  async deleteModel(modelId) { const i = models.findIndex(item => item.id === modelId); if (i !== -1) models.splice(i, 1); write(keys.models, models); }
};

// Preview only: secrets are held in memory and never written to localStorage.
const memory = new Map<string, string>();
export const previewVault = { async get(key: string) { return memory.get(key) ?? null; }, async set(key: string, value: string) { memory.set(key, value); }, async delete(key: string) { memory.delete(key); } };
