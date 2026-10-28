import assert from 'node:assert/strict';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { initializeSemantic, sourceHash } from '../src/lib/cortex/semantic.ts';
import { normalizeProposedAction, stageAction } from '../src/lib/agent/actions.ts';
import { newModelExperience, modelExperienceKey, adaptivePolicy } from '../src/lib/cortex/adaptive.ts';
import { parseTaskGraph, graphComplete, verifyTaskGraph } from '../src/lib/cortex/task-graph.ts';
import { considerAlternative, dominates } from '../src/lib/cortex/search.ts';
import { retrieveTrajectories, trajectoryFromTask } from '../src/lib/cortex/learning.ts';
import { effectiveInspection, freezeBehavior, verifyBehavior } from '../src/lib/cortex/behavior.ts';
import { parseVisualValidation } from '../src/lib/agent/visual-validation.ts';
import { render } from './solar-bench/webkit.mjs';
import { isVisualObjective } from '../src/lib/cortex/router.ts';

const signal=new AbortController().signal;
const persistence={save:async()=>{},load:async()=>undefined};
const pass=()=>[{type:'build',validatorId:'build',status:'passed',success:true,output:'real service contract supplied by this deterministic test'}];
assert.equal(isVisualObjective('Corrige le calcul puis vérifie la suite.'),false);
assert.equal(isVisualObjective('Crée une interface User TypeScript avec id et name.'),false);
assert.equal(isVisualObjective('Crée une interface React avec une sidebar.'),true);
await initializeSemantic();
const source='export const value = 0; export function untouched() { return { text: "{" }; }';
const project={id:'v4-symbol',name:'v4-symbol',files:['src/value.ts'],readFile:async()=>source};
const edits=new Map();
await stageAction({type:'replaceSymbol',path:'src/value.ts',symbol:'value',content:'export const value = 1;',sourceHash:sourceHash(source)},project,edits,signal);
assert.equal(edits.get('src/value.ts').after,'export const value = 1; export function untouched() { return { text: "{" }; }');
await assert.rejects(stageAction({type:'replaceSymbol',path:'src/value.ts',symbol:'value',content:'export const value = 3;'}, {...project,readFile:async()=> 'const value = 0; function nested(){ const value = 2; }'},new Map(),signal),/ambigu/);
const normalized=await normalizeProposedAction({type:'replaceRange',path:'src/value.ts',start:1,end:1,content:source,sourceHash:'#'+sourceHash(source)},project,new Map(),signal);
assert.equal(normalized.action.sourceHash,sourceHash(source));

const facts={endpoint:'http://127.0.0.1:11434',modelId:'user-selected:30b',identity:'weights-a',contextWindow:4096,tools:true,vision:false};
const experience=newModelExperience(facts);experience.rejectedEdits=3;experience.validResponses=2;experience.toolFallbacks=1;
assert.equal(adaptivePolicy(experience,'ultra').maxActions,2,'legacy mixed error counts cannot shrink a coherent editing lot');
assert.equal(adaptivePolicy(experience,'ultra').preferJson,true);
assert.notEqual(modelExperienceKey(facts),modelExperienceKey({...facts,identity:'weights-b'}));
assert.notEqual(modelExperienceKey(facts),modelExperienceKey({...facts,endpoint:'http://other:11434'}));
let learnedSaved;
const profiled=await new CortexRuntime().run({conversationId:'profiled',prompt:'Modifie src/value.ts pour value à 1.',modelId:facts.modelId,modelFacts:facts,project,mode:'fast',allowChanges:true,signal},{persistence,
 loadModelExperience:async()=>experience,saveModelExperience:async profile=>{learnedSaved=profile;},
 generate:async call=>{assert.equal(call.preferJson,true);assert.equal(call.schema.properties.actions.maxItems,2);return{text:JSON.stringify({actions:[{type:'patchFile',path:'src/value.ts',oldText:'value = 0',newText:'value = 1'}]}),stopReason:'stop'};},verify:async()=>pass(),
});
assert.equal(profiled.task.phase,'completed');assert.equal(profiled.task.context.budget,4096);assert(learnedSaved.successfulEdits>0);
const remembered=trajectoryFromTask({...profiled.task,memorySourceFingerprints:{'package.json':'manifest-hash'}});
assert.equal(remembered.sourceFingerprints['package.json'],'manifest-hash');

