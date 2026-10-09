export type ProviderProtocol = "openai-compatible" | "ollama";
export type ConnectionState = "unknown" | "testing" | "connected" | "error";

export interface Provider {
  id: string; name: string; protocol: ProviderProtocol; baseUrl: string; secretRef: string;
  enabled: boolean; connectionState: ConnectionState; lastError?: string;
}
export interface Model {
  id: string; providerId: string; name: string; capabilities: string[];
  source: "remote" | "manual"; enabled: boolean; providerModelId?: string;
}
export type Effort = "low" | "medium" | "high" | "ultra";
export type MessageStatus = "pending" | "streaming" | "completed" | "interrupted" | "error";
export interface Conversation {
  id: string; title: string; providerId?: string; modelId?: string; effort: Effort;
  createdAt: string; updatedAt: string;
}
export interface Message {
  id: string; conversationId: string; role: "user" | "assistant" | "system";
  content: string; status: MessageStatus; createdAt: string; order: number; error?: string;
}
export interface AppSettings { theme: "system" | "dark" | "light"; defaultModelId?: string; }
