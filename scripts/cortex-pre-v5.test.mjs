import assert from 'node:assert/strict';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { fitContextPacket,rememberContext,recoverContext,taskContextPacket,validateContextCheckpoint } from '../src/lib/cortex/context-engine.ts';
import { fitModelPayload } from '../src/lib/cortex/budget.ts';
import { conversationRequirements,compactRequirements } from '../src/lib/cortex/conversation.ts';
import { generationDecision,failureClass } from '../src/lib/cortex/repair.ts';
import { sourceHash } from '../src/lib/cortex/semantic.ts';
import { cortexActionSchema,parseAgentResponse,stageAction } from '../src/lib/agent/actions.ts';
import { validateActionEnvelope } from '../src/lib/agent/schema.ts';
import { retrieveTrajectories } from '../src/lib/cortex/learning.ts';
import { parseTaskGraph,verifyTaskGraph } from '../src/lib/cortex/task-graph.ts';
import { createCortexBackend } from '../src/services/cortexBackend.ts';
import { verifyBehavior } from '../src/lib/cortex/behavior.ts';

const signal=new AbortController().signal;
const missingStyle=verifyBehavior({supported:true,frames:[{timestamp:0,elements:[],overflow:0,image:''}],interactions:[{selector:'#trigger',type:'click',success:true,observations:[{selector:'#missing',found:false}]}]},{interactions:[{type:'click',selector:'#trigger',expect:[{selector:'#missing',visible:false,style:{opacity:'0'}}]}]});
assert.equal(missingStyle[0].status,'failed','an absent element cannot prove a computed style even when absence itself is expected');
const persistence={save:async()=>{},load:async()=>undefined};
const task=()=>({version:1,id:'context-test',steps:1,prompt:'Corrige le calcul sans dépendance externe.',phase:'repairing',context:{files:[{path:'src/value.ts',sourceHash:sourceHash('original'),content:'original',score:10}]},plan:[],candidates:[],events:[]});
const candidate=()=>({id:'candidate',changes:[],checks:[],issues:[],attempts:0,finished:false});
const packet={version:1,objective:'Garde le clavier et la confidentialité.',requirements:'[message first] Ne contacte aucun service externe.',state:{phase:'repairing',unresolved:['original-result']},items:[{id:'source-a',category:'project',content:'line\n'.repeat(5000),priority:40,reference:'src/large.ts'},{id:'duplicate',category:'project',content:'line\n'.repeat(5000),priority:40,reference:'src/large.ts'},{id:'old',category:'history',content:'old '.repeat(5000),priority:1,reference:'checkpoint:old'}],next:'Corrige uniquement la fonction concernée.'};
const compact=fitContextPacket(packet,1600);
assert(compact.prompt.length<=1600);assert.match(compact.prompt,/Ne contacte aucun service externe/);assert.match(compact.prompt,/Garde le clavier/);assert.equal(compact.selection.deduplicated,1);assert(compact.selection.compacted.length+compact.selection.omitted.length>0);
assert.throws(()=>fitContextPacket({...packet,requirements:'Obligation distincte. '.repeat(500)},1000),/CORTEX_CONTEXT/);
const sameFiles=fitContextPacket({...packet,items:[{id:'a',reference:'a.ts',category:'project',content:'same bytes',hash:'same',priority:10},{id:'b',reference:'b.ts',category:'project',content:'same bytes',hash:'same',priority:20}]},5000);
assert.equal(sameFiles.selection.deduplicated,1);assert.deepEqual(sameFiles.selection.selected,['a','b']);assert.match(sameFiles.prompt,/a.ts/);assert.match(sameFiles.prompt,/b.ts/);
const fitted=fitModelPayload({prompt:'',context:packet,system:'Règles stables.',schema:{type:'object'},images:2,contextWindow:4096,outputTokens:900});
assert(fitted.serializedCharacters<=Math.floor((4096-fitted.reserveTokens)*2.3));assert(fitted.utf8Bytes>=fitted.serializedCharacters);assert.match(fitted.prompt,/Ne contacte aucun service externe/);
// A visual repair can accumulate many successful checks. Their verbose
// metadata is archival, not mandatory prompt text: the fitter must keep the
// user obligations while compacting state and optional sources first.
const visualPacket={...packet,state:{
  phase:'repairing',step:4,
  checks:Array.from({length:24},(_,i)=>({id:`check-${i}`,type:'visual',status:'passed',origin:'independent',output:'verbose measured evidence '.repeat(120)})),
  checkCounts:{passed:24,failed:0,unavailable:0},changes:[{path:'index.html',hash:'live'}],
  recoverableContext:Array.from({length:12},(_,i)=>({id:`ctx-${i}`,start:0,end:6000,hash:'hash',status:'observed'})),
  unresolved:Array.from({length:12},(_,i)=>({id:`ctx-${i}`,hash:'hash',characters:8000})),
},items:[...packet.items,{id:'must-keep',category:'observation',content:'Visual correction required.',priority:100,required:true,reference:'current-operation'}]};
const visualFit=fitModelPayload({prompt:'',context:visualPacket,system:'Règles stables.',schema:{type:'object',properties:{actions:{type:'array',items:{type:'object'}}}},images:1,contextWindow:4096,outputTokens:900});
assert.match(visualFit.prompt,/Ne contacte aucun service externe/);assert.match(visualFit.prompt,/Visual correction required/);assert(!visualFit.prompt.includes('verbose measured evidence'));assert(visualFit.selection?.compacted.some(id=>id.startsWith('state:')),'state must become a compact recoverable projection');
assert.throws(()=>fitModelPayload({prompt:'',context:{...visualPacket,requirements:'Contraintes indispensables. '.repeat(1000)},system:'Règles',images:1,contextWindow:4096,outputTokens:900}),/CORTEX_CONTEXT/,'mandatory requirements must fail visibly rather than truncate');
const history=conversationRequirements([{id:'u1',role:'user',content:'Pas de réseau.'},{id:'a1',role:'assistant',content:'Tout est validé'},{id:'u2',role:'user',content:'La couleur devient bleue.'}]);
assert.match(history,/Pas de réseau/);assert(!history.includes('Tout est validé'));
const replaced=conversationRequirements([{id:'u1',role:'user',content:'Couleur rouge.'},{id:'a1',role:'assistant',content:'Couleur noire.',supersedes:['u1']},{id:'u2',role:'user',content:'Couleur bleue.',supersedes:['u1']}]);
assert(!replaced.includes('rouge'));assert(replaced.includes('bleue'));
assert.equal(compactRequirements('Obligation A.\n\nObligation B.\n\nObligation A.'),'Obligation A.\n\nObligation B.');
const state=task(),original=rememberContext(state,{category:'observation',content:'Première ligne\nDeuxième ligne exacte\nTroisième ligne',origin:'independent',status:'failed',sources:{'src/value.ts':sourceHash('original')}});
assert.equal(rememberContext(state,{...original}).id,original.id);
const recovered=recoverContext(state,original.id,15,36,{'src/value.ts':sourceHash('original')});
assert.equal(recovered.content,original.content.slice(15,36));assert.equal(recovered.stale,false);
assert.throws(()=>recoverContext(state,original.id,15,36,{'src/value.ts':sourceHash('original')}),/identique/);
const stale=recoverContext(state,original.id,0,14,{'src/value.ts':sourceHash('changed')});assert.equal(stale.status,'historical-source-changed');
assert.throws(()=>recoverContext(state,'ctx-999-abc'),/introuvable/);
validateContextCheckpoint(state);
const tampered=structuredClone(state);tampered.contextArchive[0].content+='altered';assert.throws(()=>validateContextCheckpoint(tampered),/invalides/);
const current=candidate();current.checks=[{type:'tests',origin:'independent',status:'failed',output:'useful diagnostic'}];current.issues=['same diagnostic','same diagnostic'];
const structured=taskContextPacket(state,current,{requirements:history,guidance:'',memory:'conseil historique',next:'Répare le défaut observé.'});
assert.equal(structured.state.unresolved.length,1);assert.equal(structured.state.checks[0].origin,'independent');assert(structured.items.some(item=>item.status==='historical-source-changed'&&item.required));
const first=generationDecision(state,current,'guarded-edit');assert.equal(first.repeated,false);state.branch=2;assert.equal(generationDecision(state,current,'guarded-edit').repeated,true);
state.sourceReads=[{signature:'new-range',path:'src/value.ts',hash:'new',content:'new evidence'}];assert.equal(generationDecision(state,current,'guarded-edit').repeated,false);
assert.equal(failureClass([{status:'unavailable',hardConstraint:true}]),'environment');assert.equal(failureClass([],'CORTEX_ACTION_FORMAT: JSON'),'model-format');
validateActionEnvelope(JSON.stringify({actions:[{type:'readContext',id:original.id,start:0,end:14}]}),cortexActionSchema);
assert.throws(()=>parseAgentResponse(JSON.stringify({actions:[{type:'readContext',id:original.id,start:'wrong'}]})),/entier/);

