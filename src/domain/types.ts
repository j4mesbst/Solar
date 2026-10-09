export type ProviderProtocol = "openai-compatible" | "ollama";
export type ConnectionState = "unknown" | "testing" | "connected" | "error";

export interface Provider {
  id: string; name: string; protocol: ProviderProtocol; baseUrl: string; secretRef: string;
  enabled: boolean; connectionState: ConnectionState; lastError?: string;
}
export interface Model {
  id: string; providerId: string; name: string; capabilities: string[];
  source: "remote" | "manual"; enabled: boolean; available?: boolean; providerModelId?: string;
}
export type Effort = "low" | "medium" | "high" | "ultra";
export type MessageStatus = "pending" | "streaming" | "completed" | "interrupted" | "error";
export interface Conversation {
  id: string; title: string; providerId?: string; modelId?: string; effort: Effort;
  createdAt: string; updatedAt: string; pinned?: boolean; temporary?: boolean; titleManuallyEdited?: boolean;
}
export interface Message {
  id: string; conversationId: string; role: "user" | "assistant" | "system";
  content: string; status: MessageStatus; createdAt: string; order: number; error?: string; modelName?: string; effort?: Effort; durationSeconds?: number; favorite?: boolean; displayText?: string; attachments?: PastedContent[];
}
export interface AppSettings { theme: "system" | "dark" | "light"; defaultModelId?: string; sendOnEnter?: boolean; }

export interface PastedContent { id: string; title: string; content: string; kind: "text" | "code"; }
export interface Draft { conversationId: string; text: string; attachments: PastedContent[]; updatedAt: string; }