const originals={'a.ts':'export const a = 0;','b.ts':'export const b = 0;'};
const graphProject={id:'v4-graph',name:'v4-graph',files:Object.keys(originals),readFile:async path=>originals[path]};
const graphInput={steps:[
 {id:'a',objective:'Mettre a à 1',files:['a.ts'],dependsOn:[],criteria:[{id:'a1',kind:'contains',target:'a.ts',value:'a = 1'},{id:'build-a',kind:'check',target:'build'}]},
 {id:'b',objective:'Mettre b à 1',files:['b.ts'],dependsOn:['a'],criteria:[{id:'b1',kind:'contains',target:'b.ts',value:'b = 1'},{id:'build-b',kind:'check',target:'build'}]},
]};
const graph=parseTaskGraph(graphInput);
assert.throws(()=>parseTaskGraph({steps:graphInput.steps.map(node=>({...node,dependsOn:[node.id]}))}),/Cycle/);
let graphCalls=0;const checkpoints=[];
const graphResult=await new CortexRuntime().run({conversationId:'graph',prompt:'Modifie les deux fichiers demandés.',modelId:'generic',project:graphProject,taskGraph:graph,mode:'fast',allowChanges:true,signal},{persistence:{save:async task=>checkpoints.push(structuredClone(task)),load:async()=>undefined},
 generate:async call=>{const name=++graphCalls===1?'a':'b';assert.match(call.prompt,new RegExp(`ÉTAPE ACTIVE DU GRAPHE : ${name}`));return{text:JSON.stringify({actions:[{type:'patchFile',path:`${name}.ts`,oldText:`${name} = 0`,newText:`${name} = 1`}]}),stopReason:'stop'};},verify:async()=>pass(),
});
assert.equal(graphResult.task.phase,'completed',JSON.stringify(graphResult.task.issues));assert.equal(graphCalls,2);assert(graphComplete(graphResult.task.taskGraph));
assert(checkpoints.some(task=>task.taskGraph.nodes[0].status==='verified'&&task.taskGraph.nodes[1].status==='active'));
const invalidated=structuredClone(graphResult.task.taskGraph);
await verifyTaskGraph(invalidated,[{path:'a.ts',before:originals['a.ts'],after:'export const a = 0;'}],pass(),graphProject,signal);
assert.equal(invalidated.nodes[0].status,'active');assert.equal(invalidated.nodes[1].status,'pending');
let planned=0,autoEdits=0;
const autoGraph=await new CortexRuntime().run({conversationId:'auto-graph',prompt:'Modifie ce projet complet dans plusieurs fichiers : a.ts puis b.ts.',modelId:'generic',project:{...graphProject,files:[...graphProject.files,...Array.from({length:6},(_,i)=>`extra-${i}.ts`)],readFile:async path=>originals[path]??'export const extra = 0;'},mode:'ultra',allowChanges:true,signal},{persistence,
 generate:async call=>{if(call.schema?.properties?.steps){planned++;return{text:JSON.stringify(graphInput),stopReason:'stop'};}const name=++autoEdits===1?'a':'b';return{text:JSON.stringify({actions:[{type:'patchFile',path:`${name}.ts`,oldText:`${name} = 0`,newText:`${name} = 1`}]}),stopReason:'stop'};},verify:async()=>pass(),
});
assert.equal(autoGraph.task.phase,'completed');assert.equal(planned,1);assert.equal(autoEdits,2);assert(graphComplete(autoGraph.task.taskGraph));

const large=Array.from({length:400},(_,i)=>`export const value${i} = 0;`).join('\n');
let readTurns=0;
const readThenEdit=await new CortexRuntime().run({conversationId:'read-context',prompt:'Corrige le calcul dans long.ts.',modelId:'generic',project:{id:'long',name:'long',files:['long.ts'],readFile:async()=>large},mode:'fast',allowChanges:true,signal,limits:{maxAgentSteps:4}},{persistence,
 generate:async call=>{readTurns++;if(readTurns<3)return{text:JSON.stringify({actions:[{type:'readFileRange',path:'long.ts',start:240,end:242}]}),stopReason:'stop'};
   assert.match(call.prompt,/value240 = 0/);assert.match(call.prompt,/LECTURE CIBLÉE/);
   return{text:JSON.stringify({actions:[{type:'patchFile',path:'long.ts',oldText:'value240 = 0',newText:'value240 = 1'}]}),stopReason:'stop'};
 },verify:async()=>pass(),
});
assert.equal(readThenEdit.task.phase,'completed',JSON.stringify(readThenEdit.task.issues));assert.equal(readTurns,3);assert.equal(readThenEdit.task.sourceReads.length,1);

