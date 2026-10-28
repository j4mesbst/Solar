import assert from 'node:assert/strict';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { CORTEX_MODEL } from '../src/lib/cortex/types.ts';
import { analyzeIntent } from '../src/lib/agent/intent.ts';
import { normalChatContext, normalChatPolicy } from '../src/services/chatContext.ts';
import { routeSkills } from '../src/services/skillEngine.ts';
import { compactRepoMap, inspectSource } from '../src/lib/cortex/context.ts';
import { assessRender, repairMeasuredMotion, surgicalErrorFeedback } from '../src/lib/cortex/verification.ts';
import { normalizeProposedAction, stageAction } from '../src/lib/agent/actions.ts';
import { verifyModuleExports } from '../src/lib/agent/verification.ts';
import { mayPromoteStrategy, redact, routeAdapter } from '../src/lib/cortex/learning.ts';
import { visualPlan } from '../src/lib/cortex/visual-plan.ts';
import { localModelIdentity } from '../src/services/localModelIdentity.ts';

const sources = new Map([['src/value.ts','export const value = 0;\n'],['src/View.tsx','import {value} from "./value";\nexport const View=()=> <div>{value}</div>;'],['package.json','{"scripts":{"build":"tsc --noEmit"}}']]);
const project={id:'p',workspaceId:'stable-workspace',name:'Fixture',files:[...sources.keys()],readFile:async path=>sources.get(path)??''};
const saved=new Map();const persistence={save:async t=>saved.set(t.id,structuredClone(t)),load:async id=>structuredClone(saved.get(id))};
const request={conversationId:'c',prompt:'Modifie le fichier src/value.ts pour mettre value à 1.',modelId:CORTEX_MODEL,project,mode:'fast',allowChanges:true,signal:new AbortController().signal};
const patch={actions:[{type:'patchFile',path:'src/value.ts',oldText:'= 0',newText:'= 1'}]};
const passed=async()=>[{type:'build',status:'passed',success:true,output:'Compilateur fixture exécuté'}];

for(const text of ['salut','ça va déjà ?','merci beaucoup','et toi ?'.replace('et toi ?','ça va et toi ?')]) {
  assert(normalChatPolicy(text,'ultra',false).social,text);
  const context=normalChatContext([{role:'assistant',status:'completed',content:'Je vais préparer une présentation IA 2025.'},{role:'user',status:'completed',content:text}]);
  assert.equal(context.length,1);assert.equal(normalChatPolicy(text,'ultra',false).effort,'low');
  assert.equal(routeSkills({prompt:text,conversationContext:'Présentation : slides IA 2025'}).selected.length,0);
}
assert(!normalChatPolicy('Salut, explique ce code','medium',false).social);
assert(!routeSkills({prompt:'Corrige ce code React',conversationContext:'Crée une présentation avec huit slides.'}).selected.some(s=>s.skill.category==='presentation'));
assert(!normalChatPolicy('Pourquoi ?','medium',false).social);
assert.notEqual(analyzeIntent('Refactorise sumPositive dans src/value.cjs avec filter/reduce.').taskType,'question');
assert.equal(normalChatContext([{role:'user',status:'completed',content:'Parle de Saturne'},{role:'assistant',status:'completed',content:'Saturne a des anneaux.'},{role:'user',status:'completed',content:'Pourquoi ?'}]).length,3);
assert.equal(localModelIdentity({providerModelId:CORTEX_MODEL,capabilities:[]}).name,'Solar 9B');
assert.match(localModelIdentity({providerModelId:'hf.co/ornith-ai/Ornith-1.0-9B-GGUF:Q4_K_M',capabilities:[]}).name,/ancien/);
const node=inspectSource('src/View.tsx',sources.get('src/View.tsx'),project.files);assert(node.dependencies.includes('src/value.ts'));assert(node.symbols.includes('View'));
assert.match(compactRepoMap([node], 'modifie View', [], 1000), /View/);
assert.match(visualPlan('Crée une sidebar responsive avec animation et une capture de référence.'), /sidebar \+ contenu/);
assert.match(visualPlan('Crée une sidebar responsive avec animation et une capture de référence.'), /prefers-reduced-motion/);

