import { sourceHash } from './semantic.ts';
import type { CortexTask, CortexCandidate } from './types.ts';

export type ContextCategory = 'project' | 'observation' | 'history';
export interface ContextItem {
  id:string; category:ContextCategory; content:string; priority:number;
  reference:string; hash?:string; origin?:string; status?:string;
  required?:boolean;
  aliases?:{id:string;reference:string;origin?:string;status?:string}[];
}
export interface ContextPacket {
  version:1; objective:string; requirements:string; state:Record<string,unknown>;
  items:ContextItem[]; next:string;
}
export interface ContextSelection {
  selected:string[]; compacted:string[]; omitted:string[]; deduplicated:number;
  originalCharacters:number; serializedCharacters:number; utf8Bytes:number;
}
export interface ContextObservation {
  id:string; category:ContextCategory; content:string; hash:string; origin:string;
  status:string; step:number; sources:Record<string,string>;
}
export interface RecoverableContextReference { id:string; start:number; end:number; hash:string; status:string }
export function validateContextCheckpoint(task:CortexTask){
  if(task.userRequirements!==undefined&&typeof task.userRequirements!=='string')throw Error('CORTEX_CONTEXT: Contraintes du checkpoint invalides; état original conservé.');
  if(task.contextArchive!==undefined&&(!Array.isArray(task.contextArchive)||task.contextArchive.length>64||task.contextArchive.some(item=>!item||typeof item.id!=='string'||typeof item.content!=='string'||sourceHash(item.content)!==item.hash||!item.sources||typeof item.sources!=='object'||Object.values(item.sources).some(hash=>typeof hash!=='string'))||new Set(task.contextArchive.map(item=>item.id)).size!==task.contextArchive.length))throw Error('CORTEX_CONTEXT: Archives du checkpoint invalides; aucune observation reconstruite.');
  for(const read of task.contextRecoveries??[]){const item=task.contextArchive?.find(item=>item.id===read.id);if(!item||item.hash!==read.hash||!Number.isInteger(read.start)||!Number.isInteger(read.end)||read.start<0||read.end<=read.start||read.end>item.content.length||read.end-read.start>6000)throw Error('CORTEX_CONTEXT: Une donnée requise pour la reprise n’est plus récupérable.');}
}

/** A projection of task-owned originals, never a generated recollection.
 * User obligations and the next action are not candidates for eviction. */
export function fitContextPacket(packet:ContextPacket,maximum:number,measure=(s:string)=>s.length){
  const seen=new Map<string,ContextItem>(),items:ContextItem[]=[];
  for(const item of packet.items){
    const key=JSON.stringify([item.category,item.content,item.hash]);
    const previous=seen.get(key);
    if(previous){previous.required ||= item.required;previous.priority=Math.max(previous.priority,item.priority);previous.aliases=[...(previous.aliases??[]),{id:item.id,reference:item.reference,origin:item.origin,status:item.status}];continue;}
    const copy={...item};seen.set(key,copy);items.push(copy);
  }
  // The task state is evidence and navigation metadata, not a user
  // obligation. Keeping every successful check and archive pointer verbatim
  // can consume a small model's whole window after visual verification. Keep
  // the complete state when it fits, then retain a compact or minimal,
  // recoverable representation. Objective, requirements and next action are
  // deliberately never candidates for compaction.
  const compactState=(mode:'full'|'compact'|'minimal')=>{
    if(mode==='full')return packet.state;
    const state=packet.state as Record<string,unknown>;
    const counts=state.checkCounts;
    const changes=Array.isArray(state.changes)?state.changes.slice(-4):undefined;
    const unresolved=Array.isArray(state.unresolved)?state.unresolved.slice(0,4).map(value=>{
      const item=value as Record<string,unknown>;
      return {id:item.id,hash:item.hash,characters:item.characters};
    }):undefined;
    const recoverable=Array.isArray(state.recoverableContext)?state.recoverableContext.slice(0,4):undefined;
    const checks=Array.isArray(state.checks)
      ? state.checks.filter(value=>(value as Record<string,unknown>).status!=='passed').slice(0,3).map(value=>{
        const check=value as Record<string,unknown>;
        return {id:check.id,type:check.type,status:check.status,origin:check.origin,hard:check.hard};
      }) : undefined;
    const base={phase:state.phase,step:state.step,changes,checkCounts:counts,recoverableContext:recoverable,unresolved};
    return mode==='minimal'?base:{...base,activeNode:state.activeNode,verifiedNodes:state.verifiedNodes,checks,repair:state.repair};
  };
  let stateMode:'full'|'compact'|'minimal'='full';
  const base={version:packet.version,objective:packet.objective,requirements:packet.requirements,next:packet.next};
  const modes=new Map(items.map(item=>[item.id,'full' as 'full'|'reference'|'omitted']));
  const render=()=>[
    'OBJECTIF ET CONTRAINTES UTILISATEUR\n'+JSON.stringify({objective:base.objective,requirements:base.requirements}),
    'ÉTAT ACTUEL (les hypothèses et suggestions ne sont pas des preuves)\n'+JSON.stringify(compactState(stateMode)),
    ...items.filter(item=>modes.get(item.id)!=='omitted').map(item=>{
      const metadata={id:item.id,category:item.category,reference:item.reference,hash:item.hash,origin:item.origin,status:item.status,aliases:item.aliases};
      return modes.get(item.id)==='full'?JSON.stringify({...metadata,content:item.content}):JSON.stringify({...metadata,compacted:true,recover:'readContext(id) pour une observation; readFileRange/readSymbol pour une source. Ne pas reconstruire le contenu omis.'});
    }),
    'PROCHAINE ACTION\n'+base.next,
  ].join('\n\n');
  const original=render();let prompt=original;
  // Lowest utility first; originals remain in the task checkpoint or project.
  const optional=items.filter(item=>!item.required).sort((a,b)=>a.priority-b.priority);
  for(const item of optional){if(measure(prompt)<=maximum)break;modes.set(item.id,'reference');prompt=render();}
  for(const item of optional){if(measure(prompt)<=maximum)break;modes.set(item.id,'omitted');prompt=render();}
  for(const mode of ['compact','minimal'] as const){
    if(measure(prompt)<=maximum)break;
    stateMode=mode;prompt=render();
  }
  if(measure(prompt)>maximum)throw Error('CORTEX_CONTEXT: Objectif, contraintes obligatoires et données requises dépassent la fenêtre après déduplication et récupération structurée. Aucune obligation supprimée.');
  const ids=(mode:string)=>items.filter(item=>modes.get(item.id)===mode).flatMap(item=>[item.id,...(item.aliases??[]).map(alias=>alias.id)]);
  const selection:ContextSelection={selected:ids('full'),compacted:[...ids('reference'),...(stateMode==='full'?[]:[`state:${stateMode}`])],omitted:ids('omitted'),deduplicated:packet.items.length-items.length,originalCharacters:original.length,serializedCharacters:measure(prompt),utf8Bytes:new TextEncoder().encode(prompt).length};
  return {prompt,selection};
}

