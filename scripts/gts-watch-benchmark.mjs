// Real Ornith inference; fictional connector data and 60 ms source latency.
// Run agent-five-benchmark first to produce the current, hashed GTS bundle.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const file=path.resolve(process.env.GTS_WATCH_BUNDLE??'output/gts/capabilities/after-agent.mjs');
const out=path.resolve('output/gts/watch');await mkdir(out,{recursive:true});
const tool={name:'gmail.followup_candidates',pluginId:'gmail',description:'Vérifier le dernier auteur des fils envoyés.',parameters:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:10}},required:['limit'],additionalProperties:false},risk:'read',externalEffects:false,parallelSafe:true,permissions:['gmail.read']};
let reads=0,modelCalls=0,changed=false;
globalThis.benchTools=()=>[tool];globalThis.benchServices=()=>['gmail'];
globalThis.benchExecute=async(name)=>{assert.equal(name,tool.name);reads++;await new Promise(r=>setTimeout(r,60));return {threads:[{id:'T1',subject:'Orion',waiting:!changed,lastAt:changed?'2026-10-23T10:00:00Z':'2026-10-22T09:00:00Z'}],partial:false,scope:'Un fil fictif vérifié'};};
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};delete globalThis.window;
const api=await import(pathToFileURL(file));const nativeFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{if(String(url).endsWith('/api/chat'))modelCalls++;return nativeFetch(url,init);};
const at=new Date().toISOString(),agent={id:'atlas',ownerId:'guest',name:'Atlas',description:'Test de suivi',enabled:true,providerId:'local',modelId:'ornith',effort:'low',grants:[],skillIds:[],memoryEnabled:false,instructions:'Réponds en français. Maximum 60 mots. Ne fabrique pas de résultats.',accessMode:'full',createdAt:at,updatedAt:at};
await api.solarAgentStore.saveAgent(agent);
const rows=[];let digest;
try{
 for(const pass of ['initial','unchanged','changed']){
  changed=pass==='changed';const priorReads=reads,priorCalls=modelCalls,metrics=[];const started=performance.now();
  const result=await api.runAgentMission({mission:{id:'watch-'+pass,agentId:'atlas',kind:'follow-ups',goal:'Suis mes réponses attendues dans Gmail.',status:'queued',events:[],createdAt:at,updatedAt:at},agent,providers:[{id:'local',name:'Local',protocol:'ollama',baseUrl:'http://127.0.0.1:11434',secretRef:'unused',enabled:true}],models:[{id:'ornith',providerId:'local',providerModelId:'ornith-1.5:9b',name:'Ornith',enabled:true,capabilities:['tools'],contextWindow:16384,maxOutputTokens:384}],timezone:'Europe/Paris',background:true,authorizedBackgroundRead:true,readOnlyTools:true,serviceScope:['gmail'],unchangedDigest:digest,signal:AbortSignal.timeout(52000),onMetrics:m=>metrics.push(m)});
  const row={pass,status:result.status,answer:result.result,latencyMs:Math.round(performance.now()-started),reads:reads-priorReads,modelCalls:modelCalls-priorCalls,inputTokens:metrics.reduce((s,m)=>s+(m.promptTokens??0),0),outputTokens:metrics.reduce((s,m)=>s+(m.tokens??0),0),evidenceDigest:result.evidenceDigest};rows.push(row);console.log(JSON.stringify(row));
  assert.equal(result.status,'completed');assert.equal(row.reads,1,'Every pass must fetch a fresh source');assert.equal(row.modelCalls,pass==='unchanged'?0:1);if(pass==='unchanged')assert.equal(result.evidenceDigest,digest);if(pass==='changed')assert.notEqual(result.evidenceDigest,digest);digest=result.evidenceDigest;
 }
}finally{globalThis.fetch=nativeFetch;await writeFile(path.join(out,'results.json'),JSON.stringify({model:'ornith-1.5:9b',bundle:file,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),privateConnectorsUsed:false,fixtureLatencyMs:60,rows},null,2)+'\n');}
