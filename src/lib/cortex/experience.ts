import { sourceHash } from './semantic.ts';
import type { CortexVerification, VerificationExperience } from './types.ts';

export function canonical(value:unknown):string {
  const sorted=(item:unknown):unknown=>Array.isArray(item)?item.map(sorted):item&&typeof item==='object'?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,sorted(v)])):item;
  return JSON.stringify(sorted(value));
}
export function verificationExperience(sourceHashes:Record<string,string>,parameters:unknown,environment:string,engine='cortex',version='4.1'):VerificationExperience {
  const comparisonKey=sourceHash(canonical({parameters,environment,engine,version}));
  return {id:sourceHash(canonical({sourceHashes,comparisonKey})),comparisonKey,sourceHashes,dependencies:sourceHashes,parameters,environment,engine,version};
}
export function checkKey(check:CortexVerification){return `${check.origin??'independent'}:${check.validatorId??`${check.type}:${check.file??'project'}`}:${check.experience?.comparisonKey??'legacy'}`;}
/** Legacy adapters may return duplicate IDs without viewport/scenario metadata.
 * Keep every verdict, but do not pretend those ambiguous proofs are comparable. */
export function identifyChecks(checks:CortexVerification[],experience:VerificationExperience){
  const counts=new Map<string,number>();
  for(const check of checks){const id=checkKey(check);counts.set(id,(counts.get(id)??0)+1);}
  return checks.map((check,index)=>({...check,experience:check.experience??{...experience,comparisonKey:counts.get(checkKey(check))!>1?`${experience.comparisonKey}:ambiguous:${index}`:experience.comparisonKey},comparable:check.comparable??counts.get(checkKey(check))===1}));
}