/** Diagnostic retention is bounded independently of the task's lifetime.
 * Eviction removes the original, never silently substitutes an approximation. */
export function rememberContext(task:CortexTask,input:Omit<ContextObservation,'id'|'hash'|'step'>){
  task.contextArchive??=[];
  const hash=sourceHash(input.content);
  const duplicate=task.contextArchive.find(item=>item.content===input.content&&item.origin===input.origin&&item.status===input.status&&JSON.stringify(item.sources)===JSON.stringify(input.sources));
  if(duplicate)return duplicate;
  const item:ContextObservation={...input,id:`ctx-${task.contextSequence=(task.contextSequence??0)+1}-${hash}`,hash,step:task.steps};
  task.contextArchive.push(item);
  while(task.contextArchive.length>64||task.contextArchive.reduce((size,entry)=>size+entry.content.length,0)>200_000){
    // Keep the newest observation even when it alone is large. No task cap.
    if(task.contextArchive.length<=1)break;
    const pinned=new Set((task.contextRecoveries??[]).map(read=>read.id));
    const index=task.contextArchive.findIndex(entry=>entry.id!==item.id&&!pinned.has(entry.id));
    if(index<0)throw Error('CORTEX_CONTEXT: Archives nécessaires à une récupération trop volumineuses. Originaux conservés; réduis la plage requise.');
    task.contextArchive.splice(index,1);
  }
  return item;
}

export function recoverContext(task:CortexTask,id:string,start=0,end?:number,currentSources:Record<string,string>={}){
  const original=task.contextArchive?.find(item=>item.id===id);
  if(!original)throw Error(`CORTEX_CONTEXT: Observation absente ou introuvable (${id}). Utilise uniquement un identifiant récupérable annoncé dans le contexte courant.`);
  if(sourceHash(original.content)!==original.hash)throw Error(`CORTEX_CONTEXT: Observation altérée (${id}). Reprise suspendue plutôt que reconstruction approximative.`);
  const stop=end??Math.min(original.content.length,start+4000);
  if(!Number.isInteger(start)||!Number.isInteger(stop)||start<0||stop<=start||stop-start>6000||stop>original.content.length)throw Error('Plage de récupération invalide : indices caractères 0-based, 6000 caractères maximum.');
  const stale=Object.entries(original.sources).some(([path,hash])=>currentSources[path]!==hash);
  const read={id,start,end:stop,hash:original.hash,stale};
  if(task.contextRecoveries?.some(previous=>JSON.stringify(previous)===JSON.stringify(read)))throw Error('Récupération identique déjà fournie : utilise cet original ou demande une autre plage.');
  task.contextRecoveries=[...(task.contextRecoveries??[]),read].slice(-4);
  return {...read,content:original.content.slice(start,stop),origin:original.origin,status:stale?'historical-source-changed':original.status};
}

