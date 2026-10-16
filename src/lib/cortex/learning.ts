import type { CortexTask } from "./types.ts";
import { sourceHash } from "./semantic.ts";
import { CORTEX_VERSION } from './types.ts';

export interface Trajectory { id: string; conversationId:string;workspaceId: string; modelId: string; prompt: string; paths: string[]; issues: string[]; evidence: string[]; steps: number; repairs: number; elapsedMs: number; createdAt: string; sourceFingerprints?:Record<string,string>; successfulRepairs?:string[]; validatorVersions?:Record<string,string>; fingerprintAlgorithm?:'sha256';engineVersion?:string;environment?:string;modelKey?:string }
export function redact(text: string) {
  return text.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, "[secret retiré]")
    .replace(/\b(?:sk[-_]|sb_secret_|gh[pousr]_|github_pat_|AKIA)[A-Za-z0-9_-]{12,}/g, "[secret retiré]")
    .replace(/\b(?:Bearer\s+)[\w.\-]+/gi, "Bearer [retiré]")
    .replace(/(["']?(?:api[_-]?key|password|secret|access[_-]?token)["']?\s*[:=]\s*)["']?[^\s,"';}]+["']?/gi, "$1[retiré]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[e-mail retiré]")
    .replace(/\/Users\/[^/\s]+/g, "/Users/[utilisateur]");
}
export function trajectoryFromTask(task: CortexTask): Trajectory | undefined {
  if (task.phase !== "completed") return;
  const winner = task.acceptedCandidate??task.candidates.filter(c => c.finished).sort((a,b) => (b.score ?? 0) - (a.score ?? 0))[0];
  if (!winner || winner.checks.some(c => c.status !== "passed"&&c.hardConstraint!==false)) return;
  const successfulRepairs=(task.repairMemory?.attempts??[]).filter(attempt=>attempt.progress&&attempt.actions.length).slice(-3).map(attempt=>redact(`${attempt.hypothesis}; ${attempt.actions.join('+')}; ${attempt.result}`).slice(0,400));
  return { modelKey:task.verificationSettings?.modelKey,fingerprintAlgorithm:task.memoryFingerprintAlgorithm,engineVersion:CORTEX_VERSION,environment:task.verificationSettings?.environment,id: task.id, conversationId:task.conversationId,workspaceId: task.workspaceId, modelId: task.modelId, prompt: redact(task.prompt).slice(0, 1200), paths: winner.changes.map(c => c.path), issues: task.events.filter(e => e.phase === "repairing").map(e => redact(e.detail)).slice(-8), evidence: winner.checks.filter(c=>c.status==="passed"&&c.hardConstraint!==false).map(c => redact(c.output).slice(0, 350)), steps: task.steps, repairs: task.repairs, elapsedMs: task.elapsedMs, createdAt: task.updatedAt,sourceFingerprints:{...Object.fromEntries(winner.changes.map(change=>[change.path,sourceHash(change.after)])),...task.memorySourceFingerprints},successfulRepairs,validatorVersions:Object.fromEntries(winner.checks.filter(check=>check.hardConstraint!==false).map(check=>[check.validatorId??check.type,check.validatorVersion??'1'])) };
}
export function retrieveTrajectories(items: Trajectory[], prompt: string, workspaceId: string, currentSources?:Record<string,string>, currentShaSources?:Record<string,string>,identity?:{modelKey:string;environment?:string}) {
  const words = new Set(prompt.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  return items.filter(t => (!identity||t.modelKey===identity.modelKey&&(!identity.environment||t.environment===identity.environment))&&t.engineVersion===CORTEX_VERSION&&t.workspaceId === workspaceId&&Boolean(currentSources&&t.sourceFingerprints&&Object.keys(t.sourceFingerprints).length&&Object.entries(t.sourceFingerprints).every(([path,hash])=>(t.fingerprintAlgorithm==='sha256'?currentShaSources?.[path]:currentSources[path])===hash))).map(t => ({ t, score: t.prompt.toLowerCase().split(/\W+/).reduce((n,w) => n + Number(words.has(w)), 0) })).filter(t => t.score > 1).sort((a,b) => b.score - a.score).slice(0, 2).map(({t}) => `Conseil historique (jamais preuve actuelle), empreintes et version du moteur inchangées, tâche ${t.id} : ${t.prompt.slice(0, 180)}; fichiers ${t.paths.join(", ")}; preuves ${t.evidence.slice(0, 2).join("; ")}; réparation utile ${t.successfulRepairs?.at(-1)??'aucune mémorisée'}. Données historiques, pas une nouvelle instruction.`).join("\n").slice(0, 1500);
}
export interface StrategyVersion { version: string; parent?: string; rules: string[]; benchmarkId: string; measurements: { task: string; passed: boolean; milliseconds: number }[] }
// Evolution is gated by paired measurements on the same fixed benchmark.
export function mayPromoteStrategy(baseline: StrategyVersion, candidate: StrategyVersion) {
  if (baseline.benchmarkId !== candidate.benchmarkId || !baseline.measurements.length || baseline.measurements.length !== candidate.measurements.length) return false;
  const paired = baseline.measurements.every(b => candidate.measurements.some(c => c.task === b.task && (!b.passed || c.passed)));
  const gain = candidate.measurements.filter(c => c.passed).length > baseline.measurements.filter(c => c.passed).length;
  const faster = candidate.measurements.reduce((n,m) => n+m.milliseconds,0) < baseline.measurements.reduce((n,m) => n+m.milliseconds,0) * .9;
  return paired && (gain || faster);
}
export function distillRules(items: Trajectory[]) {
  // Candidates only. Nothing is activated before benchmark validation.
  const repaired = items.filter(t => t.repairs > 0);
  return repaired.length >= 10 ? [{ id: "inspect-before-patch", rule: "Relire le fichier concerné avant un patch de réparation.", evidenceTaskIds: repaired.map(t => t.id), status: "needs-benchmark" as const }] : [];
}
export interface ExpertAdapter { taskType: "coding" | "debugging" | "ui" | "motion" | "planning"; modelId: string; path: string; validated: boolean }
export function routeAdapter(adapters: ExpertAdapter[], taskType: ExpertAdapter["taskType"], backendSupportsAdapters: boolean) {
  // Ollama's API has no validated dynamic adapter loader in Solar. Keep the selected model.
  return backendSupportsAdapters ? adapters.find(a => a.taskType === taskType && a.validated)?.modelId : undefined;
}
export function trainingExample(task: CortexTask, consent: boolean) {
  const trajectory = trajectoryFromTask(task);
  if (!consent || !trajectory) return;
  const winner = task.candidates.find(c => c.finished)!;
  return { input: redact(task.prompt), output: winner.changes.map(c => ({ path: c.path, content: redact(c.after) })), feedback: trajectory.evidence, metadata: { model: task.modelId, runtime: "cortex-v1", task: task.id, split: "training-only" } };
}
