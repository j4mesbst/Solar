import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createOAuthBroker } from '../server/oauth-broker.mjs';
import { runCortexTools } from '../src/lib/cortex/tool-runtime.ts';
import { validateToolParameters } from '../src/services/toolSchema.ts';
import { nextAutomationRun, markAutomationResult } from '../src/services/agentScheduler.ts';
import { saveSharedMemory, sharedMemoryContext } from '../src/services/sharedMemory.ts';
import { solarAgentStore } from '../src/services/solarAgentStore.ts';
import { initializeAccountScope } from '../src/services/accountScope.ts';
import { streamChat } from '../src/services/chatApi.ts';

const realFetch=globalThis.fetch.bind(globalThis);
const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
globalThis.sessionStorage=globalThis.localStorage;globalThis.window={dispatchEvent:()=>{}};
initializeAccountScope('test-alice');
await saveSharedMemory('Le projet Solar utilise Rust.');
assert.match(await sharedMemoryContext('projet Rust',false),/Solar utilise Rust/);
assert.equal(await sharedMemoryContext('projet Rust',true),'','cloud opt-in');
await solarAgentStore.saveMemorySettings({enabled:true,cloud:true});assert.match(await sharedMemoryContext('projet Rust',true),/Solar utilise Rust/);
await solarAgentStore.saveMemorySettings({enabled:false,cloud:true});assert.equal(await sharedMemoryContext('Rust',false),'');
initializeAccountScope('test-bob');assert.equal(await sharedMemoryContext('Rust',false),'');initializeAccountScope('');
assert.equal(nextAutomationRun({frequency:'once',localDate:'2026-10-28',localTime:'09:30',timezone:'Europe/Paris'},new Date('2026-10-21T08:00Z')),'2026-10-28T08:30:00.000Z');
assert.equal(nextAutomationRun({frequency:'weekly',weekdays:[1,3],localTime:'09:00',timezone:'Europe/Paris'},new Date('2026-10-23T10:00Z')),'2026-10-26T08:00:00.000Z');
assert.throws(()=>nextAutomationRun({frequency:'weekly',weekdays:[],localTime:'09:00',timezone:'Europe/Paris'},new Date()),/jour/);
assert.throws(()=>nextAutomationRun({frequency:'once',localDate:'2026-03-29',localTime:'02:30',timezone:'Europe/Paris'},new Date('2026-03-28T10:00Z')),/occurrence/,'DST nonexistent time is not silently shifted');
const timestamp='2026-10-21T10:00:00.000Z';
await solarAgentStore.saveAgent({id:'scheduler-test',ownerId:'guest',name:'Test',description:'',instructions:'',providerId:'p',modelId:'m',effort:'medium',enabled:true,grants:[],skillIds:[],memoryEnabled:false,createdAt:timestamp,updatedAt:timestamp});
const schedule={id:'stale-schedule',agentId:'scheduler-test',instruction:'Read',frequency:'daily',localTime:'09:00',timezone:'Europe/Paris',enabled:true,nextRunAt:'2026-10-22T07:00:00.000Z',createdAt:timestamp,updatedAt:timestamp};
await solarAgentStore.saveAutomation(schedule);await solarAgentStore.deleteAutomation(schedule.id);assert.equal(await markAutomationResult(schedule,'late result',new Date(timestamp)),undefined);assert.equal((await solarAgentStore.snapshot()).automations.length,0,'deleted schedules never resurrected');
await solarAgentStore.saveAutomation({...schedule,enabled:false});await markAutomationResult(schedule,'done',new Date(timestamp));assert.equal((await solarAgentStore.snapshot()).automations[0].enabled,false,'pause is preserved by late completion');
await solarAgentStore.saveAutomation({...schedule,nextRunAt:'2026-10-23T07:00:00.000Z'});assert.equal(await markAutomationResult(schedule,'late',new Date(timestamp)),undefined,'rescheduling not overwritten');await solarAgentStore.deleteAgent('scheduler-test');

