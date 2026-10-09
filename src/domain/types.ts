export type ProviderKind = "ollama" | "openai-compatible" | "anthropic";

export interface Provider { id: string; kind: ProviderKind; name: string; enabled: boolean; baseUrl?: string; }
export interface Model { id: string; providerId: string; name: string; capabilities: string[]; }
export interface Conversation { id: string; title: string; modelId?: string; updatedAt: string; }
export interface Message { id: string; conversationId: string; role: "user" | "assistant" | "system"; content: string; createdAt: string; }
export interface AppSettings { theme: "system" | "dark" | "light"; defaultModelId?: string; }