const sources={'src/value.ts':'export const value = 0;','src/other.ts':'export const other = 0;'};
const project={id:'generic-workspace',name:'Generic',files:Object.keys(sources),readFile:async path=>sources[path]};
await assert.rejects(stageAction({type:'readFileRange',path:'src/value.ts',start:99,end:100},project,new Map(),signal),/hors fichier/);
const request={conversationId:'pre-v5',prompt:'Modifie src/value.ts pour corriger la valeur sans dépendance externe.',modelId:'user-selected-local',project,mode:'fast',allowChanges:true,signal};
const generated=actions=>({text:JSON.stringify({actions}),stopReason:'stop'});
const pass=()=>[{type:'build',status:'passed',success:true,output:'deterministic check'}];
let generations=0,verifications=0;const systems=[];
const recovery=await new CortexRuntime().run({...request,conversationRequirements:history},{persistence,generate:async call=>{
  generations++;systems.push(call.system);assert.match(call.prompt,/Pas de réseau/);
  if(generations===1)return generated([{type:'patchFile',path:'src/value.ts',oldText:'= 0',newText:'= 1'}]);
  if(generations===2){const ref=call.context.state.unresolved[0].id;return generated([{type:'readContext',id:ref,start:0,end:100}]);}
  assert(call.context.items.some(item=>item.id.startsWith('recovered:')&&item.content.length===100));
  return generated([{type:'patchFile',path:'src/value.ts',oldText:'= 1',newText:'= 2'}]);
},verify:async changes=>{verifications++;return changes[0].after.includes('= 2')?pass():[{type:'build',status:'failed',success:false,output:'Expected value 2. '+('diagnostic detail '.repeat(5000))}];}});
assert.equal(recovery.task.phase,'completed',JSON.stringify(recovery.task.issues));assert.equal(generations,3);assert.equal(verifications,2);assert(systems.every(system=>system===systems[0]));assert(recovery.task.calls.every(call=>call.context&&call.payloadBytes>0&&call.estimatedInputTokens>0));assert(recovery.task.calls.every(call=>call.tokensMeasured===false));
assert.equal(sources['src/value.ts'],'export const value = 0;');

