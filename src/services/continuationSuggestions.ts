import {localRoleIdeas} from './agentPresentation';
import {pluginCatalog,type DirectPluginId} from './pluginCatalog';
import type {AgentData,AgentMission,SolarAgent,TeamProfile} from './solarAgentStore';
import {currentAccountScope,scopedKey} from './accountScope';
import {dayKey} from './usage';
import {isSocialGreeting} from './conversationIntent';
import {safeMemoryText,dueRoutine} from './agentNotebook';

export interface ContinuationSuggestion {id:string;text:string;service?:DirectPluginId;reason:string;missionIds:string[];kind:'resume'|'habit'|'document'|'repository'|'mail'|'refresh'|'resource'|'role'}
const DAY=86400000;
const directServices=pluginCatalog.filter(p=>p.connection==='direct');
const serviceAliases=directServices.flatMap(p=>p.aliases.map(alias=>({id:p.id as DirectPluginId,alias:alias.toLocaleLowerCase()}))).sort((a,b)=>b.alias.length-a.alias.length);
const clean=(text:string)=>text.replace(/\s+/g,' ').trim();
const forbidden=/(?:sk-[\w-]{16,}|GOCSPX-|BEGIN.*PRIVATE KEY|(?:api.?key|mot de passe|password|secret|token)\s*[:=]|ignore.{0,30}(?:instructions|système)|(?:envoie|envoyer|publie|publier|supprime|supprimer|efface|achète|acheter|déploie|deploy|delete|send|publish|crée|créer|create|modifie|modifier|renomme|archive|désabonne|désinscri))/i;
function safeGoal(mission:AgentMission){const value=clean(mission.requestText??mission.goal);return value.length>=12&&value.length<=400&&!forbidden.test(value)&&safeMemoryText(value)===value&&!/^\//.test(value)&&!/[\u0000-\u001f<>]/.test(value)?value:undefined;}
function serviceOf(mission:AgentMission,goal:string){
 const lower=goal.toLocaleLowerCase(),explicit=serviceAliases.find(item=>lower.includes(item.alias));
 if(explicit)return explicit.id as DirectPluginId;
 const ids=[...new Set((mission.checkpoint?.calls??[]).filter(c=>c.completed).map(c=>c.tool.split('.')[0]))];
 return ids.length===1&&directServices.some(p=>p.id===ids[0])?ids[0] as DirectPluginId:undefined;
}
function hash(text:string){let value=2166136261;for(const char of text)value=Math.imul(value^char.charCodeAt(0),16777619);return (value>>>0).toString(36);}
function titleFrom(goal:string){
 const quoted=goal.match(/[«“"]([^»”"\n]{2,90})[»”"]/u)?.[1];
 const plain=goal.match(/(?:fichier|document|tableau|feuille)\s+(?:nommé\s+|intitulé\s+)?(.{2,90}?)(?=\s+(?:et|pour|stp|s’il|s'il)\b|[?!]|$)/iu)?.[1];
 const title=clean(quoted??plain??'').replace(/[.!]+$/,'');return title.length>=2&&title.length<=80&&!forbidden.test(title)&&!/^\b(?:que|qui|joint|présent|récent|récemment|important|utile|mes|mon|dans)\b/i.test(title)&&!/[<>{}@]/.test(title)?title:undefined;
}
const dismissKey=()=>scopedKey('solar.continuations.dismissed.v1');
export function dismissedContinuations(now=Date.now()):Set<string>{try{const values=JSON.parse(localStorage.getItem(dismissKey())??'[]');return new Set(Array.isArray(values)?values.filter(v=>typeof v.id==='string'&&Number.isFinite(v.at)&&v.at<=now+60000&&now-v.at<30*DAY).map(v=>v.id):[]);}catch{return new Set();}}
export function dismissContinuation(id:string){try{const previous=JSON.parse(localStorage.getItem(dismissKey())??'[]');const ids=(Array.isArray(previous)?previous:[]).filter(v=>typeof v.id==='string'&&v.id!==id&&Number.isFinite(v.at)&&v.at<=Date.now()&&Date.now()-v.at<30*DAY).slice(-199);ids.push({id,at:Date.now()});localStorage.setItem(dismissKey(),JSON.stringify(ids));}catch{/* An unavailable preference store cannot block the actual task. */}window.dispatchEvent(new Event('solar-continuations-changed'));}

/** Bounded local preparation for every agent. No model, network, or tool call.
 * Only human requests and executed receipts supply topics; assistant prose is
 * deliberately excluded. If evidence is weak, silence beats a generic guess. */
export function chooseContinuation(data:AgentData,profile:TeamProfile,agent:SolarAgent,now=Date.now(),dismissed=new Set<string>()):ContinuationSuggestion|undefined{
 if(!agent.enabled||!agent.memoryEnabled||data.memorySettings?.enabled===false||agent.ownerId!==currentAccountScope()||!profile.role)return;
 const roleServices=pluginCatalog.filter(p=>p.connection==='direct'&&p.aliases.some(a=>profile.role!.toLocaleLowerCase().includes(a.toLocaleLowerCase()))).map(p=>p.id);
 const history=data.missions.filter(m=>m.agentId===agent.id&&!m.origin&&Date.parse(m.updatedAt)<=now&&now-Date.parse(m.updatedAt)<30*DAY&&['completed','failed','partial','paused'].includes(m.status)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,60).flatMap(m=>{const goal=safeGoal(m);if(!goal||isSocialGreeting(goal,agent.name))return [];const service=serviceOf(m,goal);return roleServices.length&&service&&!roleServices.includes(service)?[]:[{m,goal,service}];});
 const candidates:(ContinuationSuggestion&{score:number})[]=[];
 const add=(kind:ContinuationSuggestion['kind'],text:string,source:typeof history,score:number,reason:string,service?:DirectPluginId)=>{
  if(!text||text.length>240||forbidden.test(text))return;
  const normalized=(v:string)=>clean(v).toLocaleLowerCase().replace(/[.!?]+$/,'');
  if(kind!=='resume'&&history.some(x=>x.m.status==='completed'&&now-Date.parse(x.m.updatedAt)<12*3600000&&normalized(x.goal)===normalized(text)))return;
  const missionIds=source.map(x=>x.m.id),id='resume:'+hash(JSON.stringify([agent.id,profile.role,kind,missionIds,dayKey(new Date(now))]));
  if(!dismissed.has(id))candidates.push({id,text,kind,service,reason,missionIds,score});
 };
 const latest=history[0];if(!latest)return;
 // A fresh unresolved read is more useful than repeating a completed task.
 if(['failed','partial','paused'].includes(latest.m.status)&&now-Date.parse(latest.m.updatedAt)<7*DAY)add('resume',`Reprends cette vérification : ${latest.goal.replace(/^Reprends cette vérification : /,'')}`, [latest],120,'Une vérification récente reste inachevée.',latest.service);
 // Reuse Cortex's existing observed mail habits, including differently worded requests.
 const routine=dueRoutine(data.notebooks?.[agent.id],now);
 if(routine&&Number.isInteger(routine.limit)&&routine.limit>=1&&routine.limit<=10&&new Set(routine.days.filter(d=>{const at=Date.parse(d);return at<=now&&now-at<30*DAY;})).size>=3){
  const observed=history.filter(x=>x.service===routine.service&&x.m.status==='completed');
  if(observed.length)add('habit',`Résume mes ${routine.limit} derniers e-mails ${routine.service==='gmail'?'Gmail':'Outlook'}.`,observed.slice(0,4),115,'Une habitude déjà observée dans la mémoire de cet agent.',routine.service);
 }
 const groups=new Map<string,typeof history>();for(const item of history.filter(x=>x.m.status==='completed')){const key=item.goal.toLocaleLowerCase().replace(/[.!?]+$/,'');groups.set(key,[...(groups.get(key)??[]),item]);}
 for(const group of groups.values()){
  const days=new Set(group.map(x=>dayKey(new Date(x.m.updatedAt))));const last=group[0];
  const alreadyToday=history.some(x=>x.m.status==='completed'&&dayKey(new Date(x.m.updatedAt))===dayKey(new Date(now))&&(last.service?x.service===last.service:x.goal.toLocaleLowerCase()===last.goal.toLocaleLowerCase()));
  if(!alreadyToday&&days.size>=3&&dayKey(new Date(last.m.updatedAt))!==dayKey(new Date(now))&&!/\b\d{4}-\d{2}-\d{2}\b|\b(?:hier|demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i.test(last.goal))add('habit',last.goal,group.slice(0,4),110,`Une demande répétée sur ${days.size} jours distincts.`,last.service);
 }
 if(latest.m.status==='completed'){
  const repo=latest.goal.match(/(?:https:\/\/github\.com\/)?\b([a-z\d][\w.-]{0,38}\/[\w.-]{1,80})\b/i)?.[1];
  if(latest.service==='github'&&repo&&!repo.includes('..'))add('repository',`Vérifie les changements du dépôt GitHub ${repo} depuis notre dernier point.`,[latest],95,'Le dépôt nommé dans ta dernière demande.',latest.service);
  const title=titleFrom(latest.goal);
  if(title&&latest.service&&['google-drive','google-docs','google-sheets','onedrive','onenote'].includes(latest.service))add('document',`Repère les points à approfondir dans « ${title} » sur ${pluginCatalog.find(p=>p.id===latest.service)!.name}, à partir de notre dernière analyse.`,[latest],96,'Le document nommé dans ta dernière demande.',latest.service);
  const channel=latest.goal.match(/#([\p{L}\d][\p{L}\d_-]{1,78})/u)?.[1];
  if(latest.service==='slack'&&channel)add('resource',`Repère les questions encore sans réponse dans le canal Slack #${channel}, à partir de notre dernier point.`,[latest],94,'Le canal nommé dans ta dernière demande.','slack');
  const ticket=latest.goal.match(/\b([A-Z][A-Z0-9]{1,14}-\d{1,9})\b/)?.[1];
  if(latest.service==='linear'&&ticket)add('resource',`Vérifie l’avancement du ticket Linear ${ticket} depuis notre dernier point.`,[latest],94,'Le ticket nommé dans ta dernière demande.','linear');
  if(title&&latest.service){
   const serviceName=pluginCatalog.find(p=>p.id===latest.service)!.name;
   if(['google-calendar','ms-calendar'].includes(latest.service))add('resource',`Prépare les points à aborder pour « ${title} » dans ${serviceName}, à partir de notre dernier point.`,[latest],93,'Le rendez-vous nommé dans ta dernière demande.',latest.service);
   if(['google-tasks','ms-todo'].includes(latest.service))add('resource',`Repère les tâches prioritaires de la liste « ${title} » sur ${serviceName}.`,[latest],93,'La liste nommée dans ta dernière demande.',latest.service);
   if(['google-contacts','ms-contacts'].includes(latest.service))add('resource',`Repère les informations manquantes dans la fiche « ${title} » sur ${serviceName}.`,[latest],93,'La fiche nommée dans ta dernière demande.',latest.service);
  }
  if(latest.service==='gmail'||latest.service==='outlook'){
   const count=latest.goal.match(/\b(\d{1,2}|trois|cinq|dix)\s+derniers?\s+(?:(?:e-?)?mails?|messages?)/i)?.[1]??'derniers';
   if(!/attend|r[eé]pon|relanc/i.test(latest.goal))add('mail',`Repère les demandes qui attendent une réponse dans mes ${count==='derniers'?'derniers':count+' derniers'} e-mails ${latest.service==='gmail'?'Gmail':'Outlook'}.`,[latest],85,'La suite de ta dernière lecture de mails.',latest.service);
   else if(now-Date.parse(latest.m.updatedAt)>12*3600000)add('refresh',`Vérifie les nouveaux e-mails ${latest.service==='gmail'?'Gmail':'Outlook'} et les réponses reçues depuis notre dernier point.`,[latest],70,'Actualiser une lecture précédente.',latest.service);
  }
  if(!latest.service&&latest.m.sources?.length&&now-Date.parse(latest.m.updatedAt)>DAY)add('refresh',`Actualise cette recherche avec des sources récentes : ${latest.goal.replace(/^Actualise cette recherche avec des sources récentes : /,'')}`,[latest],60,'Une recherche précédente à actualiser.');
 }
 return candidates.sort((a,b)=>b.score-a.score)[0];
}
export function prepareContinuations(data:AgentData,now=Date.now(),dismissed=dismissedContinuations(now)){
 const result=new Map<string,ContinuationSuggestion>();for(const p of data.team?.profiles??[]){const a=data.agents.find(a=>a.id===p.agentId);if(!a)continue;let suggestion=chooseContinuation(data,p,a,now,dismissed);
 if(!suggestion&&a.enabled&&a.ownerId===currentAccountScope()&&p.role){
  const cached=p.suggestions?.role===p.role&&p.suggestions.status==='ready'?p.suggestions.items:[];
  const ideas=[...cached.filter(i=>!forbidden.test(i.text)),...localRoleIdeas(p),{id:'role-next',text:'Propose une prochaine action utile dans le rôle que je t’ai confié.'}];
  const memory=a.memoryEnabled&&data.memorySettings?.enabled!==false;
  const recent=memory?new Set(data.missions.filter(m=>m.agentId===a.id&&m.status==='completed'&&now-Date.parse(m.updatedAt)<12*3600000).map(m=>clean(m.requestText??m.goal).toLocaleLowerCase())):new Set<string>();
  for(const idea of ideas){if(forbidden.test(idea.text)||safeMemoryText(idea.text)!==idea.text||recent.has(clean(idea.text).toLocaleLowerCase()))continue;
   const id='role-resume:'+hash(JSON.stringify([a.id,p.role,idea.text,dayKey(new Date(now))]));if(dismissed.has(id))continue;
   suggestion={id,text:idea.text,service:'service'in idea?idea.service as DirectPluginId:undefined,reason:'Une proposition adaptée au rôle que tu as confié à cet agent.',missionIds:[],kind:'role'};break;
  }
 }
 if(suggestion)result.set(a.id,suggestion);}return result;
}
