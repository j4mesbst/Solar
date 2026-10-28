import assert from 'node:assert/strict';
import { createCortexBackend, fitCortexPrompt } from '../src/services/cortexBackend.ts';
import { cortexActionSchema } from '../src/lib/agent/actions.ts';

const originalFetch=globalThis.fetch;
try {
  const requests=[];
  globalThis.fetch=async(_url,init)=>{
    const body=JSON.parse(init.body);requests.push(body);
    if(requests.length===1)return new Response(JSON.stringify({error:'invalid tool call arguments: unexpected end of JSON input'}),{status:500});
    return new Response(JSON.stringify({message:{content:'{"actions":[{"type":"finish","message":"ok"}]}'},done:true,done_reason:'stop',eval_count:10})+'\n');
  };
  const backend=createCortexBackend({provider:{id:'local',name:'Local',protocol:'ollama',baseUrl:'http://127.0.0.1:11434',enabled:true},vault:{get:async()=>null},conversationId:'adaptive',modelId:'any-user-selected-model:30b',contextWindow:8192,tools:true,vision:false,onVisible:()=>{}});
  const call={system:'Return structured actions.',prompt:'Corrige la fonction de calcul.',schema:cortexActionSchema,maxOutputTokens:1000};
  const first=await backend(call,new AbortController().signal);
  const second=await backend(call,new AbortController().signal);
  assert(first.text.includes('actions'));assert(second.text.includes('actions'));
  assert.equal(requests.length,3,'only the first turn should attempt the broken tool transport');
  assert(requests[0].tools);assert(!requests[1].tools);assert(!requests[2].tools);
  assert(requests[1].format);assert(requests[2].format);
  assert(requests.every(request=>request.model==='any-user-selected-model:30b'));
  assert.equal(fitCortexPrompt('small prompt','system',8192,1000),'small prompt');
  assert.throws(()=>fitCortexPrompt('Critical objective '.repeat(1000),'system',4096,2200),/CORTEX_CONTEXT/);

  // Runtime has already serialized its ContextPacket. The backend must keep
  // that payload intact rather than serializing sources a second time.
  const prepared=await backend({system:'Prepared context.',prompt:'OBJECTIF\nKeep privacy.\n\nSOURCE\nonly-once',context:{version:1,objective:'duplicate',requirements:'duplicate',state:{},items:[{id:'source',category:'project',content:'only-once',priority:1,reference:'a.ts'}],next:'duplicate'},contextPrepared:true,schema:cortexActionSchema,maxOutputTokens:500},new AbortController().signal);
  assert(prepared.text.includes('actions'));const last=requests.at(-1);const rendered=last.messages.at(-1).content;assert.equal((rendered.match(/only-once/g)??[]).length,1,'prepared context must not be duplicated by the transport');
} finally {globalThis.fetch=originalFetch;}
console.log('cortex-backend-efficiency: model-neutral tool fallback retained across turns, safe context overflow — ok');
