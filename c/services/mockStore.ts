import type { SolarStore } from "./contracts";
import type { AppSettings, Conversation, Message, Model, Provider } from "../domain/types";

const providers: Provider[] = [{ id: "ollama", kind: "ollama", name: "Ollama", enabled: false }];
const models: Model[] = [];
const conversations: Conversation[] = [{ id: "welcome", title: "Welcome to Solar", updatedAt: new Date().toISOString() }];
const messages: Message[] = [];
let settings: AppSettings = { theme: "dark" };
export const mockStore: SolarStore = {
  async listProviders() { return providers; }, async listModels() { return models; },
  async listConversations() { return conversations; }, async listMessages() { return messages; },
  async getSettings() { return settings; }, async saveSettings(next) { settings = next; }
};