const failed={id:'bad',changes:[{path:'a.ts',before:'0',after:'1'}],checks:[{type:'tests',validatorId:'assertion',status:'failed',success:false,output:'expected 2, observed 1'}],issues:['expected 2'],attempts:1,finished:false};
const searchTask={repairMemory:{noProgress:2},modelId:'generic'};
const alternatives=[];
for(let i=0;i<8;i++){const next=considerAlternative(searchTask,failed);if(next)alternatives.push(next);}
assert.equal(alternatives.length,4);assert.equal(alternatives.at(-1).exhausted,true);assert.deepEqual(searchTask.solutionSearch.active.strategy,'alternative');
assert.equal(dominates(failed,{...failed,checks:[{...failed.checks[0],status:'passed',success:true}]}),true);
assert.equal(dominates({...failed,checks:[{...failed.checks[0],status:'passed',success:true}]},failed),false);
const trajectory={id:'memory-1',engineVersion:'4.1.0',workspaceId:'workspace',prompt:'Corrige le calcul du panier et des taxes',paths:['a.ts'],evidence:['Assertions indépendantes réussies'],sourceFingerprints:{'a.ts':sourceHash('approved code')},successfulRepairs:['Réparer le calcul de taxe']};
assert.match(retrieveTrajectories([trajectory],'Corrige le calcul des taxes du panier','workspace',{'a.ts':sourceHash('approved code')}),/memory-1/);
assert.equal(retrieveTrajectories([trajectory],'Corrige le calcul des taxes du panier','workspace',{'a.ts':sourceHash('new code')}),'');
assert.equal(retrieveTrajectories([trajectory],'Corrige le calcul des taxes du panier','other',{'a.ts':sourceHash('approved code')}),'');

const validation=parseVisualValidation({interactions:[
 {selector:'#toggle',type:'click',expect:[{selector:'.output',text:'Ouvert',visible:true},{selector:'#toggle',attribute:{name:'aria-expanded',value:'true'}}]},
 {selector:'#toggle',type:'click',expect:[{selector:'.output',text:'Fermé',visible:false},{selector:'#toggle',attribute:{name:'aria-expanded',value:'false'}}]},
],expectations:[{selector:'.output',visible:false}]});
assert.throws(()=>freezeBehavior(validation,{expectations:[{selector:'.output',visible:true}]}),/déjà fixé/);
assert.deepEqual(freezeBehavior({expectations:[{selector:'#panel',visible:true,text:'Ready'}]},{expectations:[{text:'Ready',visible:true,selector:'#panel'}]}),{expectations:[{selector:'#panel',visible:true,text:'Ready'}]});
assert.equal(effectiveInspection({interactions:[{selector:'#original',type:'click'}],reducedMotion:false},{interactions:[{selector:'#replacement',type:'click'}],reducedMotion:true}).interactions[0].selector,'#original');
assert.equal(effectiveInspection(undefined,{reducedMotion:true}).reducedMotion,false);
assert.throws(()=>parseVisualValidation({interactions:[{selector:'#toggle',type:'click',value:'Tab'}]}),/clavier/);
const html='<!doctype html><html><head><meta charset="utf-8"></head><body><button id="toggle" aria-expanded="false">Ouvrir</button><section class="output" hidden>Fermé</section><script>const b=document.querySelector("#toggle"),p=document.querySelector(".output");b.onclick=()=>{p.hidden=!p.hidden;p.textContent=p.hidden?"Fermé":"Ouvert";b.setAttribute("aria-expanded",String(!p.hidden))}</script></body></html>';
const report=await render(html,[0],signal,undefined,effectiveInspection(undefined,validation));
const behavior=verifyBehavior(report,effectiveInspection(undefined,validation));
assert.equal(behavior.length,5);assert(behavior.every(check=>check.success),JSON.stringify(behavior));
assert.equal(report.interactions[0].observations.find(item=>item.selector==='.output').text,'Ouvert');
assert.equal(report.interactions[1].observations.find(item=>item.selector==='.output').text,'Fermé');
assert(report.frames[0].elements.find(item=>item.aliases?.includes('.output')));