// V3 anti-loop shield: an explicit create on an existing path is converted
// into an approval-gated replacement, not retried until the budget expires.
const normalized=await normalizeProposedAction({type:'createFile',path:'src/value.ts',content:'export const value = 2;\n'},project,new Map(),new AbortController().signal);
assert.equal(normalized.action.type,'replaceFile');assert.match(normalized.note,/normalisée/);
const symbolChanges=new Map();await stageAction({type:'replaceSymbol',path:'src/value.ts',symbol:'value',content:'export const value = 3'},project,symbolChanges,new AbortController().signal);assert.match(symbolChanges.get('src/value.ts').after,/= 3/);
await assert.rejects(stageAction({type:'replaceSymbol',path:'src/value.ts',symbol:'value',content:'export const value = 3',sourceHash:'stale'},project,new Map(),new AbortController().signal),/a changé/);
assert.match(surgicalErrorFeedback([{type:'build',status:'failed',success:false,output:'src/value.ts:4:8 TS2322: Type mismatch\nverbose trace'}]),/src\/value.ts:4:8/);
assert.match(repairMeasuredMotion('<html><head></head><body><button>Go</button></body></html>','opacity blur scale 400ms'),/data-cortex-motion-repair/);
assert(verifyModuleExports('src/value.cjs','const clamp=(value,min,max)=>Math.min(max,Math.max(min,value)); module.exports={clamp};').every(check=>check.success));
assert(verifyModuleExports('src/value.cjs','module.exports={clamp:(value,min,max)=>Math.min(max,Math.max(min,value))};').every(check=>check.success));
assert(verifyModuleExports('src/value.cjs','exports.sumPositive = xs => xs.filter(x=>x>0).reduce((a,b)=>a+b,0);').every(check=>check.success));
assert.match(verifyModuleExports('src/value.cjs','module.exports={clamp};').find(check=>!check.success).output,/clamp est exporté/);
assert(verifyModuleExports('src/value.ts','export const clamp=(value:number)=>value; export { clamp };').every(check=>check.success));

let proposals=[];let calls=0;
const result=await new CortexRuntime().run(request,{persistence,generate:async()=>{calls++;return{text:JSON.stringify(patch),stopReason:'stop'};},verify:passed,onProposal:async c=>{proposals=c;}});
assert.equal(result.task.phase,'completed');assert.equal(proposals.length,1);assert.equal(sources.get('src/value.ts'),'export const value = 0;\n');assert.equal(calls,1);
assert.equal(saved.get(result.task.id).phase,'completed');

// V3.1 production has no inherited task-wide step ceiling. Nine useful,
// distinct repairs exceed the former Fast budget (8) and still converge.
let longRunCalls=0, longRunChecks=0;
const longRun=await new CortexRuntime().run(request,{persistence,generate:async()=>{longRunCalls++;const from=longRunCalls-1,to=longRunCalls;return{text:JSON.stringify({actions:[{type:'patchFile',path:'src/value.ts',oldText:`= ${from}`,newText:`= ${to}`}]}),stopReason:'stop'};},verify:async()=>[{type:'build',status:++longRunChecks<9?'failed':'passed',success:longRunChecks>=9,output:`fixture étape ${longRunChecks}`}]});
assert.equal(longRun.task.phase,'completed');assert(longRun.task.steps>=9);assert(longRunChecks>=9);
assert(longRun.task.telemetry?.firstArtifactMs!==undefined);assert(longRun.task.telemetry?.firstVerificationMs!==undefined);assert(longRun.task.telemetry?.checkpoints>=9);

// A single stuck Ollama call is recoverable: the next atomic generation can
// complete without a global task timeout ending the task.
let timeoutThenPatch=0;
const recoveredTimeout=await new CortexRuntime().run(request,{persistence,generate:async()=>{if(!timeoutThenPatch++)throw Error('CORTEX_GENERATION_TIMEOUT: appel fixture');return{text:JSON.stringify(patch),stopReason:'stop'};},verify:passed});
assert.equal(recoveredTimeout.task.phase,'completed');assert.equal(timeoutThenPatch,2);

// An ordinary model stop with no work must not complete a task.
const incomplete=await new CortexRuntime().run({...request,limits:{maxAgentSteps:3}},{persistence,generate:async()=>({text:'{"actions":[{"type":"finish","message":"Done"}]}',stopReason:'stop'}),verify:passed});
assert.equal(incomplete.task.phase,'paused');assert(incomplete.task.issues.length);

// Token-limited JSON is continued before parsing/executing it.
let chunks=0;
const raw=JSON.stringify(patch),cut=raw.indexOf('newText');
const continued=await new CortexRuntime().run(request,{persistence,verify:passed,generate:async()=>({text:++chunks===1?raw.slice(0,cut):raw.slice(cut),stopReason:chunks===1?'length':'stop'})});
assert.equal(continued.task.phase,'completed');assert.equal(chunks,2);

// Tool-only completion is validated through the same action contract.
const tools=await new CortexRuntime().run(request,{persistence,verify:passed,generate:async()=>({text:'',stopReason:'tool_calls',toolCalls:[{name:'propose_actions',arguments:patch}]})});assert.equal(tools.task.phase,'completed');
const budget=await new CortexRuntime().run({...request,limits:{maxDurationMs:25}},{persistence,generate:(_,signal)=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}))});assert.equal(budget.task.phase,'paused');assert(saved.has(budget.task.id));

