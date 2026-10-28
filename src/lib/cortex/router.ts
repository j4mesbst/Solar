import type { CortexLimits, CortexMode } from "./types.ts";
import type { SolarIntent } from "../agent/types.ts";

/**
 * A conservative local window: 4K protects low-memory Macs, 8K is the tested
 * default. 12K is deliberately opt-in for Deep/Ultra only once enough memory
 * is available; the context probe records whether that configuration works on
 * the current machine before it is selected by the UI.
 */
export function cortexContextWindow(mode: CortexMode, availableMemory?: number, twelveKValidated = false) {
  if (availableMemory !== undefined && availableMemory < 5 * 2 ** 30) return 4096;
  if (twelveKValidated && (mode === "deep" || mode === "ultra") && (availableMemory === undefined || availableMemory >= 8 * 2 ** 30)) return 12288;
  return 8192;
}

export function routeCompute(intent: SolarIntent, requested: CortexMode, files: number, availableMemory?: number) {
  const simple = intent.taskType === "question" && intent.objective.length < 300;
  const mode = simple ? "fast" : requested;
  const lowMemory = availableMemory !== undefined && availableMemory < 5 * 2 ** 30;
  const contextWindow = cortexContextWindow(mode, availableMemory);
  const limits: CortexLimits = {
    maxAgentSteps: mode === "fast" ? 8 : mode === "balanced" ? 20 : 40,
    maxRepairAttemptsPerIssue: mode === "fast" ? 2 : 5,
    maxCandidateBranches: mode === "ultra" ? lowMemory ? 2 : 3 : mode === "deep" && files > 4 ? 2 : 1,
    maxRepeatedFailures: 3, checkpointEverySteps: 4,
    maxDurationMs: mode === "fast" ? 120_000 : mode === "balanced" ? 480_000 : 1_200_000,
  };
  return { mode, contextWindow, maxFiles: lowMemory ? 3 : mode === "fast" ? 4 : 7, limits };
}

export function routeStrategy(objective:string,files:number){
  if(isVisualObjective(objective))return "visual" as const;
  if(files>4||/refactor|multi.fich|architecture|dépendance|imports?/i.test(objective))return "code" as const;
  return "fast" as const;
}

export function isVisualObjective(objective:string){
  const explicitUi=/\b(?:ui|ux|html|css|react|gsap|remotion|animation|transition|motion|responsive|page|screen|design|sidebar|dashboard|bouton|button)\b|visuel|écran/i.test(objective);
  if(explicitUi)return true;
  if(/\binterface\b/i.test(objective)&&(/\b(?:typescript|dto|contrat|type|api)\b/i.test(objective)||/\binterface\s+[A-Z]\w*\b/.test(objective)))return false;
  return /\binterface\b/i.test(objective);
}

export function scoreCandidate(checks: { status: string; type?:string; measurement?:number }[], changes: { before: string; after: string }[]) {
  // Ranking heuristic only; deliberately not a success probability.
  const failed = checks.filter(c => c.status === "failed").length;
  const unavailable = checks.filter(c => c.status === "unavailable").length;
  const passed = new Set(checks.filter(c => c.status === "passed").map(c=>c.type??"check")).size;
  const churn = changes.reduce((n, c) => n + Math.abs(c.after.length - c.before.length), 0);
  const pixelDifference=checks.find(c=>c.measurement!==undefined)?.measurement??0;
  return passed * 10 - failed * 100 - unavailable * 20 - Math.min(10, churn / 2000) - pixelDifference*5;
}
