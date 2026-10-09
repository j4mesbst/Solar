import type { AppSettings, Conversation, Message, Model, Provider } from "../domain/types";

export interface SolarStore {
  listProviders(): Promise<Provider[]>; listModels(): Promise<Model[]>;
  listConversations(): Promise<Conversation[]>; listMessages(conversationId: string): Promise<Message[]>;
  getSettings(): Promise<AppSettings>; saveSettings(settings: AppSettings): Promise<void>;
  saveProvider(provider: Provider): Promise<void>; deleteProvider(providerId: string): Promise<void>;
  saveModel(model: Model): Promise<void>; deleteModel(modelId: string): Promise<void>;
}
export interface SecretVault { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; delete(key: string): Promise<void>; }