// A compiler failure is fed back to a new generation, using the current staged file.
let checks=0,repairs=0;
const repaired=await new CortexRuntime().run(request,{persistence,verify:async()=>[{type:'build',status:++checks===1?'failed':'passed',success:checks>1,output:checks===1?'TS2322 src/value.ts:1':'Typecheck passed'}],generate:async()=>({text:JSON.stringify(++repairs===1?patch:{actions:[{type:'patchFile',path:'src/value.ts',oldText:'= 1',newText:'= 2'},{type:'finish',message:'Fixed'}]}),stopReason:'stop'})});
assert.equal(repaired.task.phase,'completed');assert(repaired.changes[0].after.includes('= 2'));

// A paused checkpoint survives a new runtime; resume checks original file versions.
const paused=await new CortexRuntime().run({...request,limits:{maxAgentSteps:1},mode:'balanced'},{persistence,verify:async()=>[{type:'build',status:'unavailable',success:false,output:'Fixture sans compilateur'}],generate:async call=>({text:JSON.stringify(call.schema?.properties?.steps?{steps:['Change value']}:patch),stopReason:'stop'})});
assert.equal(paused.task.phase,'paused');
const resumed=await new CortexRuntime().run({...request,id:paused.task.id},{persistence,verify:passed,generate:async()=>({text:'{"actions":[{"type":"finish","message":"Ready"}]}',stopReason:'stop'})});
assert.equal(resumed.task.phase,'completed');
await assert.rejects(new CortexRuntime().run({...request,id:paused.task.id,project:{...project,workspaceId:'other'}},{persistence,generate:async()=>{throw Error('must not call')}}),/point de reprise/);

const unavailable=await new CortexRuntime().run(request,{persistence,generate:async()=>({text:JSON.stringify(patch),stopReason:'stop'})});assert.equal(unavailable.task.phase,'paused');assert(unavailable.checks.some(c=>c.status==='unavailable'));

let overflows=0;
const compacted=await new CortexRuntime().run(request,{persistence,verify:passed,generate:async()=>{if(++overflows===1)throw Error('input context length exceeds limit');return{text:JSON.stringify(patch),stopReason:'stop'};}});
assert.equal(compacted.task.phase,'completed');assert.equal(overflows,2);assert(compacted.task.events.some(e=>e.detail.includes('Contexte saturé')));
const explained=await new CortexRuntime().run({...request,prompt:'Explique le fichier src/View.tsx et ses imports.',allowChanges:false},{persistence,generate:async()=>({text:'View importe value et l’affiche.',stopReason:'stop'})});
assert.equal(explained.task.phase,'completed');assert.equal(explained.changes.length,0);

const controller=new AbortController();const runtime=new CortexRuntime();
const cancel=runtime.run({...request,signal:controller.signal},{persistence,generate:(_,signal)=>new Promise((_,reject)=>{signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});controller.abort();})});
await assert.rejects(cancel,/abort|cancel/i);assert([...saved.values()].some(t=>t.phase==='cancelled'));

let branch=0;
const candidates=await new CortexRuntime().run({...request,mode:'ultra',limits:{maxCandidateBranches:2}},{persistence,verify:passed,generate:async call=>({text:JSON.stringify(call.schema?.properties?.steps?{steps:['Update value']}:++branch%2?{actions:[{...patch.actions[0],newText:'= 1'}]}:{actions:[{type:'finish',message:'Verified'}]}),stopReason:'stop'})});
assert.equal(candidates.task.phase,'completed',JSON.stringify({issues:candidates.task.issues,candidates:candidates.task.candidates}));assert.equal(candidates.task.candidates.length,1);assert.equal(candidates.task.candidates[0].changes.length,1);

assert.equal(assessRender({supported:false,frames:[],errors:[],width:1,height:1},true)[0].status,'unavailable');
assert(redact('api_key=sk_123456789123456789 test@example.com').includes('[retiré]'));
assert.equal(routeAdapter([{taskType:'coding',modelId:'adapter',validated:true,path:'x'}],'coding',false),undefined);
const baseline={version:'1',benchmarkId:'fixed',rules:[],measurements:[{task:'a',passed:true,milliseconds:100}]};
assert(!mayPromoteStrategy(baseline,{...baseline,version:'2',measurements:[{task:'a',passed:false,milliseconds:1}]}));
console.log('cortex-contracts: ok (chat relevance, model identity, graph, continuation, tools, persistence, isolation, repair, cancellation, candidates, learning gates)');
