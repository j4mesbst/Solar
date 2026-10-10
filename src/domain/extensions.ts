export type SearchMode = "auto" | "on" | "off";
export interface WebSettings {
  mode: SearchMode;
  provider: "duckduckgo" | "searxng" | "brave" | "ollama";
  endpoint?: string;
  consent?: boolean;
}
export interface SearchQuery {
  text: string;
  limit?: number;
}
export interface SearchSource {
  title: string;
  url: string;
  site: string;
  date?: string;
  snippet: string;
}
export interface SearchResult {
  sources: SearchSource[];
  fetchedAt: string;
  cached: boolean;
}
export interface SearchProvider {
  name: string;
  search(query: SearchQuery, signal: AbortSignal): Promise<SearchResult>;
}
export type PerformanceProfile = "eco" | "balanced" | "performance";
export interface Hardware {
  architecture: string;
  totalMemory?: number;
  availableMemory?: number;
  gpu?: string;
  os: string;
  native: boolean;
}
export interface Metrics {
  firstTokenMs?: number;
  totalMs: number;
  tokens?: number;
  tokensPerSecond?: number;
  loadMs?: number;
}
export type ArtifactKind = "code" | "slides" | "document" | "table" | "diagram";
export interface Artifact {
  id: string;
  conversationId: string;
  title: string;
  kind: ArtifactKind;
  content?: string;
  language?: string;
  slides?: { title: string; body: string }[];
  sections?: { title: string; body: string }[];
  columns?: string[];
  rows?: string[][];
  revision: number;
  updatedAt: string;
}
export interface WorkChange {
  path: string;
  before: string;
  after: string;
}
export interface WorkOperation {
  projectToken?: string;
  id: string;
  conversationId: string;
  title: string;
  status: "proposed" | "applied" | "rejected" | "undone";
  changes: WorkChange[];
  createdAt: string;
}
