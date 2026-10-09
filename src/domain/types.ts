export type ProviderProtocol = "openai-compatible" | "ollama";
export type ConnectionState = "unknown" | "testing" | "connected" | "error";

export interface Provider {
  id: string; name: string; protocol: ProviderProtocol; baseUrl: string; secretRef: string;
  enabled: boolean; connectionState: ConnectionState; lastError?: string;
}
export interface Model {
  id: string; providerId: string; name: string; capabilities: string[];
  source: "remote" | "manual"; enabled: boolean;
}
export interface Conversation { id: string; title: string; modelId?: string; updatedAt: string; }
export interface Message { id: string; conversationId: string; role: "user" | "assistant" | "system"; content: string; createdAt: string; }
export interface AppSettings { theme: "system" | "dark" | "light"; defaultModelId?: string; }
