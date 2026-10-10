import type { WebSettings, PerformanceProfile, SearchSource, Metrics } from "./extensions";
export type ProviderProtocol = "openai-compatible" | "ollama" | "anthropic";
export type ConnectionState = "unknown" | "testing" | "connected" | "error";

export interface Provider {
  id: string; name: string; protocol: ProviderProtocol; baseUrl: string; secretRef: string;
  enabled: boolean; connectionState: ConnectionState; lastError?: string;
}
export interface Model {
  id: string; providerId: string; name: string; capabilities: string[];
  sizeBytes?: number; source: "remote" | "manual"; enabled: boolean; available?: boolean; providerModelId?: string; displayName?: string; displayNameSource?: string;
}
export type Effort = "low" | "medium" | "high" | "ultra";
export type MessageStatus = "pending" | "streaming" | "completed" | "interrupted" | "error";
export interface Conversation {
  id: string; space?: "chat" | "work"; title: string; providerId?: string; modelId?: string; effort: Effort;
  createdAt: string; updatedAt: string; pinned?: boolean; temporary?: boolean; titleManuallyEdited?: boolean; titleGenerated?: boolean;
}
export interface Message {
  id: string; conversationId: string; role: "user" | "assistant" | "system";
  content: string; status: MessageStatus; createdAt: string; order: number; error?: string; modelName?: string; effort?: Effort; durationSeconds?: number; favorite?: boolean; displayText?: string; attachments?: PastedContent[]; activity?: "connecting" | "waiting" | "thinking" | "writing" | "searching"; activities?: string[]; sources?: SearchSource[]; metrics?: Metrics; artifactId?: string; artifactKind?: import("./extensions").ArtifactKind;
}
export interface Palette { accent: string; background: string; surface: string; text: string; sidebar: string; userBubble: string; border: string; selection: string; }
export interface AppSettings { theme: "system" | "dark" | "light"; defaultModelId?: string; sendOnEnter?: boolean; web?: WebSettings; smart?: boolean; performanceProfile?: PerformanceProfile; onboardingComplete?: boolean; appearance?: { wallpaperPreset?: "coast" | "beach" | "dunes"; wallpaper?: string; wallpaperName?: string; glassRail?: number; glassChat?: number; light?: Partial<Palette>; dark?: Partial<Palette>; radius?: number; font?: "system" | "rounded" | "serif" }; }

export interface PastedContent { id: string; title: string; content: string; kind: "text" | "code" | "image"; }
export interface Draft { conversationId: string; text: string; attachments: PastedContent[]; updatedAt: string; }
