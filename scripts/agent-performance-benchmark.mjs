// Actual local inference; fixed account-free fixtures. No credentials or API writes.
import {build} from 'esbuild';import{readFile,writeFile,mkdir}from'node:fs/promises';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';import path from'node:path';
const out=path.resolve(process.env.SOLAR_PERF_OUTPUT??'output/agent-performance-2026-10-24'),baseline=path.resolve('output/agent-performance-2026-10-24/baseline'),root=process.cwd();await mkdir(out,{recursive:true});
const fixtures={
 'gmail.latest_messages':{messages:[{id:'M1',subject:'Réunion Orion',body:'La réunion Orion se tient demain à 9h. Apporte le bilan. '+ 'Informations du projet : validation du budget et des échéances. '.repeat(35)},{id:'M2',subject:'Contrat',body:'Relis le contrat avant vendredi. '+ 'Le document reste une proposition à valider. '.repeat(35)},{id:'M3',subject:'Facture',body:'Facture de 120 euros à vérifier. Aucun paiement demandé pour ce test. '+ 'Pièces comptables à conserver pour vérification. '.repeat(35)}],count:3,requested:3,partial:false},
 'github.repository_activity':{repository:'demo/solar',lastPushAt:'2026-10-20T09:00:00Z',commits:[{date:'2026-10-20T09:00:00Z',message:'Maintenance'}]},
 'linear.list_issues':{issues:[{id:'i1',identifier:'LIN-42',title:'Corriger les paiements',priority:1,dueDate:'2026-10-30'},{id:'i2',identifier:'LIN-43',title:'Documenter Orion',priority:3,dueDate:'2026-11-02'}],partial:false},
};
const read=(name,properties={},required=[])=>({name,pluginId:name.split('.')[0],description:'Lire la source autorisée avec ses données complètes.',parameters:{type:'object',properties,required,additionalProperties:false},risk:'read',externalEffects:false,parallelSafe:true,permissions:[name.split('.')[0]+'.read']});
const defs=[read('gmail.latest_messages',{limit:{type:'integer',minimum:1,maximum:10}},['limit']),read('github.repository_activity',{repository:{type:'string'}},['repository']),read('linear.list_issues')];
const cases=[
 {id:'gmail',service:'gmail',prompt:'Résume mes trois derniers e-mails Gmail et les suites à donner.',facts:[/9\s*(?:h|:)/i,/contrat/i,/vendredi/i,/120/]},
 {id:'github',service:'github',prompt:'Vérifie depuis quand mon dépôt GitHub demo/solar n’a pas été mis à jour.',facts:[/2026-10-20|20\s+octobre/i,/demo\/solar/]},
 {id:'linear',service:'linear',prompt:'Liste mes tickets Linear dans l’ordre de priorité avec leurs échéances.',facts:[/LIN-42/,/LIN-43/,/2026-10-30|30\s+octobre/i]},
 {id:'extract',prompt:'À partir de cette note, donne les deux actions et leurs échéances : Camille envoie le contrat vendredi. Alex prépare le bilan lundi.',facts:[/Camille/i,/vendredi/i,/Alex/i,/lundi/i]},
 {id:'reason',prompt:'Je dispose de 300 euros. Le train coûte 86 euros et deux nuits coûtent 72 euros chacune. Combien reste-t-il pour les repas ? Explique le calcul.',facts:[/70\s*(?:€|euros)/i,/144|72\s*[×x*]\s*2|2\s*[×x*]\s*72/i]},
];
let task,reads=[],requests=[],metrics=[],first=null,visible='',start=0;
globalThis.benchServices=()=>task.service?[task.service]:[];globalThis.benchTools=()=>defs.filter(t=>t.pluginId===task.service);globalThis.benchExecute=async(name,args)=>{if(!benchTools().some(t=>t.name===name)||!Object.hasOwn(fixtures,name))throw Error('Uncovered tool');if(name==='github.repository_activity'&&args.repository!=='demo/solar')throw Error('Wrong fixture repo');reads.push(name);await new Promise(r=>setTimeout(r,60));return structuredClone(fixtures[name]);};
const modules={};
for(const variant of (process.env.SOLAR_PERF_VARIANTS??'before,after').split(',')){
 const built=await build({stdin:{contents:'export {runAgentMission} from "./src/services/solarAgentRuntime.ts";export {solarAgentStore} from "./src/services/solarAgentStore.ts";',resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'},plugins:[{name:'snapshot-and-fixtures',setup(b){
  if(variant==='before')b.onLoad({filter:/[/\\]services[/\\](?:chatApi|solarAgentRuntime|cortexPlugins|compiledTasks|gtsFacts|ollama)\.ts$/},async args=>({loader:'ts',contents:await readFile(path.join(baseline,path.basename(args.path)),'utf8')}));
  b.onLoad({filter:/[/\\]pluginRuntime\.ts$/},()=>({loader:'ts',contents:'export const resolveRequestedPlugins=async()=>globalThis.benchServices();export const connectedPluginContext=async()=>"Services fictifs de test.";export const connectedPluginTools=async()=>globalThis.benchTools();export const pluginExecution=()=>globalThis.benchExecute;'}));
  b.onLoad({filter:/[/\\]nativeVault\.ts$/},()=>({loader:'ts',contents:'export const secretVault={get:async()=>null};'}));
  b.onLoad({filter:/[/\\]store\.ts$/},()=>({loader:'ts',contents:'export const solarStore={getSettings:async()=>({cortexMemory:false,web:{mode:"off",consent:false},agent:{}})};'}));
  b.onLoad({filter:/[/\\]sharedMemory\.ts$/},()=>({loader:'ts',contents:'export const sharedMemoryContext=async()=>"";'}));
  b.onLoad({filter:/[/\\]cortexStore\.ts$/},()=>({loader:'ts',contents:'export const cortexStore={modelExperience:async()=>undefined,saveModelExperience:async()=>{}};'}));
 }}]});const text=built.outputFiles[0].text,file=path.join(out,variant+'-agent.mjs');await writeFile(file,text);modules[variant]={api:await import(pathToFileURL(file)),sha256:createHash('sha256').update(text).digest('hex')};
}
const fetchOriginal=globalThis.fetch;
globalThis.fetch=async(url,init)=>{if(String(url).endsWith('/api/chat'))requests.push(JSON.parse(init.body));return fetchOriginal(url,init);};
const metadata={date:new Date().toISOString(),model:'ornith-1.5:9b',effort:'medium',contextMaximum:Number(process.env.SOLAR_PERF_MAX_CONTEXT??32768),maxOutputTokens:8192,privateAccounts:false,seed:'not fixed',repetitions:1,bundles:Object.fromEntries(Object.entries(modules).map(([k,v])=>[k,v.sha256])),fixturesSha256:createHash('sha256').update(JSON.stringify(fixtures)).digest('hex')};
await writeFile(path.join(out,'benchmark-metadata.json'),JSON.stringify(metadata,null,2));
// Cold load excluded equally. This is an allocation warm-up, not an answer.
await(await fetchOriginal('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:metadata.model,messages:[{role:'user',content:'Bonjour'}],stream:false,think:false,options:{num_ctx:32768,num_predict:1}}),signal:AbortSignal.timeout(90000)})).json();
const rows=[];
for(const [index,t]of cases.filter(t=>!process.env.SOLAR_PERF_TASKS||process.env.SOLAR_PERF_TASKS.split(',').includes(t.id)).entries())for(const variant of (index%2?['after','before']:['before','after']).filter(v=>modules[v])){
 task=t;reads=[];requests=[];metrics=[];first=null;visible='';const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};delete globalThis.window;
 const {api}=modules[variant],at=new Date().toISOString(),id=crypto.randomUUID(),agent={id:'atlas',ownerId:'guest',name:'Atlas',description:'Measurement',enabled:true,providerId:'local',modelId:'ornith',effort:'medium',grants:[],skillIds:[],memoryEnabled:false,instructions:'Réponds en français. Ne fabrique pas de résultats.',accessMode:'full',createdAt:at,updatedAt:at};await api.solarAgentStore.saveAgent(agent);const mission={id,agentId:'atlas',goal:t.prompt,requestText:t.prompt,status:'queued',createdAt:at,updatedAt:at,events:[]};start=performance.now();
 const r=await api.runAgentMission({mission,agent,providers:[{id:'local',name:'Local',protocol:'ollama',baseUrl:'http://127.0.0.1:11434',secretRef:'unused',enabled:true}],models:[{id:'ornith',providerId:'local',providerModelId:metadata.model,name:metadata.model,enabled:true,capabilities:['tools','reasoning'],contextWindow:metadata.contextMaximum,maxOutputTokens:metadata.maxOutputTokens}],signal:AbortSignal.timeout(100000),history:[{id:'user',conversationId:id,role:'user',content:t.prompt,status:'completed',createdAt:at,order:0}],conversationId:id,onDelta:d=>{if(d)first??=Math.round(performance.now()-start);visible+=d;},onReplace:s=>{visible=s;},onMetrics:m=>metrics.push(m)});
 const text=r.result??visible,row={task:t.id,variant,status:r.status,error:r.error,totalMs:Math.round(performance.now()-start),firstTextMs:first,modelCalls:requests.length,activeContexts:requests.map(r=>r.options?.num_ctx),thinking:requests.map(r=>r.think),toolCalls:reads,usage:r.usage,facts:t.facts.map(re=>re.test(text)),visibleMatchesFinal:r.result===undefined?undefined:visible===r.result,answer:text,metrics};row.success=r.status==='completed'&&row.facts.every(Boolean)&&(!t.service||reads.length>0);rows.push(row);await writeFile(path.join(out,'benchmark-results.json'),JSON.stringify({metadata,rows},null,2));console.log(JSON.stringify({...row,answer:undefined,metrics:undefined}));
}
// A request with the actual declared 262K maximum must also use the smaller cache.
const response=await fetchOriginal('http://127.0.0.1:11434/api/ps');await writeFile(path.join(out,'loaded-after.json'),JSON.stringify(await response.json(),null,2));
console.log('COMPLETE '+rows.length+' mission trials; real local inference for model calls, fixed connector fixtures.');