export function taskContextPacket(task:CortexTask,candidate:CortexCandidate,input:{requirements:string;guidance:string;memory:string;next:string;extra?:string}):ContextPacket{
  const sources=Object.fromEntries((task.context?.files??[]).flatMap(file=>file.sourceHash?[[file.path,file.sourceHash]]:[]));
  for(const change of candidate.changes)sources[change.path]=sourceHash(change.after);
  const checks=candidate.checks.map(check=>{
    const item=rememberContext(task,{category:'observation',content:check.output,origin:check.origin??'deterministic',status:check.status,sources});
    return {id:item.id,type:check.type,status:check.status,origin:item.origin,hard:check.hardConstraint!==false,experience:check.experience?.id};
  });
  const observations=[...new Set([task.repairBrief,...candidate.issues].filter((text):text is string=>Boolean(text)))].map(content=>rememberContext(task,{category:'observation',content,origin:'runtime-diagnostic',status:'unresolved',sources}));
  const items:ContextItem[]=[
    ...(input.guidance?[{id:'guidance',category:'history' as const,content:input.guidance,priority:100,reference:'request.guidance',origin:'instruction-pack',required:true}]:[]),
    ...(input.extra?[{id:'operation',category:'observation' as const,content:input.extra,priority:100,reference:'current-operation',required:true}]:[]),
    ...(task.context?.files??[]).map(file=>({id:`source:${file.path}:${sourceHash(file.content)}`,category:'project' as const,content:file.content,priority:60+Math.min(30,file.score/10),reference:file.path,hash:file.sourceHash,origin:'project-source'})),
    ...(task.context?.architectureSummary?[{id:'repo-map',category:'project' as const,content:task.context.architectureSummary,priority:30,reference:'project-index',origin:'deterministic'}]:[]),
    ...observations.map((item,index)=>({id:item.id,category:item.category,content:index===0&&item.content.length>600?item.content.slice(0,500)+`\n[Extrait exact; suite récupérable avec readContext id=${JSON.stringify(item.id)}, start=0, end=${Math.min(item.content.length,6000)}.]`:item.content,priority:index===0?95:40,required:index===0,reference:`observation:${item.id}`,hash:item.hash,origin:item.origin,status:item.status})),
    ...(input.memory?[{id:'historical-memory',category:'history' as const,content:input.memory,priority:10,reference:'versioned-memory',origin:'historical-advice'}]:[]),
  ];
  const recoveries=task.contextRecoveries??[];
  for(const [index,read] of recoveries.entries()){
    const original=task.contextArchive?.find(item=>item.id===read.id);
    if(!original||sourceHash(original.content)!==read.hash)throw Error('CORTEX_CONTEXT: Original d’une récupération requis absent du checkpoint.');
    const stale=Object.entries(original.sources).some(([path,hash])=>sources[path]!==hash);
    items.push({id:`recovered:${read.id}:${read.start}`,category:'observation',content:original.content.slice(read.start,read.end),reference:read.id,hash:read.hash,origin:original.origin,status:stale||read.stale?'historical-source-changed':original.status,priority:index===recoveries.length-1?100:45,required:index===recoveries.length-1});
  }
  const active=task.taskGraph?.nodes.find(node=>node.status!=='verified'&&node.dependsOn.every(id=>task.taskGraph?.nodes.find(parent=>parent.id===id)?.status==='verified'));
  const recoverableContext:RecoverableContextReference[]=observations.flatMap(item=>{
    // Short observations are already present verbatim. Advertising
    // readContext for them invites a redundant or fabricated reference.
    if(item.content.length<=600)return [];
    const archived=task.contextArchive?.find(entry=>entry.id===item.id);
    if(!archived||sourceHash(archived.content)!==archived.hash)return [];
    const fullyRecovered=task.contextRecoveries?.some(read=>read.id===item.id&&read.start===0&&read.end===archived.content.length&&!read.stale);
    return fullyRecovered?[]:[{id:item.id,start:0,end:Math.min(archived.content.length,6000),hash:archived.hash,status:archived.status}];
  });
  return {version:1,objective:task.prompt,requirements:input.requirements,state:{phase:task.phase,step:task.steps,plan:task.taskGraph?undefined:task.plan,activeNode:active?{id:active.id,objective:active.objective,files:active.files,criteria:active.criteria}:undefined,verifiedNodes:task.taskGraph?.nodes.filter(node=>node.status==='verified').map(node=>node.id),changes:candidate.changes.map(change=>({path:change.path,hash:sourceHash(change.after)})),checks:checks.filter(check=>check.status!=='passed').concat(checks.filter(check=>check.status==='passed')).slice(0,12),checkCounts:{passed:checks.filter(check=>check.status==='passed').length,failed:checks.filter(check=>check.status==='failed').length,unavailable:checks.filter(check=>check.status==='unavailable').length},unresolved:observations.map(item=>({id:item.id,hash:item.hash,characters:item.content.length})),recoverableContext,repair:task.repairMemory?{strategy:task.repairMemory.strategy,focusFiles:task.repairMemory.focusFiles,attempts:task.repairMemory.attempts.slice(-3).map(attempt=>({step:attempt.step,actions:attempt.actions,files:attempt.files,progress:attempt.progress}))}:undefined},items,next:input.next};
}
