import assert from 'node:assert/strict';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { analyzeIntent } from '../src/lib/agent/intent.ts';
import { abortable, stableDiagnostic, structuralFeedback } from '../src/lib/cortex/reliability.ts';
import { evidenceFeedback } from '../src/lib/cortex/evidence.ts';
import { solveVisual } from '../src/lib/cortex/visual-solver.ts';
import { streamChat } from '../src/services/chatApi.ts';
const signal=new AbortController().signal;
for(const prompt of ['Déplace la fonction dans un autre fichier.','Extrais la fonction dans un module.','Refactorise la fonction.']) assert.notEqual(analyzeIntent(prompt).taskType,'repositoryTask');
assert.equal(stableDiagnostic('/private/var/folders/aa/bb/T/solar-bench-ABC/check.cjs:1'),stableDiagnostic('/private/var/folders/aa/bb/T/solar-bench-XYZ/check.cjs:1'));
const failure={type:'tests',status:'failed',output:"AssertionError: Expected values to be strictly deep-equal:\n+ actual - expected\n ['a',\n+ '',\n 'b']\n at /private/tmp/solar-bench-AA/check.cjs:1"};
assert.match(evidenceFeedback([failure]),/\+ ''/);
assert.match(structuralFeedback([{...failure,type:'visual',output:'#target: observé null'}])[0],/React\/HTML/);
assert.equal(solveVisual({frames:[{elements:[]}]},[{id:'missing',selector:'#missing',property:'x',expected:0,tolerance:5}])[0].type,'structure');
const p={id:'reliability',name:'test',files:['value.cjs'],readFile:async()=> 'exports.value=0;'};
const request={conversationId:'test',prompt:'Modifie value.cjs pour corriger value.',modelId:'local',project:p,mode:'fast',allowChanges:true,signal};
const persistence={save:async()=>{},load:async()=>undefined};
let turns=0;
const result=await new CortexRuntime().run(request,{persistence,generate:async()=>({text:JSON.stringify({actions:++turns===1?[{type:'finish'}]:[{type:'replaceFile',path:'value.cjs',content:'exports.value=1;'}]})}),verify:async()=>[{type:'tests',status:'passed',success:true,output:'ok'}]});
assert.equal(result.task.phase,'completed');assert.equal(result.changes.length,1);assert.equal(turns,2);assert.equal(result.task.actionTrace.length,2);
let attempts=0;
const stalled=await new CortexRuntime().run(request,{persistence,generate:async()=>({text:JSON.stringify({actions:[{type:'replaceFile',path:'value.cjs',content:'exports.value=2;'}]})}),verify:async()=>[{...failure,output:failure.output.replace('AA',String(++attempts))}]});
assert.equal(stalled.task.phase,'paused');assert(attempts<=3);assert(stalled.task.steps<8);
const abort=new AbortController();const waiting=abortable(new Promise(()=>{}),abort.signal);abort.abort();await assert.rejects(waiting);
const cancel=new AbortController();const running=new CortexRuntime().run({...request,signal:cancel.signal},{persistence,generate:async()=>new Promise(()=>{})});
setTimeout(()=>cancel.abort(),20);await assert.rejects(running); // adapter deliberately ignores cancellation
const originalFetch=globalThis.fetch;let readerCancelled=false,streamProgress=0;
try {
 globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"message":{"content":"hello"},"done":false}\n'));},cancel(){readerCancelled=true;return new Promise(()=>{});}}));
 const stop=new AbortController();
 const chat=streamChat({provider:{id:'local',name:'local',protocol:'ollama',baseUrl:'http://127.0.0.1:11434'},model:'local',messages:[],effort:'low',vault:{get:async()=>null},signal:stop.signal,onDelta:()=>{},onProgress:()=>streamProgress++});
 setTimeout(()=>stop.abort(),20);await assert.rejects(chat);assert(readerCancelled);assert(streamProgress>0);
} finally {globalThis.fetch=originalFetch;}
console.log('cortex-v3.3.1: intent, assertion diffs, missing DOM, empty best, no-op stagnation, traces, non-cooperative cancellation — ok');