// Real WebKit feedback drives a second generation; changing the expectation
// is forbidden and dispatching a click alone must never count as success.
const simpleValidation={interactions:[{selector:'#toggle',type:'click',expect:[{selector:'.output',text:'Ouvert',visible:true}]}]};
let visualCalls=0;
const repaired=await new CortexRuntime().run({conversationId:'v4-behavior',prompt:'Crée une interface avec un bouton qui ouvre le panneau.',inspection:simpleValidation,modelId:'generic',project:{id:'v4-behavior',name:'v4-behavior',files:['index.html'],readFile:async()=>'<html></html>'},mode:'ultra',allowChanges:true,signal},{persistence,
 generate:async call=>{visualCalls++;if(visualCalls===1)assert(!call.schema.required.includes('validation'));if(visualCalls===2)assert.match(call.prompt,/VALIDATION FONCTIONNELLE/);return{text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:visualCalls===1?html.replace(/<script>[\s\S]*?<\/script>/,''):html}]}),stopReason:'stop'};},
 verify:async(changes,childSignal,_id,options)=>[{type:'build',status:'passed',success:true,output:'HTML autonome',renderReport:await render(changes[0].after,[0],childSignal,undefined,options)}],
});
assert.equal(repaired.task.phase,'completed',JSON.stringify(repaired.task.issues));assert.equal(visualCalls,2);
assert(repaired.checks.some(check=>check.validatorId?.startsWith('behavior:')&&check.success));

// An independent verifier may intentionally ignore model-supplied scenarios.
// Its baseline observations must not be mistaken for missing DOM or rewritten.
let supplementalRenders=0;
const externalScenario=await new CortexRuntime().run({conversationId:'independent-scenario',prompt:'Crée une interface avec un bouton qui ouvre le panneau.',modelId:'generic',project:{id:'external',name:'external',files:['index.html'],readFile:async()=>'<html></html>'},mode:'ultra',allowChanges:true,signal},{persistence,
 generate:async()=>({text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:html}],validation:simpleValidation}),stopReason:'stop'}),
 verify:async changes=>{supplementalRenders++;return[{type:'build',status:'passed',success:true,output:'Independent baseline',renderReport:await render(changes[0].after,[0],signal)}];},
 render:async(...args)=>{supplementalRenders++;return render(...args);},
});
assert.equal(externalScenario.task.phase,'completed',JSON.stringify(externalScenario.task.issues));assert.equal(supplementalRenders,2);
assert(externalScenario.checks.some(check=>check.validatorId?.startsWith('behavior:')&&check.success));
const missingAdapter=await new CortexRuntime().run({conversationId:'unavailable-scenario',prompt:'Crée une interface avec un bouton qui ouvre le panneau.',modelId:'generic',project:{id:'unavailable',name:'unavailable',files:['index.html'],readFile:async()=>'<html></html>'},mode:'ultra',allowChanges:true,signal},{persistence,
 generate:async()=>({text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:html}],validation:simpleValidation}),stopReason:'stop'}),
 verify:async changes=>[{type:'build',status:'passed',success:true,output:'Independent baseline',renderReport:await render(changes[0].after,[0],signal)}],
});
assert.equal(missingAdapter.task.phase,'completed');assert.equal(missingAdapter.task.generations,1);
assert(missingAdapter.checks.some(check=>check.validatorId==='behavior-capture'&&check.status==='unavailable'&&check.hardConstraint===false));