let checks=0,modelCalls=0;
const outage=await new CortexRuntime().run(request,{persistence,generate:async()=>{modelCalls++;return generated([{type:'patchFile',path:'src/value.ts',oldText:'= 0',newText:'= 1'}]);},verify:async()=>{if(++checks===1)throw Error('temporary service outage');return pass();}});
assert.equal(outage.task.phase,'completed');assert.equal(modelCalls,1);assert.equal(checks,2);
const unavailable=await new CortexRuntime().run({...request,prompt:request.prompt+' Compile le projet.'},{persistence,generate:async()=>generated([{type:'patchFile',path:'src/value.ts',oldText:'= 0',newText:'= 1'}]),verify:async()=>{throw Error('compiler is not installed');}});
assert.equal(unavailable.task.phase,'paused');assert.equal(unavailable.changes.length,1);assert.equal(unavailable.task.generations,1);assert(!unavailable.checks.some(check=>check.status==='failed'));
const htmlRequest={...request,prompt:'Crée une page HTML dans index.html.',project:{id:'render-outage',name:'render-outage',files:['index.html'],readFile:async()=>'<html></html>'}};
const renderingOutage=await new CortexRuntime().run(htmlRequest,{persistence,generate:async()=>generated([{type:'replaceFile',path:'index.html',content:'<html><body><main>Prepared</main></body></html>'}]),verify:async()=>pass(),render:async()=>{throw Error('WebKit helper unavailable');}});
assert.equal(renderingOutage.task.phase,'paused');assert.equal(renderingOutage.changes.length,1);assert.equal(renderingOutage.task.generations,1);
const advisoryOutage=await new CortexRuntime().run(htmlRequest,{persistence,generate:async()=>({text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:'<html><body><main>Prepared</main></body></html>'}],validation:{expectations:[{selector:'#suggestion',visible:true}]}}),stopReason:'stop'}),verify:async()=>[{...pass()[0],renderReport:{supported:true,width:800,height:600,errors:[],frames:[{timestamp:0,image:'',overflow:0,elements:[]}]}}],render:async()=>{throw Error('Only the suggested capture is unavailable');}});
assert.equal(advisoryOutage.task.phase,'completed');assert(advisoryOutage.checks.some(check=>check.validatorId==='suggested-render'&&check.hardConstraint===false));
let count=0;
const stagnation=await new CortexRuntime().run(request,{persistence,generate:async()=>{count++;return generated([]);},verify:async()=>pass()});
assert.equal(stagnation.task.phase,'paused');assert(count<6);assert.match(stagnation.task.issues[0],/information|progrès/);
const denied=await new CortexRuntime().run({...request,allowChanges:false},{persistence,generate:async()=>generated([{type:'replaceFile',path:'src/value.ts',content:'forbidden'}])});
assert.equal(denied.changes.length,0);assert.equal(sources['src/value.ts'],'export const value = 0;');
let saved;
const durable={save:async value=>{saved=structuredClone(value);},load:async()=>structuredClone(saved)};
const paused=await new CortexRuntime().run({...request,conversationRequirements:history},{persistence:durable,generate:async()=>generated([{type:'patchFile',path:'src/value.ts',oldText:'= 0',newText:'= 1'}]),verify:async()=>[{type:'build',status:'unavailable',success:false,output:'Compiler unavailable'}]});
assert.match(saved.userRequirements,/Pas de réseau/);
const resumed=await new CortexRuntime().run({...request,id:paused.task.id},{persistence:durable,generate:async()=>{throw Error('No model generation needed on resume');},verify:async()=>pass()});
assert.equal(resumed.task.phase,'completed');assert.match(resumed.task.userRequirements,/Pas de réseau/);
let dependency=sources['src/other.ts'];
const concurrent=await new CortexRuntime().run({...request,project:{...project,readFile:async path=>path==='src/other.ts'?dependency:sources[path]}},{persistence,generate:async()=>generated([{type:'patchFile',path:'src/value.ts',oldText:'= 0',newText:'= 1'}]),verify:async()=>{dependency='export const other = 7;';return pass();}});
assert.equal(concurrent.task.phase,'paused');assert.equal(concurrent.changes.length,1);assert(concurrent.checks.some(check=>check.validatorId==='verification-source-drift'&&check.status==='unavailable'));
const tooLarge=await new CortexRuntime().run({...request,conversationRequirements:'Obligation unique. '.repeat(10000)},{persistence,generate:async()=>{throw Error('Overflow must be caught before generation');}});
assert.equal(tooLarge.task.phase,'paused');assert.match(tooLarge.task.issues[0],/CORTEX_CONTEXT/);
assert.equal(tooLarge.task.generations,0,'a fitting failure must not count as a provider invocation');assert.notEqual(tooLarge.task.calls.at(-1).providerAttempted,true);

