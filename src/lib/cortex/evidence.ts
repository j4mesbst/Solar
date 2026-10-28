import type { CortexCandidate, CortexTask, CortexVerification, EvidenceRecord } from "./types.ts";
import { diagnosticExcerpt } from "./reliability.ts";
import { dominates } from "./search.ts";
import { checkKey } from './experience.ts';

const key=checkKey;
export function collectEvidence(task:CortexTask,candidate:CortexCandidate):EvidenceRecord[]{
  return candidate.checks.map(check=>({taskId:task.id,candidateId:candidate.id,validatorId:key(check),validatorVersion:check.validatorVersion??"1",status:check.status,
    hardConstraint:check.hardConstraint!==false,qualityMetrics:check.qualityMetrics??(check.measurement!==undefined?{measurement:check.measurement}:{}),
    diagnostics:check.status==="passed"?[]:[check.output.slice(0,1600)],counterexamples:check.counterexamples??[],affectedFiles:check.affectedFiles??(check.file?[check.file]:[]),
    evidenceArtifacts:check.evidenceArtifacts??[],origin:check.origin,experience:check.experience,comparable:check.comparable,timestamp:new Date().toISOString()}));
}
/** Stable validator identities, not prose or scores, guard previous passes. */
export function regressions(before:CortexCandidate|undefined,after:CortexCandidate){
  if(!before)return [];
  const previous=before.checks.filter(check=>check.status==="passed"&&check.hardConstraint!==false&&check.comparable!==false);
  return previous.filter(check=>!after.checks.some(next=>key(next)===key(check))||after.checks.some(next=>key(next)===key(check)&&next.status!=="passed")).map(key);
}
export function evidenceFeedback(checks:CortexVerification[]){
  return checks.filter(check=>check.status!=="passed").slice(0,5).map(check=>{
    const examples=check.counterexamples?.slice(0,3).join("; ");return `[${key(check)}] ${diagnosticExcerpt(check.output)}${examples?`\nContre-exemples observés : ${examples}`:""}`;
  }).join("\n").slice(0,2600);
}
export function preserveEvidence(task:CortexTask,candidate:CortexCandidate,enabled:boolean){
  const previous=task.bestCandidate;const lost=enabled?regressions(previous,candidate):[];
  const before=previous?.checks.filter(c=>c.status==="passed"&&c.hardConstraint!==false).length??0;
  const passed=candidate.checks.filter(c=>c.status==="passed"&&c.hardConstraint!==false).length,failed=candidate.checks.filter(c=>c.status==="failed"&&c.hardConstraint!==false).length;
  const measuredProgress=task.repairMemory?.attempts.at(-1)?.progress??passed>before;
  task.evidence=[...(task.evidence??[]),...collectEvidence(task,candidate)].slice(-200);
  task.attempts=[...(task.attempts??[]),{step:task.steps,passed,failed,regression:lost.length>0,changedFiles:candidate.changes.map(c=>c.path),effectiveRepair:measuredProgress}].slice(-80);
  const invalidSyntax=candidate.checks.some(check=>check.status==="failed"&&(check.type==="syntax"||/SyntaxError/i.test(check.output)));
  if(candidate.changes.length&&!invalidSyntax&&!lost.length&&(!previous||dominates(previous,candidate)||measuredProgress&&(candidate.score??-Infinity)>(previous.score??-Infinity)))task.bestCandidate=structuredClone(candidate);
  return lost;
}
