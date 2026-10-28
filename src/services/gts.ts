import {compileWorkflow,type CompiledWorkflow} from '../lib/cortex/workflow.ts';
import type {CortexPluginTool} from '../lib/cortex/tool-runtime.ts';
import type {AgentWorkspace,RoutineKind} from './agentWorkspaces.ts';
/** GTS 3.0 extends the existing optimizer with bounded, resumable routine plans.
 * Same bounded DAG, validators, permission gateway and adaptive fallback. */
export {CORTEX_OPTIMIZER as GTS_NAME,CORTEX_OPTIMIZER_VERSION as GTS_VERSION} from '../lib/cortex/types.ts';
export function zonedDayBounds(now:Date,zone=Intl.DateTimeFormat().resolvedOptions().timeZone){
 const format=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}),parts=format.formatToParts(now),get=(name:string)=>parts.find(p=>p.type===name)!.value;
 const y=Number(get('year')),m=Number(get('month')),d=Number(get('day'));
 const key=(date:Date)=>{const p=format.formatToParts(date);return ['year','month','day'].map(n=>p.find(x=>x.type===n)!.value).join('-');};
 const first=(day:Date)=>{const target=day.toISOString().slice(0,10),utc=day.getTime();let low=utc-36*3600000,high=utc+36*3600000;while(low<high){const middle=Math.floor((low+high)/2);if(key(new Date(middle))<target)low=middle+1;else high=middle;}if(key(new Date(low))!==target)throw Error('Date locale introuvable dans ce fuseau.');return new Date(low).toISOString();};
 return {start:first(new Date(Date.UTC(y,m-1,d))),end:first(new Date(Date.UTC(y,m-1,d+1)))};
}
export function compileRoutineTask(kind:RoutineKind|undefined,tools:CortexPluginTool[],workspace?:AgentWorkspace,now=new Date(),timezone?:string):CompiledWorkflow|undefined{
 if(!kind)return;
 const nodes:CompiledWorkflow['nodes']=[];
 const add=(tool:string,args:Record<string,unknown>)=>{if(tools.some(t=>t.name===tool))nodes.push({id:'read'+nodes.length,tool,arguments:args});};
 if(kind==='day-brief'){
  const {start,end}=zonedDayBounds(now,timezone);
  add('google-calendar.list_events',{start,end});add('ms-calendar.list_events',{start,end});
  add('gmail.latest_messages',{limit:3});add('outlook.latest_messages',{limit:3});
  for(const [service,path] of [['google-tasks','items'],['ms-todo','value']] as const){
   if(!tools.some(t=>t.name===`${service}.list_lists`)||!tools.some(t=>t.name===`${service}.list_tasks`))continue;
   const id=`lists${nodes.length}`;
   nodes.push({id,tool:`${service}.list_lists`,arguments:{}},{id:`tasks${nodes.length}`,tool:`${service}.list_tasks`,arguments:{},each:{from:id,path:[path],argument:'listId',field:['id'],limit:40}});
  }
 }
 if(kind==='follow-ups'){add('gmail.followup_candidates',{limit:10});add('outlook.followup_candidates',{limit:10});}
 if(kind==='project-review'&&workspace){for(const resource of workspace.resources){
  if(resource.service==='github'&&resource.locator&&/^[\w.-]+\/[\w.-]+$/.test(resource.locator))add('github.repository_activity',{repository:resource.locator});
  if(resource.service==='linear')add('linear.search_issues',{query:workspace.name});
  if(resource.service==='slack')add('slack.search_messages',{query:workspace.name});
  if(resource.service==='google-drive')add('google-drive.search_files',{query:workspace.name});
 }}
 if(!nodes.length)return;try{return compileWorkflow({version:1,nodes},tools);}catch{return;}
}

/** Narrow explicit exclusions override routine defaults. Unknown phrasing is
 * left to the adaptive agent; this function never adds a service or a grant. */
export function routineServiceAllowed(service:string,text:string){
 const aliases:Record<string,string>={gmail:'gmail|(?:mes |les )?(?:e-mails?|emails?|mails?)',outlook:'(?:microsoft )?outlook|(?:mes |les )?(?:e-mails?|emails?|mails?)','google-calendar':'google (?:agenda|calendar)|(?:mon |le |l[’\u0027])?(?:agenda|calendrier)','ms-calendar':'(?:microsoft |outlook )?(?:agenda|calendrier)','google-tasks':'google tasks|(?:mes |les )?tâches','ms-todo':'microsoft to do|to do|(?:mes |les )?tâches'};
 const alias=aliases[service];if(!alias)return true;
 return !new RegExp(`(?:\\bsans|\\bsauf|\\bexcepté|\\bignore|ne (?:lis|consulte|vérifie) pas|n[’']utilise pas)\\s+(?:${alias})(?=$|[\\s,.!?;])`,'iu').test(text);
}
