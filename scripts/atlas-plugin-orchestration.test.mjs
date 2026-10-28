import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import{pathToFileURL}from'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'solar-atlas-tools-'));const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};globalThis.window=new EventTarget();
try{
 const result=await build({stdin:{contents:'export {runPluginTask} from "./src/services/cortexPlugins.ts";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'},plugins:[{name:'fixture-boundaries',setup(b){
 b.onLoad({filter:/[/\\]nativeVault\.ts$/},()=>({loader:'ts',contents:'export const secretVault={get:async()=>"TEST_ONLY"};'}));
 b.onLoad({filter:/[/\\]pluginRuntime\.ts$/},()=>({loader:'ts',contents:'export async function connectedPluginTools(){return [{name:"gmail.read",pluginId:"gmail",description:"Lire un mail",parameters:{type:"object",properties:{id:{type:"string"}},required:["id"],additionalProperties:false}}]};export function pluginExecution(){return async()=>{globalThis.reads++;return {id:"M1",body:"Source fictive uniquement"}}}'}));
 }}]});const file=path.join(dir,'test.mjs');await writeFile(file,result.outputFiles[0].text);const {runPluginTask}=await import(pathToFileURL(file));
 for(const fallback of [false,true]){
  data.clear();globalThis.reads=0;let requests=[],streamed='';
  globalThis.fetch=async(_url,init)=>{
   const body=JSON.parse(init.body);requests.push(body);
   if(fallback&&(body.tools||body.response_format))return new Response(JSON.stringify({error:body.tools?'tools unsupported':'response_format unsupported'}),{status:400});
   const finishing=body.messages[0].content.includes('Vérifie la réponse préparée');let text,tool_calls;
   if(finishing)text='Voici le résumé final du mail fictif.';
   else if(reads)text=fallback?'{"answer":"Voici le résumé préparé."}':'Voici le résumé préparé.';
   else if(body.tools)tool_calls=[{index:0,id:'call-read',function:{name:body.tools.find(t=>t.function.name!=='solar_clarify').function.name,arguments:'{"id":"M1"}'}}];
   else text='{"tool":"gmail.read","arguments":{"id":"M1"}}';
   return new Response('data: '+JSON.stringify({choices:[{delta:tool_calls?{tool_calls}:{content:text}}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  };
  const response=await runPluginTask({runId:'run-'+fallback,prompt:'Lis ce mail Gmail',provider:{id:'p',name:'Fixture',protocol:'openai-compatible',baseUrl:'https://fixture.invalid/v1',secretRef:'fixture',enabled:true},model:{id:'m',name:'Fixture',providerId:'p',capabilities:[],enabled:true,contextWindow:131072},services:['gmail'],effort:'high',signal:new AbortController().signal,onAnswerDelta:d=>streamed+=d});
  assert.equal(reads,1);assert.equal(streamed,response.answer);assert(response.answer.startsWith('Voici'));assert.equal(response.telemetry.outcome,'completed');assert(requests[0].tools.length>=2);
  if(!fallback){assert(requests.some(r=>r.messages.some(m=>m.role==='tool')));assert.equal(requests.length,2);}else assert(requests.some(r=>r.response_format));
 }
 console.log('Atlas orchestration: PASS — unknown model capabilities use native tools, natural prose after reads, actual final streaming, and negotiated JSON fallback without duplicate execution.');
}finally{await rm(dir,{recursive:true,force:true});}
