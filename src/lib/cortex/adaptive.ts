import type { CortexMode, CortexModelResponse } from "./types.ts";
import { sourceHash } from "./semantic.ts";

export interface ModelFacts {
  endpoint:string; modelId:string; identity?:string;
  contextWindow?:number; declaredContext?:number; tools?:boolean; vision?:boolean;
}
export type ModelErrorKind='parsing'|'transport'|'tool'|'source-conflict'|'semantic'|'code'|'context';
export interface ModelExperience {
  signalVersion?:2;
  errors?:Partial<Record<ModelErrorKind,number>>;
  key:string; modelId:string; calls:number; validResponses:number; rejectedEdits:number;
  truncations:number; toolFallbacks:number; visionSuccesses:number; visionFailures:number;
  outputTokens:number; inferenceMs:number; successfulEdits:number; updatedAt:string;
  lastVisionFailureAt?:string;
}
export function modelExperienceKey(facts:ModelFacts){
  return sourceHash(JSON.stringify([facts.endpoint.replace(/\/+$/,""),facts.modelId,facts.identity??"unknown",facts.contextWindow??8192,facts.tools??null,facts.vision??null]));
}
export function newModelExperience(facts:ModelFacts):ModelExperience{
  return {signalVersion:2,errors:{},key:modelExperienceKey(facts),modelId:facts.modelId,calls:0,validResponses:0,rejectedEdits:0,truncations:0,toolFallbacks:0,visionSuccesses:0,visionFailures:0,outputTokens:0,inferenceMs:0,successfulEdits:0,updatedAt:new Date().toISOString()};
}
export function observeResponse(profile:ModelExperience,response:CortexModelResponse){
  profile.calls++;profile.truncations+=Number(response.stopReason==="length");
  profile.toolFallbacks+=response.toolFallbacks??0;
  profile.outputTokens+=response.metrics?.tokens??response.tokens??0;
  profile.inferenceMs+=response.metrics?.totalMs??0;profile.updatedAt=new Date().toISOString();
}
export function adaptivePolicy(profile:ModelExperience,mode:CortexMode,availableMemory?:number){
  // Legacy rejectedEdits mixed parsing, transport and edits. Do not reuse it
  // as evidence of editing quality after migration.
  const semantic=profile.signalVersion===2?profile.errors?.semantic??0:0;
  const sampled=profile.successfulEdits+semantic;
  const fragile=semantic>=2&&semantic/Math.max(1,sampled)>.25;
  const lowMemory=availableMemory!==undefined&&availableMemory<5*2**30;
  return {
    maxActions:2,
    preferJson:profile.toolFallbacks>0,
    useVision:profile.visionFailures<2||Date.now()-Date.parse(profile.lastVisionFailureAt??profile.updatedAt)>300_000,
    maxFiles:lowMemory?3:fragile?4:mode==="fast"?4:7,
    guidance:fragile?"Les dernières propositions ont échoué : un lot cohérent de deux actions maximum, source et empreinte courantes. Préfère une plage ou un symbole éditable pour réparer un conflit.":"Produis un lot cohérent de deux actions maximum; évite les lectures ou générations redondantes.",
  };
}
export function recordModelError(profile:ModelExperience,kind:ModelErrorKind){
  profile.signalVersion=2;profile.errors??={};profile.errors[kind]=(profile.errors[kind]??0)+1;
  if(kind==='semantic'||kind==='source-conflict')profile.rejectedEdits++;
}
