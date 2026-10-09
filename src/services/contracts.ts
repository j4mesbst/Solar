import type { AppSettings, Conversation, Message, Model, Provider } from "../domain/types";

export interface SolarStore {
  listProviders(): Promise<Provider[]>; listModels(): Promise<Model[]>;
  listConversations(): Promise<Conversation[]>; listMessages(conversationId: string): Promise<Message[]>;
  getSettings(): Promise<AppSettings>; saveSettings(settings: AppSettings): Promise<void>;
}
export interface SecretVault { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; delete(key: string): Promise<void>; }