// Standalone HTML is not doubly encoded with its behavioral scenario. Even a
// length-stopped response is safe only if the entire explicit file is present.
let documentCalls=0;
const standaloneProject={id:'standalone',name:'standalone',files:['index.html'],readFile:async()=>'<html></html>'};
const standaloneRequest={conversationId:'standalone',prompt:'Crée dans index.html une interface avec un bouton qui ouvre le panneau.',modelId:'generic',project:standaloneProject,mode:'ultra',allowChanges:true,signal};
const standaloneServices={persistence,
 render,
 generate:async call=>{documentCalls++;if(documentCalls===1){assert.equal(call.schema,undefined);return{text:'```html index.html\n'+html+'\n```',stopReason:'length'};}assert(call.schema.required.includes('interactions'));assert.match(call.prompt,/#toggle/);return{text:JSON.stringify(simpleValidation),stopReason:'stop'};},
 verify:async(changes,childSignal,_id,options)=>[{type:'build',status:'passed',success:true,output:'HTML autonome',renderReport:await render(changes[0].after,[0],childSignal,undefined,options)}],
};
const standalone=await new CortexRuntime().run(standaloneRequest,standaloneServices);
assert.equal(standalone.task.phase,'completed',JSON.stringify(standalone.task.issues));assert.equal(documentCalls,2);assert.equal(standalone.task.pendingOutput,undefined);assert.equal(standalone.changes[0].after,html);
assert(standalone.checks.some(check=>check.validatorId?.startsWith('behavior:')&&check.success));
let jsonDocumentCalls=0;
const jsonDocument=await new CortexRuntime().run({...standaloneRequest,conversationId:'json-document'},{...standaloneServices,
 generate:async()=>++jsonDocumentCalls===1?{text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:html}],validation:{}}),stopReason:'stop'}:{text:JSON.stringify(simpleValidation),stopReason:'stop'},
});
assert.equal(jsonDocument.task.phase,'completed',JSON.stringify(jsonDocument.task.issues));assert.equal(jsonDocumentCalls,1);assert.equal(jsonDocument.task.behaviorValidation.interactions,undefined);
let contractCalls=0,storedTask;
const resumablePersistence={save:async task=>{storedTask=structuredClone(task);},load:async()=>structuredClone(storedTask)};
const failedContract=await new CortexRuntime().run({...standaloneRequest,conversationId:'contract-retry'},{...standaloneServices,persistence:resumablePersistence,
 generate:async()=>++contractCalls===1?{text:'```html index.html\n'+html+'\n```',stopReason:'stop'}:{text:'{}',stopReason:'stop'},
});
assert.equal(failedContract.task.phase,'completed');assert.equal(failedContract.changes[0].after,html);assert.equal(failedContract.task.pendingBehavior,false);
assert.equal(contractCalls,2);assert(failedContract.checks.some(check=>check.validatorId==='behavior-contract'&&check.hardConstraint===false));
let partialCalls=0,partialChecks=0;
const partial=await new CortexRuntime().run({...standaloneRequest,conversationId:'partial-document',limits:{maxAgentSteps:1}},{...standaloneServices,
 generate:async()=>{partialCalls++;return{text:'```html index.html\n<html><body>incomplete',stopReason:'length'};},verify:async()=>{partialChecks++;return pass();},
});
assert.equal(partialCalls,1);assert.equal(partial.changes.length,0);assert.equal(partialChecks,0);assert.equal(partial.task.pendingOutput,undefined);

// Real account-scoped persistence: model observations cannot cross accounts,
// and clearing memory also clears the learned transport/profile decisions.
const {cortexStore}=await import('../src/services/cortexStore.ts');
const {initializeAccountScope}=await import('../src/services/accountScope.ts');
const previousStorage=globalThis.localStorage,storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
try{
 initializeAccountScope('account-a');await cortexStore.saveModelExperience(experience);assert((await cortexStore.modelExperience(experience.key)));
 initializeAccountScope('account-b');assert.equal(await cortexStore.modelExperience(experience.key),undefined);
 initializeAccountScope('account-a');await cortexStore.clearMemory();assert.equal(await cortexStore.modelExperience(experience.key),undefined);
}finally{initializeAccountScope();globalThis.localStorage=previousStorage;}
const {inspectModelCapabilities}=await import('../src/services/cortexNative.ts');
const originalFetch=globalThis.fetch;let digest='weights-a';
try{
 globalThis.fetch=async url=>new Response(JSON.stringify(String(url).endsWith('/api/tags')?{models:[{name:'generic:30b',digest}]}:{capabilities:['tools','vision'],model_info:{'family.context_length':32768},template:'same-template'}));
 const before=await inspectModelCapabilities('http://127.0.0.1:11434','generic:30b',signal);digest='weights-b';
 const after=await inspectModelCapabilities('http://127.0.0.1:11434','generic:30b',signal);
 assert.notEqual(before.identity,after.identity);assert.equal(after.contextLength,32768);assert.equal(after.vision,true);
}finally{globalThis.fetch=originalFetch;}
console.log('cortex-v4: AST-safe edit, adaptive model profile, dependency graph/invalidation, verified alternatives, versioned memory and real WebKit per-action assertions/repair — ok');
