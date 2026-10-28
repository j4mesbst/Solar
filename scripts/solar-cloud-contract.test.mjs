import assert from 'node:assert/strict';
import {streamChat,ChatError} from '../src/services/chatApi.ts';
import {providerApi,ProviderError} from '../src/services/providerApi.ts';
import {modelWithProviderLimits} from '../src/services/providerCapabilities.ts';
import {presentedProvider,solarCloudModelLabel,isSolarCloudProvider,SOLAR_CLOUD_BUSY_MESSAGE} from '../src/services/solarCloud.ts';
const provider={id:'cloud-existing',name:'GonkaRouter',protocol:'openai-compatible',baseUrl:'https://api.gonkarouter.io/v1',secretRef:'original-vault-ref',enabled:true,connectionState:'connected'};
const vault={get:async()=> 'TEST_ONLY'},messages=[{id:'m',conversationId:'c',role:'user',content:'Bonjour',status:'completed',createdAt:new Date().toISOString(),order:0}];
const sourceIds=['zai-org/GLM-5.3-Flash','deepseek-ai/DeepSeek-V4-Flash-0731','MiniMaxAI/MiniMax-M2.7'];
for(const [index,id] of sourceIds.entries()){
 const raw={id:`${provider.id}:${id}`,providerId:provider.id,providerModelId:id,name:id,displayName:'Legacy actual name',displayNameSource:id,capabilities:[],source:'remote',enabled:true};
 const view=modelWithProviderLimits(raw,provider);assert.equal(view.displayName,['GLM 5.3 Flash','DeepSeek V4 Flash','MiniMax M2.7'][index]);assert.equal(view.displayNameSource,id);for(const key of ['id','providerId','providerModelId','name'])assert.equal(view[key],raw[key]);assert.equal(raw.displayName,'Legacy actual name');assert.equal(view.contextWindow,index===2?180000:400000);assert(view.capabilities.includes('tools'));
 const configured=modelWithProviderLimits({...raw,contextWindow:100000,contextSource:'manual',maxOutputTokens:12000},provider);assert.equal(configured.contextWindow,100000);assert.equal(configured.maxOutputTokens,12000);
 const external={...provider,baseUrl:'https://api.example.invalid/v1'};assert.equal(solarCloudModelLabel(raw,external),undefined);assert.equal(modelWithProviderLimits(raw,external).displayName,'Legacy actual name');
}
const presentation=presentedProvider(provider);assert.equal(presentation.name,'Solar Cloud');assert.equal(provider.name,'GonkaRouter');for(const key of ['id','protocol','baseUrl','secretRef','enabled'])assert.equal(presentation[key],provider[key]);
assert(!isSolarCloudProvider({...provider,baseUrl:'https://api.gonkarouter.io.evil.invalid/v1'}));assert(!isSolarCloudProvider({...provider,protocol:'ollama'}));
let usedBody;const call=(extra={})=>streamChat({provider,model:sourceIds[0],messages,effort:'low',vault,signal:new AbortController().signal,onDelta:()=>{},...extra});
const fail=async(factory,code,message=SOLAR_CLOUD_BUSY_MESSAGE)=>{globalThis.fetch=factory;await assert.rejects(call(),e=>e instanceof ChatError&&e.code===code&&e.message===message);};
for(const status of [408,425,429,500,502,503,504,529])await fail(async()=>new Response('GonkaRouter overloaded; private upstream details',{status}),'provider');
await fail(async()=>{throw Error('api.gonkarouter.io maintenance private details')},'network');
for(const error of ['GonkaRouter is overloaded',{code:'rate_limit_exceeded',message:'busy'},{code:'server_error',message:'maintenance'}])await fail(async()=>new Response(`data: ${JSON.stringify({error})}\n\n`),'provider');
await fail(async()=>new Response('data: {not-json}\n\n'),'provider');
await fail(async()=>new Response('data: [DONE]\n\n'),'provider');
let leaked='';globalThis.fetch=async()=>new Response('data: '+JSON.stringify({choices:[{delta:{content:'<think>Internal test-only reasoning without a final answer'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');await assert.rejects(call({onDelta:d=>leaked+=d}),e=>e.code==='invalid-response'&&/réponse finale exploitable/.test(e.message));assert.equal(leaked,'');

await fail(async()=>new Response('data: {"choices":[{"delta":{"content":"Partiel"}}]}\n\n'),'network');
await fail(async()=>new Response('',{status:401}),'unauthorized','La clé API a été refusée par le fournisseur.');
await fail(async()=>new Response('data: {"error":{"code":"invalid_api_key"}}\n\n'),'unauthorized','La connexion Solar Cloud a été refusée. Vérifie ta clé dans les paramètres.');
// Keep typed format negotiation usable by Cortex, without the raw vendor payload.
globalThis.fetch=async()=>new Response(JSON.stringify({error:'GonkaRouter unsupported tool schema'}),{status:400});await assert.rejects(call(),e=>e.code==='model'&&/HTTP 400/.test(e.message)&&/outils/.test(e.message)&&!e.message.includes('Gonka'));
const stop=new AbortController();globalThis.fetch=async()=>{stop.abort();throw Error('Stopped')};await assert.rejects(call({signal:stop.signal}),e=>e.code==='interrupted'&&!e.message.includes('occupé'));
let answer='';globalThis.fetch=async(_url,init)=>{usedBody=JSON.parse(init.body);return new Response('data: {"choices":[{"delta":{"content":"Bonjour."}}]}\n\ndata: [DONE]\n\n')};await call({onDelta:d=>answer+=d});assert.equal(answer,'Bonjour.');assert.equal(usedBody.model,sourceIds[0]);
for(const status of [429,503]){globalThis.fetch=async()=>new Response('private maintenance details',{status});await assert.rejects(providerApi.discoverModels(provider,vault),e=>e instanceof ProviderError&&e.code==='unavailable'&&e.message===SOLAR_CLOUD_BUSY_MESSAGE);}
globalThis.fetch=async()=>{throw Error('private network details')};await assert.rejects(providerApi.test(provider,vault),e=>e.message===SOLAR_CLOUD_BUSY_MESSAGE);
globalThis.fetch=async()=>new Response(JSON.stringify({data:sourceIds.map(id=>({id}))}));const discovered=await providerApi.discoverModels(provider,vault);assert.deepEqual(discovered.map(m=>m.displayName),['GLM 5.3 Flash','DeepSeek V4 Flash','MiniMax M2.7']);assert.deepEqual(discovered.map(m=>m.providerModelId),sourceIds);
// Other configured providers keep actionable diagnostics and their identities.
await fail(async()=>new Response('Other provider overload diagnostic',{status:503}),'provider');
globalThis.fetch=async()=>new Response('Other diagnostic',{status:503});await assert.rejects(call({provider:{...provider,name:'Own API',baseUrl:'https://own.invalid/v1'}}),e=>e.message.includes('503')&&!e.message.includes('occupé'));
console.log('Solar Cloud: PASS — three identifiable model names, IDs/vault/context preserved, refresh, overload/network/stream failures concise, cancellation/auth/format negotiation distinct, other providers unchanged.');
