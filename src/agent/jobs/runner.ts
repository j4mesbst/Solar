import {currentAccountScope} from '../../services/accountScope';
import {toolApprovals} from '../../services/toolApprovals';
import type {runAgentMissionCore} from '../../services/solarAgentRuntime';
import type {AgentMission} from '../../services/solarAgentStore';
import {jobs} from './store';
import {checkPredicates} from './verification';
import {jobGateway,fingerprint} from './gateway';
import {fenced,terminal,transition} from './lifecycle';
import {JobBlocked,type AgentJob, type JobState} from './types';
type Input=Parameters<typeof runAgentMissionCore>[0];
const time=()=>new Date().toISOString();
const profileKey=(input:Input)=>fingerprint({provider:input.agent.providerId,model:input.agent.modelId,instructions:input.agent.instructions,grants:input.agent.grants,mode:input.agent.accessMode,services:input.serviceScope,readOnly:input.readOnlyTools,budget:input.jobBudget??{maxCycles:20,maxToolCalls:100},criteria:input.successCriteria??[]});
const missionStatus=(state:JobState):AgentMission['status']=>state==='completed'?'completed':state==='cancelled'?'cancelled':state==='waiting_approval'?'permission':state==='failed'?'failed':state==='paused'?'paused':'partial';
/** Existing Cortex remains the planner/executor. This adapter owns only durability. */
export async function runDurableMission(original:Input,core:(input:Input)=>Promise<AgentMission>):Promise<AgentMission>{
 const owner=currentAccountScope(),signature=await profileKey(original);
 if(original.jobBudget&&Object.values(original.jobBudget).some(v=>!Number.isSafeInteger(v)||v<1||v>10000))throw Error('Budget de tâche invalide.');
 let id=original.durableJobId??original.mission.id;
 if(!original.durableJobId&&/^(?:reprends|continue|reprendre)\b/i.test(original.mission.goal)){
  const recent=(await jobs.list()).filter(j=>j.agentId===original.agent.id&&['paused','blocked','waiting_approval','failed'].includes(j.state)&&j.profileFingerprint===signature).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];if(recent)id=recent.id;
 }
 const at=time();let job=await jobs.update(id,existing=>{
  if(existing){if(existing.runtime!=="local")throw new JobBlocked("runtime-unavailable","Worker cloud non configuré ; cette tâche ne peut pas être transférée silencieusement sur ce Mac.");if(existing.agentId!==original.agent.id||existing.profileFingerprint!==signature)throw new JobBlocked('profile-changed','Le rôle, le modèle ou les droits ont changé : crée une nouvelle tâche.');return existing;}
  const required=original.serviceScope?.length||/\b(?:gmail|github|agenda|drive|fichier|dossier|slack|linear|notion)\b/i.test(original.mission.goal)||original.mission.kind;
  return {version:1,id,ownerId:owner,agentId:original.agent.id,conversationId:original.conversationId,goal:original.mission.goal,state:'queued',runtime:'local',criteria:structuredClone(original.successCriteria??[]),profile:structuredClone(original.agent),profileFingerprint:signature,constraints:{readOnly:!!original.readOnlyTools||original.agent.accessMode==='read-only',services:original.serviceScope},acceptance:required?'verified-tools':'answer',revision:0,events:[],checkpoint:{revision:0,mission:structuredClone(original.mission),steps:[],evidence:[]},approvals:[],budgets:{maxCycles:original.jobBudget?.maxCycles??20,maxToolCalls:original.jobBudget?.maxToolCalls??100},usage:{cycles:0,toolCalls:0,computeMs:0,modelCalls:0,inputTokens:0,outputTokens:0},errors:[],createdAt:at,updatedAt:at};
 },{type:'intake',cause:'Objectif et politique du modèle enregistrés.'});
 if(terminal(job.state))return {...job.checkpoint.mission,status:missionStatus(job.state)};
 const token=crypto.randomUUID(),start=Date.now();let cycleUsage:AgentMission["usage"];
 job=await jobs.update(id,j=>{
  if(!j)throw Error('Tâche introuvable.');if(j.lease&&j.lease.expiresAt>Date.now())throw new JobBlocked('already-running','Cette tâche est déjà en cours.');
  if(j.control==='cancel')throw new JobBlocked('cancelled','Tâche annulée.');
  if(j.usage.cycles>=j.budgets.maxCycles)throw new JobBlocked('cycle-budget','Budget de reprise atteint ; réévalue le périmètre de la tâche.');
  delete j.control;j.lease={token,expiresAt:Date.now()+45000,heartbeatAt:Date.now()};j.usage.cycles++;
  // An expired worker is recovered, not silently considered successful.
  if(['running','planning','verifying','waiting_approval'].includes(j.state))transition(j,'paused');transition(j,'planning');return j;
 },{type:'lease-acquired',cause:'Cycle local réclamé avec un nouveau jeton de bail.'});
 const controller=new AbortController(),signal=AbortSignal.any([original.signal,controller.signal]);let polling=false;
 const heartbeat=setInterval(()=>{if(polling)return;polling=true;void jobs.update(id,j=>{const x=fenced(j,token);x.lease={token,expiresAt:Date.now()+45000,heartbeatAt:Date.now()};return x;},{type:'heartbeat',cause:'Exécuteur local actif.'}).catch(e=>controller.abort(e)).finally(()=>{polling=false;});},10000);
 const update=(fn:(j:AgentJob)=>AgentJob,type:string,cause:string)=>jobs.update(id,j=>fn(fenced(j,token)),{type,cause});
 try{
  const gate=jobGateway(id,token,original.background?undefined:toolApprovals.request);
  const resumed=structuredClone(job.checkpoint.mission);resumed.id=id;resumed.goal=job.goal;resumed.status='queued';delete resumed.error;delete resumed.usage;if(resumed.checkpoint?.cortex)resumed.checkpoint.cortex={...resumed.checkpoint.cortex,inputTokens:0,outputTokens:0,generations:0};
  // Full observations live in the durable store, never stuffed into the system prompt.
  const result=await core({...original,mission:resumed,signal,durable:gate,onUpdate:async mission=>{
   const telemetry=mission.checkpoint?.cortex;cycleUsage=mission.usage??(telemetry?{modelCalls:telemetry.generations,inputTokens:telemetry.inputTokens,outputTokens:telemetry.outputTokens}:undefined);await update(j=>{j.checkpoint.mission=structuredClone(mission);return j;},'checkpoint','État réel de Cortex enregistré.');await original.onUpdate?.(mission);
  }});
  cycleUsage=result.usage;signal.throwIfAborted();await update(j=>{j.checkpoint.mission=structuredClone(result);if(j.state==='waiting_approval')return j;transition(j,'verifying');return j;},'verification','Vérification des preuves de la mission.');
  job=await update(j=>{
   let next:JobState=result.status==='completed'?'completed':result.status==='permission'?'waiting_approval':result.status==='waiting'?'blocked':result.status==='paused'?'paused':result.status==='failed'?'failed':'blocked';
   if(next==='completed'&&j.acceptance==='verified-tools'&&!(result.verification?.checked||result.sources?.length||j.checkpoint.evidence.some(e=>e.verified))){next='blocked';result.status='partial';result.error='Aucune preuve indépendante ne confirme encore cette tâche.';}
   const failed=checkPredicates(j).filter(p=>!p.passed);if(next==='completed'&&failed.length){next='blocked';result.status='partial';result.error=`Critères non confirmés : ${failed.map(p=>p.id).join(', ')}.`;}
   if(next==='completed'&&j.checkpoint.steps.some(s=>s.mutating&&(s.state!=='confirmed'||!s.verified))){next='blocked';result.status='partial';result.error='Une action externe reste à vérifier avant de conclure.';}
   // Permission/error is an interruption, never a successful finish signal.
   transition(j,next);j.checkpoint.mission=structuredClone(result);return j;
  },'cycle-finished','Conclusion calculée depuis l’état et les preuves, pas le seul texte du modèle.');
  return {...result,status:job.state==='completed'?result.status:result.status==='completed'?'partial':result.status};
 }catch(error){
  const e=error instanceof Error?error:Error('Exécution interrompue.');const latest=await jobs.get(id);
  if(latest?.lease?.token!==token)throw error;
  job=await jobs.update(id,j=>{if(!j||j.lease?.token!==token)throw error;const waiting=e instanceof JobBlocked&&e.code==='waiting-approval';const state:JobState=j.control==='cancel'?'cancelled':j.control==='pause'||signal.aborted?'paused':waiting?'waiting_approval':'blocked';if(!terminal(j.state))transition(j,state);j.errors.push({code:e instanceof JobBlocked?e.code:'execution',message:e.message.slice(0,1000),at:time()});j.checkpoint.mission={...j.checkpoint.mission,status:missionStatus(j.state),error:e.message};return j;},{type:'interrupted',cause:e instanceof JobBlocked?e.code:'Exécution interrompue sans succès confirmé.'});return job.checkpoint.mission;
 }finally{
  clearInterval(heartbeat);await jobs.update(id,j=>{if(!j)throw Error('Tâche absente.');if(j.lease?.token===token){delete j.lease;j.usage.computeMs+=Date.now()-start;j.usage.modelCalls+=(cycleUsage?.modelCalls??0);j.usage.inputTokens+=(cycleUsage?.inputTokens??0);j.usage.outputTokens+=(cycleUsage?.outputTokens??0);}return j;},{type:'lease-released',cause:'Fin du cycle local ; checkpoint conservé.'}).catch(()=>{});
 }
}