const memory={id:'past',engineVersion:'4.1.0',workspaceId:project.id,modelKey:'weights-a',prompt:'Corrige le calcul valeur',paths:['src/value.ts'],evidence:['past check'],sourceFingerprints:{'src/value.ts':'same'}};
assert.match(retrieveTrajectories([memory],'Corrige le calcul valeur',project.id,{'src/value.ts':'same'},undefined,{modelKey:'weights-a'}),/Conseil historique/);
assert.equal(retrieveTrajectories([memory],'Corrige le calcul valeur',project.id,{'src/value.ts':'same'},undefined,{modelKey:'weights-b'}),'');
const graph=parseTaskGraph({steps:[{id:'first',objective:'Verify the value',files:['src/value.ts'],dependsOn:[],criteria:[{id:'check',kind:'check',target:'build'}]},{id:'second',objective:'Verify other',files:['src/other.ts'],dependsOn:['first'],criteria:[{id:'other',kind:'contains',target:'src/other.ts',value:'other'}]}]});
await verifyTaskGraph(graph,[],[{...pass()[0],validatorVersion:'1'}],project,signal);assert(graph.nodes.every(node=>node.status==='verified'));
await verifyTaskGraph(graph,[],[{type:'build',validatorVersion:'2',status:'failed',success:false,output:'Independent regression'}],project,signal);assert(graph.nodes.every(node=>node.status!=='verified'));
const originalFetch=globalThis.fetch;
try{
  let reportMetrics=true;
  globalThis.fetch=async()=>new Response(JSON.stringify({done:true,message:{content:'{"actions":[{"type":"finish","message":"ok"}]}'},...(reportMetrics?{total_duration:10_000_000,prompt_eval_count:12,prompt_eval_cached_count:5,prompt_eval_duration:2_000_000,eval_count:3,eval_duration:4_000_000}:{total_duration:0})})+'\n');
  const backend=createCortexBackend({provider:{id:'simulated',name:'Simulated',protocol:'ollama',baseUrl:'http://127.0.0.1:11434',enabled:true},vault:{get:async()=>null},conversationId:'metrics',modelId:'generic',contextWindow:8192,tools:false,vision:false,onVisible:()=>{}});
  const call={system:'Structured response.',prompt:'Test.',schema:{type:'object'},maxOutputTokens:200};
  const measured=await backend(call,signal);assert.equal(measured.metrics.promptCachedTokens,5);assert.equal(measured.metrics.decodeMs,4);assert.equal(measured.metrics.promptMs,2);assert.equal(measured.metrics.loadMs,undefined);
  reportMetrics=false;const missing=await backend(call,signal);assert.equal(missing.metrics.totalMs,0);assert.equal(missing.metrics.tokens,undefined);assert.equal(missing.metrics.promptCachedTokens,undefined);assert.equal(missing.metrics.decodeMs,undefined);
}finally{globalThis.fetch=originalFetch;}
console.log('Cortex pre-V5: protected obligations, exact compaction/recovery, stable rules, meaningful repair, preserved proposals, durable resume, memory identity and graph invalidation — PASS');
