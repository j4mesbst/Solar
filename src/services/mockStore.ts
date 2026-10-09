import type { SolarStore } from "./contracts";
import type { AppSettings, Conversation, Message, Model, Provider } from "../domain/types";

// Providers and keys are remembered by this browser at the same Solar address.
// Conversation history remains scoped to one tab and disappears in a new session.
const keys = { providers: "solar.providers.v2", models: "solar.models.v2", conversations: "solar.session.conversations.v1", messages: "solar.session.messages.v1", settings: "solar.settings.v2" };
const legacySessionKeys: Record<string, string> = { "solar.providers.v2": "solar.session.providers.v1", "solar.models.v2": "solar.session.models.v1", "solar.settings.v2": "solar.session.settings.v1" };
const storageFor = (key: string) => key.includes(".session.") ? sessionStorage : localStorage;
const read = <T>(key: string, fallback: T): T => { try { const storage = storageFor(key); let raw = storage.getItem(key); if (!raw && legacySessionKeys[key]) { raw = sessionStorage.getItem(legacySessionKeys[key]); if (raw) storage.setItem(key, raw); } return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } };
const write = (key: string, value: unknown) => storageFor(key).setItem(key, JSON.stringify(value));
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

// Browser preview: persist a key for this browser + Solar address. Native builds
// keep using the macOS Keychain through nativeVault instead.
const previewVaultKey = "solar.preview-vault.v2";
const readPreviewSecrets = (): Record<string, string> => {
  try { let raw = localStorage.getItem(previewVaultKey); if (!raw) { raw = sessionStorage.getItem("solar.preview-vault.v1"); if (raw) localStorage.setItem(previewVaultKey, raw); } return JSON.parse(raw ?? "{}") as Record<string, string>; }
  catch { return {}; }
};
const writePreviewSecrets = (secrets: Record<string, string>) => localStorage.setItem(previewVaultKey, JSON.stringify(secrets));
export const previewVault = {
  async get(key: string) { return readPreviewSecrets()[key] ?? null; },
  async set(key: string, value: string) { const secrets = readPreviewSecrets(); secrets[key] = value; writePreviewSecrets(secrets); },
  async delete(key: string) { const secrets = readPreviewSecrets(); delete secrets[key]; writePreviewSecrets(secrets); }
};
