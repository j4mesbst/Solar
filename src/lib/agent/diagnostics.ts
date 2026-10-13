import type { AgentMode, AgentState } from "./types.ts";

export interface AgentDiagnostic {
  generationId: string;
  state: AgentState;
  mode: AgentMode;
  selectedFiles: number;
  repair: number;
  at: number;
}

const recent: AgentDiagnostic[] = [];

// Metadata only: prompts, paths, file contents and credentials never enter this log.
export function recordAgentDiagnostic(event: Omit<AgentDiagnostic, "at">) {
  recent.push({ ...event, at: Date.now() });
  if (recent.length > 100) recent.splice(0, recent.length - 100);
}

export function getAgentDiagnostics() { return recent.map(item => ({ ...item })); }