const parameters={type:'object',properties:{count:{type:'integer',minimum:1,maximum:3},kind:{enum:['read','write']}},required:['count'],additionalProperties:false};
assert.equal(validateToolParameters({count:2},parameters).length,0);assert(validateToolParameters({count:4},parameters).length);assert(validateToolParameters({count:1,extra:1},parameters).length);
assert.equal(validateToolParameters({count:2},{$schema:'http://json-schema.org/draft-07/schema#',...parameters}).length,0);
assert(validateToolParameters({},{$ref:'https://evil.invalid/schema'}).length);
let attempts=0,persisted;
const tool={name:'service.write',pluginId:'service',parameters:{type:'object',properties:{},additionalProperties:false},externalEffects:true};
await assert.rejects(runCortexTools({prompt:'write',tools:[tool],signal:new AbortController().signal},{generate:async()=>({text:'{"tool":"service.write","arguments":{}}'}),onStep:(_phase,_detail,calls)=>{persisted=structuredClone(calls);},execute:async()=>{attempts++;throw Error('uncertain network write');}}),/uncertain/);
assert.equal(persisted[0].result,'[not retained]');await assert.rejects(runCortexTools({prompt:'resume',calls:persisted,tools:[tool],signal:new AbortController().signal},{generate:async()=>{throw Error('must not generate');},execute:async()=>{attempts++;}}),/pas rejouée/);assert.equal(attempts,1);
// Native provider tool streaming: split function names and JSON arguments.
const provider={id:'test',name:'test',protocol:'openai-compatible',baseUrl:'https://fixture.invalid/v1',secretRef:'test',enabled:true};
const messages=[{id:'u',conversationId:'t',role:'user',content:'read',status:'completed',createdAt:'2026-10-21',order:0}];
let request;globalThis.fetch=async(_url,init)=>{request=JSON.parse(init.body);return new Response(['data: '+JSON.stringify({choices:[{delta:{tool_calls:[{index:0,function:{name:'solar_next_',arguments:'{"answer":'}}]}}]}),'data: '+JSON.stringify({choices:[{delta:{tool_calls:[{index:0,function:{name:'action',arguments:'"ok"}'}}]}}]}),'data: [DONE]'].join('\n\n')+'\n\n',{headers:{'Content-Type':'text/event-stream'}});};
const chatInput={provider,model:'fixture',messages,effort:'medium',tools:[{type:'function',function:{name:'solar_next_action',parameters:{type:'object'}}}],vault:{get:async()=> 'fixture'},signal:new AbortController().signal,onDelta:()=>{}};
const result=await streamChat(chatInput);assert.equal(result.stopReason,'tool_calls');assert.deepEqual(result.toolCalls,[{name:'solar_next_action',arguments:{answer:'ok'}}]);assert.equal(request.tools[0].function.name,'solar_next_action');
globalThis.fetch=async(_url,init)=>{request=JSON.parse(init.body);return new Response([{type:'content_block_start',index:0,content_block:{type:'tool_use',name:'solar_next_action',id:'t',input:{}}},{type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:'{"answer":"ok"}'}},{type:'message_stop'}].map(x=>'data: '+JSON.stringify(x)+'\n\n').join(''),{headers:{'Content-Type':'text/event-stream'}});};
const ant=await streamChat({...chatInput,provider:{...provider,protocol:'anthropic'}});assert.deepEqual(ant.toolCalls,result.toolCalls);assert.equal(request.tools[0].name,'solar_next_action');
// Bundle browser service imports for Node without changing production resolution.
const dir=await mkdtemp(path.join(tmpdir(),'solar-phase2-'));
try{
 const bundle=await build({stdin:{contents:'export * from "./src/services/pluginAccounts.ts";export * from "./src/services/integrationTools.ts";export * from "./src/services/secureIntegrationFetch.ts";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'}});
 const file=path.join(dir,'services.mjs');await writeFile(file,bundle.outputFiles[0].text);const service=await import(pathToFileURL(file));
 await service.saveConnection('slack',{accessToken:'fake1',identity:'Workspace A',auth:'api-key'});await service.saveConnection('slack',{accessToken:'fake2',identity:'Workspace B',auth:'api-key'});assert.equal((await service.listAccounts('slack')).length,2);
 const first=(await service.listAccounts('slack'))[0];await service.selectAccount('slack',first.id);assert.equal((await service.savedConnection('slack')).identity,'Workspace A');await service.removeConnection('slack');assert.equal((await service.savedConnection('slack')).identity,'Workspace B');
 let calls=[];globalThis.fetch=async(url,init)=>{calls.push({url:url.url,init:{body:await url.text()}});return new Response(JSON.stringify({ok:true,ts:'123'}),{headers:{'Content-Type':'application/json'}});};
 const slack=service.integrationTools.find(x=>x.name==='slack.send_message');await slack.execute({channel:'C123',text:'Exact message'},new AbortController().signal);assert.equal(calls[0].url,'https://slack.com/api/chat.postMessage');assert.deepEqual(JSON.parse(calls[0].init.body),{channel:'C123',text:'Exact message'});assert.equal(slack.externalEffects,true);
 globalThis.fetch=async()=>new Response('{}',{status:429,headers:{'retry-after':'30'}});await assert.rejects(slack.execute({channel:'C',text:'x'},new AbortController().signal),/30 secondes/);
 await service.saveConnection('discord',{accessToken:'fake',identity:'user',auth:'oauth'});await assert.rejects(service.integrationTools.find(x=>x.name==='discord.send_message').execute({channelId:'123',content:'x'},new AbortController().signal),/bot officiel/);
 assert.throws(()=>service.validateServerUrl('https://127.0.0.1/mcp'),/publique/);assert.throws(()=>service.validateServerUrl('http://10.0.0.1/mcp',true),/loopback/);assert.throws(()=>service.validateServerUrl('https://user:secret@example.com/mcp'),/identifiants/);
}finally{await rm(dir,{recursive:true,force:true});}
// Broker uses only official endpoints, fixed redirects and PKCE-bound tickets.
const verifier='a'.repeat(64), challenge=createHash('sha256').update(verifier).digest('base64url'),state='s'.repeat(64);let upstream=[];
const broker=createOAuthBroker({env:{NOTION_CLIENT_ID:'public-id',NOTION_CLIENT_SECRET:'server-only-secret',NOTION_REDIRECT_URIS:'http://127.0.0.1:18767/oauth/callback'},fetcher:async(url,init)=>{upstream.push({url,init});return new Response(JSON.stringify({access_token:'fake-token',refresh_token:'fake-refresh',workspace_id:'not-forwarded'}));}});
await new Promise(resolve=>broker.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${broker.address().port}`;

try{
 const send=(route,fields)=>realFetch(base+route,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({provider:'notion',client_id:'public-id',...fields})});
 const redirect_uri='http://127.0.0.1:18767/oauth/callback';assert.equal((await send('/oauth/token',{grant_type:'authorization_code',code:'code',redirect_uri,state,code_verifier:verifier})).status,400);
 assert.equal((await send('/oauth/prepare',{redirect_uri,state,code_challenge:challenge})).status,200);
 assert.equal((await send('/oauth/token',{grant_type:'authorization_code',code:'code',redirect_uri,state,code_verifier:'x'.repeat(64)})).status,400);
 const success=await send('/oauth/token',{grant_type:'authorization_code',code:'code',redirect_uri,state,code_verifier:verifier});assert.equal(success.status,200);assert.deepEqual(await success.json(),{access_token:'fake-token',refresh_token:'fake-refresh'});assert.equal(upstream[0].url,'https://api.notion.com/v1/oauth/token');assert.equal((await send('/oauth/token',{grant_type:'authorization_code',code:'code',redirect_uri,state,code_verifier:verifier})).status,400,'ticket single use');
}finally{await new Promise(resolve=>broker.close(resolve));}
console.log('Phase 2: mémoire, horaires/DST, schémas, écritures non rejouées, outils cloud, comptes, adaptateurs et broker — PASS (API simulées).');
