import type { AgentFileChange, AgentModelCall, AgentProject, SelectedProjectContext, SolarIntent, VerificationResult, AgentVisualValidation } from "../agent/types.ts";
import type { Metrics } from "../../domain/extensions.ts";
import type { ModelExperience, ModelFacts } from "./adaptive.ts";
import type { TaskGraph } from "./task-graph.ts";
import type { SolutionSearch } from "./search.ts";

export const CORTEX_MODEL = "ornith-1.5:9b";
export const CORTEX_VERSION = "4.1.0";
export type EvidenceOrigin = "user-requirement" | "independent" | "deterministic" | "model-suggestion" | "vision-advice";
export interface VerificationExperience {
  id:string; comparisonKey:string; sourceHashes:Record<string,string>; dependencies:Record<string,string>;
  engine:string; version:string; environment:string; parameters:unknown;
}
export interface CortexFeatures { atomicActions: boolean; semantic: boolean; cegis: boolean; visualSolver: boolean; evolution: boolean; adaptive: boolean }
export const defaultFeatures: CortexFeatures = { atomicActions:true, semantic:true, cegis:true, visualSolver:true, evolution:true, adaptive:true };
export interface EvidenceRecord {
  taskId: string; candidateId: string; validatorId: string; validatorVersion: string; status: CortexVerification["status"];
  hardConstraint: boolean; qualityMetrics: Record<string,number>; diagnostics: string[]; counterexamples: string[];
  affectedFiles: string[]; evidenceArtifacts: string[]; timestamp: string;
  origin?:EvidenceOrigin; experience?:VerificationExperience; comparable?:boolean;
}
export interface VisualConstraint { id:string; selector:string; property: "x"|"y"|"width"|"height"|"opacity"|"fontSize"; expected:number; tolerance:number; timestamp?:number }
export interface InspectionOptions extends AgentVisualValidation { viewport?: {width:number;height:number}; selectors?:string[]; transitionCapture?:boolean }
export type CortexMode = "fast" | "balanced" | "deep" | "ultra";
export type CortexPhase = "analyzing" | "planning" | "generating" | "executing" | "verifying" | "repairing" | "completed" | "paused" | "failed" | "cancelled";
export type StopReason = "stop" | "length" | "tool_calls";
export interface CortexModelResponse { text: string; stopReason: StopReason; tokens?: number; toolCalls?: { name: string; arguments: unknown }[]; metrics?: Metrics; toolFallbacks?:number }
export interface CortexLimits { maxAgentSteps: number; maxRepairAttemptsPerIssue: number; maxCandidateBranches: number; maxRepeatedFailures: number; checkpointEverySteps: number; maxDurationMs: number }
export interface CortexVerification extends Omit<VerificationResult, "type"> {
  origin?:EvidenceOrigin; experience?:VerificationExperience; comparable?:boolean;
  type: VerificationResult["type"] | "intent" | "visual" | "temporal" | "architecture";
  category?: "technical"|"functional"|"visual";
  status: "passed" | "failed" | "unavailable";
  measurement?: number;
  validatorId?: string; validatorVersion?: string; hardConstraint?: boolean; counterexamples?: string[]; affectedFiles?: string[]; evidenceArtifacts?: string[];
  qualityMetrics?: Record<string,number>; renderReport?: RenderReport;
}
export interface CortexCriterion { id: string; kind: "file" | "contains" | "check"; target: string; value?: string }
export interface CortexCandidate { id: string; changes: AgentFileChange[]; checks: CortexVerification[]; issues: string[]; finished: boolean; attempts: number; score?: number }
export interface CortexRepairRecord { step:number; hypothesis:string; actions:string[]; files:string[]; result:string; progress:boolean; category:"technical"|"functional"|"visual"; sourceHashes:Record<string,string> }
export interface CortexRepairMemory {
  objective:string; latestError:string; focusFiles:string[]; lastFailedIds:string[]; lastPassedIds:string[];
  lastMeasurements:Record<string,number>; noProgress:number; strategy:"targeted"|"reassess";
  nextAction:string; attempts:CortexRepairRecord[];
}
export interface CortexEvent { phase: CortexPhase; detail: string; at: string }
export interface CortexTelemetry {
  startedAt: string;
  firstArtifactMs?: number;
  firstVerificationMs?: number;
  promptTokens: number;
  outputTokens: number;
  cachedPromptTokens: number;
  inferenceMs: number;
  toolCalls: number;
  checkpoints: number;
  loopsDetected: number;
  outputTokenSamples?: number; promptTokenSamples?: number; cachedPromptTokenSamples?:number;
  phaseMs: Partial<Record<CortexPhase, number>>;
  executionChecks?: number;
  syntaxGates?: number;
  rejectedActions?: number;
  verificationErrors?: number;
  rolledBackTransactions?: number;
  contextTokensEstimate?: number;
}
export interface CortexTask {
  contextArchive?:import('./context-engine.ts').ContextObservation[];
  contextSequence?:number;
  contextRecoveries?:{id:string;start:number;end:number;hash:string;stale:boolean}[];
  userRequirements?:string;
  generationDecisions?:{step:number;reason:string;source:string;diagnostic:string;context:string;strategy:string}[];
  calls?:{id:string;role:string;schemaHash?:string;sourceHashes:Record<string,string>;phaseBefore:CortexPhase;phaseAfter?:CortexPhase;startedAt:string;durationMs?:number;tokens?:number;promptTokens?:number;tokensMeasured:boolean;promptTokensMeasured:boolean;status:'running'|'completed'|'aborted'|'error';stopReason?:string;errorKind?:string;retry?:number;parsing?:'accepted'|'rejected';receivedCharacters?:number;reason?:string;context?:import('./context-engine.ts').ContextSelection;payloadCharacters?:number;payloadBytes?:number;estimatedInputTokens?:number;cachedPromptTokens?:number;promptMs?:number;loadMs?:number;decodeMs?:number;providerAttempted?:boolean}[];
  proposalDelivery?:'pending'|'delivered';
  verificationSettings?:{inspection?:InspectionOptions;modelKey?:string;environment?:string};
  cortexVersion?: string; features?: CortexFeatures; strategy?: "fast"|"code"|"visual"|"evolution"|"recovery";
  evidence?: EvidenceRecord[]; bestCandidate?: CortexCandidate; evolutionAttempts?: number;
  attempts?: { step:number; passed:number; failed:number; regression:boolean; changedFiles:string[]; effectiveRepair:boolean }[];
  visualAdvice?: string[];
  visualReview?:{key:string;advice:string[]};
  semanticNotes?: string[];
  actionTrace?: { step: number; response: string; truncated: boolean; outcome: string; files: { path: string; hash: string }[];actions?:{type:string;path?:string}[] }[];
  repairBrief?: string;
  repairMemory?: CortexRepairMemory;
  pendingRepairEdit?: { step:number; hypothesis:string; actions:string[]; files:string[] };
  patchConflict?: { path:string; hash:string };
  rejectedEdits?: string[];
  rejectedActions?: string[];
  rejectedActionCounts?:Record<string,number>;
  focusFiles?: string[];
  modelExperience?:ModelExperience;
  taskGraph?:TaskGraph;
  solutionSearch?:SolutionSearch;
  behaviorValidation?:AgentVisualValidation;
  pendingBehavior?: boolean;
  sourceReads?:{path:string;hash:string;content:string;signature:string}[];
  memorySourceFingerprints?:Record<string,string>;
  memoryFingerprintAlgorithm?:'sha256';
  acceptedCandidate?:CortexCandidate;
  searchBranches?:number;
  pendingMutation?: boolean;
  version: 1; id: string; conversationId: string; workspaceId: string; modelId: string; prompt: string;
  mode: CortexMode; phase: CortexPhase; plan: string[]; criteria: CortexCriterion[];
  candidates: CortexCandidate[]; branch: number; steps: number; generations: number; repairs: number;
  tokens: number; elapsedMs: number; events: CortexEvent[]; context?: SelectedProjectContext;
  issues: string[]; failures: Record<string, number>; pendingOutput?: string; pendingContinuations?: number; updatedAt: string;
  referenceImage?: string;
  verificationStatus?: "verified" | "completed_unverified";
  telemetry?: CortexTelemetry;
}
export interface CortexPersistence { save(task: CortexTask): Promise<void>; load(id: string): Promise<CortexTask | undefined> }
export interface CortexRequest {
  id?: string; conversationId: string; prompt: string; modelId: string; project: AgentProject & { workspaceId?: string };
  mode: CortexMode; signal: AbortSignal; allowChanges: boolean; availableMemory?: number;
  limits?: Partial<CortexLimits>; guidance?: string; conversationRequirements?:string; criteria?: CortexCriterion[]; referenceImage?: string;
  /** Durée maximale sans aucun fragment reçu d’Ollama. Ce n’est pas une
   * limite de durée de génération : le compteur est réarmé à chaque delta. */
  generationTimeoutMs?: number;
  features?: Partial<CortexFeatures>;
  visualConstraints?: VisualConstraint[];
  inspection?: InspectionOptions;
  evolution?: { metric:string; target:number; direction:"min"|"max" };
  protectedPaths?: string[];
  modelFacts?:ModelFacts;
  taskGraph?:TaskGraph;
}
export interface RenderElement {
  styles?:Record<string,string>;
  tag?:string; value?:string;
  aliases?:string[]; visible?:boolean; attributes?:Record<string,string>;
  selector: string; x: number; y: number; width: number; height: number; opacity: number; transform: string; filter: string;
  text?: string; color?: string; backgroundColor?: string; fontFamily?: string; fontSize?: number; fontWeight?: string;
  lineHeight?: string; letterSpacing?: string; borderRadius?: string;
}
export interface RenderTelemetryIssue { selector: string; issue: "horizontal-overflow" | "vertical-overflow" | "collision" | "text-clipped" | "low-contrast" | "layout-motion"; detail: string; measurement?: number }
export interface RenderFrame { timestamp: number; image: string; elements: RenderElement[]; overflow: number; overflowY?: number; telemetry?: RenderTelemetryIssue[]; reducedMotion?: boolean }
export interface DomObservation {selector:string;found:boolean;tag?:string;text?:string;value?:string;visible?:boolean;attributes?:Record<string,string>;styles?:Record<string,string>}
export interface RenderReport { supported: boolean; frames: RenderFrame[]; errors: string[]; referenceDifference?: number; width: number; height: number; interactions?:{selector:string;success:boolean;type?:string;detail?:string;observations?:DomObservation[];readiness?:'observed'|'timed-out';waitMs?:number}[]; reducedMotionEmulated?:boolean; observedSelectors?:string[] }
export interface CortexServices {
  /** Change this identity when tools/tests/environment change within a task. */
  verificationEnvironment?:string|(()=>Promise<string>);
  persistence: CortexPersistence;
  generate(call: AgentModelCall, signal: AbortSignal): Promise<CortexModelResponse>;
  verify?: (changes: AgentFileChange[], signal: AbortSignal, taskId: string, options?:InspectionOptions) => Promise<CortexVerification[]>;
  render?: (html: string, times: number[], signal: AbortSignal, reference?: string, options?:InspectionOptions) => Promise<RenderReport>;
  semanticDiagnostics?: (paths:string[],changes:AgentFileChange[],signal:AbortSignal)=>Promise<CortexVerification[]>;
  supportsVision?: boolean;
  onState?: (task: CortexTask) => void;
  onProposal?: (changes: AgentFileChange[], signal: AbortSignal) => Promise<void>;
  retrieveMemory?: (intent: SolarIntent, workspaceId: string, identity?:{modelKey:string;environment?:string}) => Promise<string>;
  recordTrajectory?: (task: CortexTask) => Promise<void>;
  loadModelExperience?: (key:string) => Promise<ModelExperience|undefined>;
  saveModelExperience?: (profile:ModelExperience) => Promise<void>;
}
export interface CortexResult { task: CortexTask; changes: AgentFileChange[]; checks: CortexVerification[]; answer: string }
