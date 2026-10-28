export type AgentMode = "fast" | "balanced" | "deep";
export type AgentTaskType = "question" | "codeGeneration" | "codeModification" | "debugging" | "uiGeneration" | "artifactGeneration" | "repositoryTask";
export type AgentComplexity = "trivial" | "simple" | "medium" | "complex";
export type AgentState = "idle" | "analyzing" | "selectingContext" | "planning" | "generating" | "applyingChanges" | "verifying" | "repairing" | "completed" | "failed";

export interface SolarIntent {
  taskType: AgentTaskType;
  objective: string;
  constraints: string[];
  needsRepositoryAccess: boolean;
  needsClarification: boolean;
  expectedArtifact?: string;
}

export interface AgentModelProfile {
  id: string;
  displayName: string;
  baseModel: string;
  parameterClass: "small" | "medium" | "largeLocal" | "cloud";
  contextWindow: number;
  temperature: number;
  supportsStructuredOutput: boolean;
  supportsToolCalling: boolean;
  preferredMode: AgentMode;
  maxFiles: number;
  adapterPath?: string;
}

export interface RepositoryFile { path: string; language: string; size?: number; summary?: string }
export interface RepositoryIndex { files: RepositoryFile[]; architectureSummary: string; signature: string }
export interface AgentProject {
  id: string;
  name: string;
  files: string[];
  preferredFiles?: string[];
  readFile: (path: string, signal: AbortSignal) => Promise<string>;
}
export interface ContextBudget { maximumTokens: number; reservedForGeneration: number; reservedForSystem: number; charactersPerToken?:number; fileCharacters?:number }
export interface SelectedFile { path: string; content: string; score: number; sourceHash?:string }
export interface SelectedProjectContext { files: SelectedFile[]; architectureSummary: string; relatedPaths: string[]; estimatedTokens: number; budget: number }

export interface AgentPlanStep { id: string; action: string; files: string[]; expectedResult: string }
export interface AgentPlan { objective: string; steps: AgentPlanStep[] }

export type AgentAction =
  | { type: "readContext"; id:string; start?:number; end?:number }
  | { type: "searchSymbol"; query: string }
  | { type: "readSymbol"; symbolId: string }
  | { type: "readFileRange"; path: string; start: number; end: number }
  | { type: "replaceRange"; path: string; start: number; end: number; content: string; sourceHash: string }
  | { type: "patchStyle"; path: string; selector: string; changes: Record<string, string>; sourceHash: string }
  | { type: "applyPatch"; path: string; oldText: string; newText: string }
  | { type: "inspectUI"; path:string; viewport:{width:number;height:number} }
  | { type: "inspectMotion"; path:string; timeline:number[]; selector?:string }
  | { type: "readFile"; path: string }
  | { type: "searchCode"; query: string }
  | { type: "patchFile"; path: string; oldText: string; newText: string }
  | { type: "createFile"; path: string; content: string }
  | { type: "replaceFile"; path: string; content: string }
  | { type: "replaceSymbol"; path: string; symbol: string; content: string; sourceHash?: string }
  | { type: "runCommand"; command: string }
  | { type: "runTests"; target?: string }
  | { type: "runCheck"; identifier: "build" | "tests" | "types" }
  | { type: "renderPreview"; path: string }
  | { type: "inspectRender"; path: string }
  | { type: "finish"; message: string };
export interface DomExpectation { selector:string; text?:string; value?:string; visible?:boolean; attribute?:{name:string;value?:string;present?:boolean}; style?:Record<string,string> }
export interface VisualInteraction {selector:string;type:'click'|'fill';value?:string;expect?:DomExpectation[]}
export interface AgentVisualValidation {interactions?:VisualInteraction[];expectations?:DomExpectation[];timeline?:number[];reducedMotion?:boolean}
export interface AgentActionResponse { actions: AgentAction[]; finalMessage?: string; diagnosis?: string; validation?:AgentVisualValidation; validationError?:string }
export interface AgentFileChange { path: string; before: string; after: string; created?: boolean }
export interface VerificationResult { type: "syntax" | "imports" | "structure" | "build" | "tests"; success: boolean; output: string; file?: string; line?: number; column?: number }
export interface AgentErrorSummary { primaryError: string; file?: string; line?: number; relatedErrors: string[] }
export interface AgentMetrics { timeToFirstTokenMs?: number; totalGenerationMs: number; contextTokenCount: number; generatedTokenCount?: number; repairIterations: number; contextFiles: number }
export interface AgentResult { finalAnswer: string; changedFiles: AgentFileChange[]; verificationResults: VerificationResult[]; iterations: number; plan?: AgentPlan; mode: AgentMode; metrics: AgentMetrics; generationId: string }

export interface AgentRequest {
  userPrompt: string;
  conversationId: string;
  model: AgentModelProfile;
  project: AgentProject;
  mode?: AgentMode;
  allowChanges: boolean;
  signal: AbortSignal;
  additionalGuidance?: string;
}
export interface AgentModelCall { system: string; prompt: string; schema?: object; visible?: boolean; onDelta?: (part: string) => void; onProgress?: () => void; maxOutputTokens?: number; temperature?: number; images?: string[]; preferJson?:boolean; visual?:boolean; context?:import('../cortex/context-engine.ts').ContextPacket; /** Runtime already serialized and budgeted context; transport must not inject it again. */ contextPrepared?:boolean; onContext?:(value:ReturnType<typeof import('../cortex/budget.ts').fitModelPayload>)=>void; reason?:string }
export interface AgentDependencies {
  generate: (call: AgentModelCall, signal: AbortSignal) => Promise<string>;
  onState?: (state: AgentState, detail?: string) => void;
  onLog?: (event: { generationId: string; state: AgentState; mode: AgentMode; selectedFiles: number; repair: number }) => void;
  verify?: (changes: AgentFileChange[], context: SelectedProjectContext, signal: AbortSignal) => Promise<VerificationResult[]>;
  onProposal?: (changes: AgentFileChange[], signal: AbortSignal) => Promise<void>;
}
