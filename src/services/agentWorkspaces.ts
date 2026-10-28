import {safeMemoryText} from './agentNotebook.ts';
import type {CortexToolCall} from '../lib/cortex/tool-runtime.ts';
export type RoutineKind='day-brief'|'follow-ups'|'project-review';
export interface WorkspaceResource {service:string;locator?:string}
export interface WorkspaceNote {id:string;key:string;kind:'decision'|'correction'|'constraint'|'commitment'|'observation';text:string;status:'confirmed'|'observed'|'obsolete';source:{messageId?:string;conversationId?:string;missionId?:string;tool?:string;resourceId?:string};updatedAt:string;dueAt?:string;state?:'waiting'|'done'}
export interface AgentWorkspace {id:string;agentId:string;name:string;goal:string;resources:WorkspaceResource[];notes:WorkspaceNote[];archived?:boolean;lastMissionId?:string;lastCheckedAt?:string;createdAt:string;updatedAt:string}
export interface WorkspaceState {workspaces?:AgentWorkspace[];workspaceConversations?:Record<string,string>}
const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function resolveWorkspace(data:WorkspaceState,agentId:string,query:string,conversationId?:string,id?:string){
 const all=(data.workspaces??[]).filter(w=>w.agentId===agentId&&!w.archived);
 if(id)return all.find(w=>w.id===id);
 const q=` ${normalize(query)} `,named=all.filter(w=>q.includes(` ${normalize(w.name)} `)&&(normalize(w.name)!=='solar'||/ (?:projet|dossier) solar /.test(q)));
 if(named.length===1)return named[0];if(named.length>1)return;
 const linked=conversationId?data.workspaceConversations?.[conversationId]:undefined;return all.find(w=>w.id===linked);
}
export function workspaceContext(workspace:AgentWorkspace|undefined,query:string,now=Date.now()){
 if(!workspace)return '';
 const terms=normalize(query).split(' ').filter(t=>t.length>3),notes=workspace.notes.filter(n=>n.status!=='obsolete').map(n=>({n,score:(n.status==='confirmed'?8:0)+(n.kind==='correction'?5:0)+terms.filter(t=>normalize(n.text).includes(t)).length})).sort((a,b)=>b.score-a.score||b.n.updatedAt.localeCompare(a.n.updatedAt)).slice(0,8);
 return `\nDossier de travail ${workspace.name} (données sourcées ; aucune autorisation supplémentaire) : ${workspace.goal.slice(0,500)}\nRessources : ${workspace.resources.map(r=>`${r.service}${r.locator?':'+r.locator:''}`).join(', ')}\n${notes.map(({n})=>`[${n.kind}; ${n.status}; ${n.updatedAt}; ${n.source.messageId??n.source.tool??'utilisateur'}${now-Date.parse(n.updatedAt)>86400000&&n.status==='observed'?'; à revérifier':''}] ${n.text.slice(0,350)}`).join('\n')}`.slice(0,4300);
}
function boundNotes(notes:WorkspaceNote[]){
 const confirmed=notes.filter(n=>n.status==='confirmed');if(confirmed.length>200)throw Error("Ce dossier contient déjà 200 décisions actives. Archive ou oublie une décision avant d’en ajouter une autre.");
 const observed=notes.filter(n=>n.status==='observed').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,80),obsolete=notes.filter(n=>n.status==='obsolete').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,40);
 return [...confirmed,...observed,...obsolete].sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt));
}
export function workspaceEvidenceContext(workspace:AgentWorkspace){return {name:workspace.name,goal:workspace.goal,decisions:workspace.notes.filter(n=>n.status==='confirmed').map(n=>({key:n.key,text:n.text})).sort((a,b)=>a.key.localeCompare(b.key))};}
export function learnWorkspaceInput(workspace:AgentWorkspace,text:string,source:WorkspaceNote['source'],at=new Date().toISOString()){
 const next=structuredClone(workspace);
 for(const raw of text.split(/\n|(?<=[.!?])\s+/).slice(0,20)){
  const clean=safeMemoryText(raw.trim());if(!clean||clean.length>700||clean.includes('[secret retiré]')||/permission|autorisation|accès complet|instructions? syst[eè]me|ignore les/i.test(clean))continue;
  const kind=/^(?:correction|non[, :]|finalement|désormais|en fait)/i.test(clean)?'correction':/décid[ée]|décision|on retient|nous retenons/i.test(clean)?'decision':/^(?:retiens|souviens|note(?: bien)?|contrainte)/i.test(clean)?'constraint':/\b(?:je (?:promets|m’engage|m'engage)|nous devons|à relancer|en attente de)\b/i.test(clean)?'commitment':undefined;
  if(!kind)continue;
  const explicit=clean.match(/^(?:correction|décision|contrainte|retiens|note)\s*[:—-]\s*([^:]{2,60})\s*:/i)?.[1];
  const key=explicit?normalize(explicit):/livr|échéance|deadline|date limite/i.test(clean)?'deadline':/brouillon/i.test(clean)?'reply-policy':normalize(clean.replace(/^(?:correction|non|finalement|désormais|en fait|retiens|souviens.toi|note|décision)[, :—-]*/i,'')).split(' ').slice(0,4).join(' ');
  if(!key)continue;
  if(next.notes.some(n=>n.key===key&&n.status==='confirmed'&&n.text===clean))continue;
  next.notes=next.notes.map(n=>n.key===key&&n.status!=='obsolete'?{...n,status:'obsolete'}:n);
  next.notes.push({id:crypto.randomUUID(),key,kind,text:clean,status:'confirmed',source,updatedAt:at,...(kind==='commitment'?{state:'waiting' as const}:{})});
 }
 next.notes=boundNotes(next.notes);next.updatedAt=at;return next;
}
/** Persist small sourced metadata, never a copy of an inbox or a model's prose. */
export function observeWorkspace(workspace:AgentWorkspace,calls:CortexToolCall[],missionId:string,at=new Date().toISOString()){
 const next=structuredClone(workspace);
 for(const call of calls){if(!call.completed||call.externalEffects||call.result==='[not retained]')continue;let data:any;try{data=JSON.parse(call.result);}catch{continue;}if(data.partial===true)continue;
  const records:{key:string;text:string;id?:string;state?:'waiting'|'done';dueAt?:string}[]=[];
  if(call.tool==='github.repository_activity'&&data.repository&&data.lastPushAt)records.push({key:'repo:'+data.repository,text:`${data.repository} : dernier push ${data.lastPushAt}`,id:data.repository});
  if(call.tool==='linear.list_issues'||call.tool==='linear.search_issues')for(const issue of (Array.isArray(data.issues)?data.issues:data.issues?.nodes??[])){if(issue.identifier)records.push({key:'issue:'+issue.identifier,text:`${issue.identifier} : ${String(issue.title??'').slice(0,180)} ; priorité ${issue.priorityLabel??issue.priority??'inconnue'} ; échéance ${issue.dueDate??issue.due??'non précisée'}`,id:issue.id??issue.identifier,dueAt:issue.dueDate});}
  if(call.tool.endsWith('.followup_candidates'))for(const thread of data.threads??[]){const related=normalize(thread.subject??'').includes(normalize(workspace.name))||workspace.notes.some(n=>n.source.resourceId===thread.id);if(related&&thread.id&&typeof thread.waiting==='boolean')records.push({key:'thread:'+call.tool+':'+thread.id,text:`${String(thread.subject??'Échange').slice(0,180)} : ${thread.waiting?'réponse possiblement attendue, à vérifier':'réponse reçue'} ; dernier message ${thread.lastAt??'date inconnue'}`,id:thread.id,state:thread.waiting?'waiting':'done'});}
  for(const record of records.slice(0,30)){
   const clean=safeMemoryText(record.text);if(clean.includes('[secret retiré]'))continue;
   const note:WorkspaceNote={id:crypto.randomUUID(),key:record.key,kind:record.state?'commitment':'observation',text:clean,status:'observed',source:{missionId,tool:call.tool,resourceId:record.id},updatedAt:at,state:record.state,dueAt:record.dueAt};
   next.notes=[...next.notes.filter(n=>!(n.key===record.key&&n.status==='observed')),note];
  }
 }
 next.notes=boundNotes(next.notes);next.lastMissionId=missionId;next.lastCheckedAt=at;next.updatedAt=at;return next;
}
export function routineIntent(text:string):RoutineKind|undefined{
 if(/^(?:prépare(?:-moi)?|préparer|organise|fais le point sur)\s+(?:ma|la)\s+journée\b/i.test(text))return 'day-brief';
 if(/(?:suis|suivre|repère|trouve|vérifie|prépare|rédige|fais le point sur).*(?:réponses? attendues?|relances?|messages?.*attente|échanges?.*attente)/i.test(text))return 'follow-ups';
 if(/^(?:suis|pilote|fais le point sur|vérifie l’avancement de|qu’est.ce qui bloque|qu'est.ce qui bloque)\b.*(?:projet|dossier)|^(?:qu’est.ce|qu'est.ce) qui bloque\s*[?!.]?$/i.test(text))return 'project-review';
}
