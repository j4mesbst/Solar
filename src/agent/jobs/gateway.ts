import {jobs} from './store';
import {fenced,transition,decideJobApproval} from './lifecycle';
import {JobBlocked,type DurableToolGate,type JobStep} from './types';
import type {ToolApproval,ToolDefinition} from '../../services/toolRegistry';
import {validateToolParameters} from '../../services/toolSchema';
export function canonical(value:unknown):string{if(value===undefined)return 'null';if(!value||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';}
export async function fingerprint(value:unknown){const bytes=new TextEncoder().encode(canonical(value));const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
function hasCredentials(value:unknown):boolean{if(Array.isArray(value))return value.some(hasCredentials);return !!value&&typeof value==='object'&&Object.entries(value).some(([k,v])=>/^(?:access_?token|refresh_?token|api_?key|authorization|password|secret|cookie)$/i.test(k)||hasCredentials(v));}
const mutating=(tool:ToolDefinition)=>tool.externalEffects===true||tool.risk!==undefined&&tool.risk!=='read'||tool.permissions.some(p=>/\.write$|execution/.test(p));
function retained(value:unknown):unknown{if(Array.isArray(value))return value.map(retained);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!/^(?:access_?token|refresh_?token|api_?key|authorization|password|secret|cookie)$/i.test(k)).map(([k,v])=>[k,retained(v)]));return value;}
export function jobGateway(id:string,token:string,ask?:(request:ToolApproval,signal:AbortSignal)=>Promise<boolean>):DurableToolGate {
 const change=(fn:Parameters<typeof jobs.update>[1],type:string,cause:string)=>jobs.update(id,job=>fn(fenced(job,token)),{type,cause});
 const approve=async(request:ToolApproval,signal:AbortSignal)=>{
  signal.throwIfAborted();if(hasCredentials(request.input))throw new JobBlocked("secret-input","Les identifiants doivent rester dans le coffre, hors des arguments d’outil.");const key=await fingerprint(request);let job=await jobs.get(id);fenced(job,token);
  let a=job!.approvals.find(a=>a.fingerprint===key);
  if(a?.state==='denied')throw new JobBlocked('approval-denied','L’action a été refusée.');
  if(a?.state==='approved'&&a.expiresAt>Date.now())return true;
  if(!a||a.expiresAt<=Date.now()){
   const item={id:crypto.randomUUID(),fingerprint:key,request:structuredClone(request),state:'pending' as const,expiresAt:Date.now()+15*60000};
   job=await change(j=>{j!.approvals=j!.approvals.filter(a=>a.fingerprint!==key);j!.approvals.push(item);transition(j!,'waiting_approval');return j!;},'approval-request','Validation exacte nécessaire avant l’action.');a=job.approvals.find(a=>a.id===item.id)!;
  }else await change(j=>transition(j!,'waiting_approval'),'approval-wait','Validation conservée, reprise de la demande.');
  if(!ask)throw new JobBlocked('waiting-approval','Cette action attend ta validation.');
  const allowed=await ask(request,signal);signal.throwIfAborted();await decideJobApproval(id,a.id,allowed);
  if(!allowed)throw new JobBlocked('approval-denied','L’action a été refusée.');
  await change(j=>transition(j!,'running'),'approval-applied','Validation appliquée à cette action exacte.');return true;
 };
 return {approve,async execute(tool,input,identity,signal,operation){
  signal.throwIfAborted();if(hasCredentials(input))throw new JobBlocked("secret-input","Identifiant secret interdit dans les arguments de tâche.");const job=fenced(await jobs.get(id),token),isWrite=mutating(tool);
  if(!tool.permissions.length)throw new JobBlocked('permission','Outil sans capacité déclarée.');
  if(job.constraints.services&&!job.constraints.services.includes(tool.pluginId??'project'))throw new JobBlocked('scope','Outil hors du périmètre de la tâche.');
  if(isWrite&&job.constraints.readOnly)throw new JobBlocked('read-only','Écriture interdite dans cette tâche.');
  if(validateToolParameters(input,tool.parameters).length)throw new JobBlocked('invalid-arguments','Paramètres invalides.');
  const key=await fingerprint({tool:tool.name,input,identity,schema:tool.parameters,permissions:tool.permissions,owner:job.ownerId}),previous=job.checkpoint.steps.find(s=>s.key===key);
  if(previous?.state==='confirmed')return structuredClone(previous.result);
  if(previous?.mutating){
   if(!tool.reconcile)throw new JobBlocked('reconciliation-required','Cette action a pu réussir avant l’interruption. Vérifie son état externe avant toute reprise.');
   const recovered=await tool.reconcile(input,`${id}:${key}`,signal);signal.throwIfAborted();
   if(!recovered?.confirmed)throw new JobBlocked('reconciliation-required','L’état externe de l’action reste incertain ; aucun renvoi effectué.');
   if(tool.outputSchema&&validateToolParameters(recovered.result,tool.outputSchema).length)throw new JobBlocked('invalid-result','Résultat de réconciliation invalide.');
   await tool.verify?.(input,recovered.result,signal);
   await change(j=>{const s=j!.checkpoint.steps.find(s=>s.key===key)!;s.state='confirmed';s.result=retained(recovered.result);s.verified=!!tool.verify;return j!;},'reconciled','Effet retrouvé dans l’état externe, sans le rejouer.');return recovered.result;
  }
  if(isWrite)await approve({tool:tool.name,plugin:tool.pluginId??'project',account:identity,description:tool.description,input:structuredClone(input),risk:tool.risk??'write'},signal);
  await change(j=>{if(j!.usage.toolCalls>=j!.budgets.maxToolCalls)throw new JobBlocked('tool-budget','Budget d’outils du cycle atteint.');transition(j!,'running');j!.usage.toolCalls++;const step:JobStep={key,tool:tool.name,identity,mutating:isWrite,state:'intent',verified:false,attempts:(previous?.attempts??0)+1,at:new Date().toISOString()};if(step.attempts>2)throw new JobBlocked('stagnation','Cet outil échoue sans progrès.');j!.checkpoint.steps=j!.checkpoint.steps.filter(s=>s.key!==key).concat(step);return j!;},'tool-intent',`${tool.name} : intention enregistrée avant exécution.`);
  try{
   const result=await operation();signal.throwIfAborted();const saved=retained(result);if(canonical(saved).length>1_000_000)throw new JobBlocked('observation-size','Observation trop volumineuse pour le checkpoint.');
   await change(j=>{const s=j!.checkpoint.steps.find(s=>s.key===key)!;s.state='confirmed';s.result=saved;s.verified=!isWrite||!!tool.verify;j!.checkpoint.evidence.push({kind:'tool-result',reference:key,verified:s.verified,at:new Date().toISOString()});return j!;},'tool-confirmed',`${tool.name} : résultat reçu et contrat contrôlé.`);return result;
  }catch(error){
   // Once an effect started, errors/timeouts do not prove it failed externally.
   await change(j=>{const s=j!.checkpoint.steps.find(s=>s.key===key);if(s)s.state='uncertain';return j!;},'tool-interrupted',`${tool.name} : achèvement non confirmé.`).catch(()=>{});throw error;
  }
 }};
}
