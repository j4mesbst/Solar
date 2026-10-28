import type { WebSettings, PerformanceProfile, SearchSource, Metrics } from "./extensions";
export type ProviderProtocol = "openai-compatible" | "ollama" | "anthropic";
export type ConnectionState = "unknown" | "testing" | "connected" | "error";

export interface Provider {
  id: string; name: string; protocol: ProviderProtocol; baseUrl: string; secretRef: string;
  enabled: boolean; connectionState: ConnectionState; lastError?: string;
}
export interface Model {
  id: string; providerId: string; name: string; capabilities: string[];
  metadataError?:string; sizeBytes?: number; contextWindow?: number; contextSource?:"provider"|"manual"|"documented";contextSourceUrl?:string; maxOutputTokens?: number; source: "remote" | "manual"; enabled: boolean; available?: boolean; providerModelId?: string; displayName?: string; displayNameSource?: string;
}
export type Effort = "low" | "medium" | "high" | "xhigh" | "ultra";
export type MessageStatus = "pending" | "streaming" | "completed" | "interrupted" | "error";
export interface Conversation {
  id: string; space?: "chat" | "work" | "agent"; development?: boolean; title: string; providerId?: string; modelId?: string; effort: Effort;
  createdAt: string; updatedAt: string; pinned?: boolean; temporary?: boolean; titleManuallyEdited?: boolean; titleGenerated?: boolean;
  accessMode?: AgentAccessMode;
}
export interface AgentResultCard {
 id:string;kind:"mail"|"message"|"event"|"repository"|"issue"|"file"|"contact"|"task"|"document"|"sheet"|"note"|"resource";
 service:string;title:string;subtitle?:string;body?:string;date?:string;end?:string;url?:string;
 status:"read"|"draft"|"verified"|"acknowledged";action?:"created"|"updated"|"sent";
 metrics?:{label:string;value:number;icon?:"star"|"fork"|"activity"|"people"}[];
 rows?:string[][];items?:{title:string;subtitle?:string;completed?:boolean;date?:string}[];
 detail?:string;completed?:boolean;
}
export interface AgentQuestion { title:string; options:{id:string;label:string;description?:string;prompt:string;service?:import("../services/pluginCatalog").PluginId}[]; selectedId?:string; dismissed?:boolean }
export interface Message { question?:AgentQuestion;questionAnswer?:{messageId:string;optionId:string};connectionAnswer?:{messageId:string}; generatedBy?:"team-manager"; connectionRequest?:{service:import('./../services/pluginCatalog').PluginId;prompt:string;agentId:string;resumedAt?:string};
  id: string; conversationId: string; role: "user" | "assistant" | "system";
  content: string; status: MessageStatus; createdAt: string; order: number; error?: string; modelName?: string; effort?: Effort; durationSeconds?: number; favorite?: boolean; displayText?: string; attachments?: PastedContent[]; activity?: "connecting" | "waiting" | "thinking" | "writing" | "searching"; activities?: string[]; sources?: SearchSource[]; metrics?: Metrics; artifactId?: string; artifactKind?: import("./extensions").ArtifactKind;
  cortexTaskId?: string; cortexPhase?: import("../lib/cortex/types").CortexPhase;
  localCommand?: "context" | "memory" | "clear";
  compacting?: boolean;
  toolReferences?: {tool:string;ids:string[]}[];
  resultCards?:AgentResultCard[];
  contextReport?: import("../services/contextBudget").ContextReport;
}
export interface Palette { accent: string; background: string; surface: string; text: string; sidebar: string; userBubble: string; border: string; selection: string; }
export interface AppSettings { responseDisplay?:"standard"|"messages"; responseSound?:boolean; profile?: { name?: string; avatar?: string }; }
export type AgentAccessMode = "read-only" | "standard" | "full";
export interface AppSettings { agent?: { defaultModelId?: string; defaultEffort?: Effort; showMascot?: boolean; proactive?: boolean; runInBackground?:boolean; personalInstructions?: { name: string; content: string }; instructionsCloud?: boolean }; }
export interface AppSettings { theme: "system" | "dark" | "light"; defaultModelId?: string; sendOnEnter?: boolean; web?: WebSettings; smart?: boolean; pipelineOnline?: boolean; performanceProfile?: PerformanceProfile; cortexMemory?: boolean; cortexFeatures?: Partial<import("../lib/cortex/types").CortexFeatures>; skillsMode?: "auto" | "manual"; manualSkillIds?: string[]; onboardingComplete?: boolean; appearance?: { wallpaperPreset?: "coast" | "beach" | "dunes"; wallpaper?: string; wallpaperName?: string; glassRail?: number; glassChat?: number; light?: Partial<Palette>; dark?: Partial<Palette>; radius?: number; font?: "system" | "rounded" | "serif" }; }

export interface PastedContent { id: string; title: string; content: string; kind: "text" | "code" | "image"; }
export interface Draft { conversationId: string; text: string; attachments: PastedContent[]; updatedAt: string; }
