import assert from 'node:assert/strict';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { parseVisualValidation,visualValidationSchema } from '../src/lib/agent/visual-validation.ts';
import { verifyBehavior } from '../src/lib/cortex/behavior.ts';
import { identifyChecks,verificationExperience,checkKey } from '../src/lib/cortex/experience.ts';
import { regressions } from '../src/lib/cortex/evidence.ts';
import { initializeSemantic,semanticSource,sourceHash } from '../src/lib/cortex/semantic.ts';
import { stageAction } from '../src/lib/agent/actions.ts';
import { verifyStagedChanges } from '../src/lib/agent/verification.ts';
import { resolveLocalImport } from '../src/lib/agent/module-resolution.ts';
import { newModelExperience,recordModelError,adaptivePolicy } from '../src/lib/cortex/adaptive.ts';
import { VerificationCache,verificationSources } from '../src/lib/cortex/verification-cache.ts';
import { recoverFileArtifact } from '../src/lib/cortex/structured.ts';
import { validateActionEnvelope,validateSchema } from '../src/lib/agent/schema.ts';
import { cortexActionSchema,cortexRepairSchema } from '../src/lib/agent/actions.ts';
import { fitModelPayload } from '../src/lib/cortex/budget.ts';
import { conversationRequirements } from '../src/lib/cortex/conversation.ts';
import { retrieveTrajectories } from '../src/lib/cortex/learning.ts';
import { initializeAccountScope } from '../src/services/accountScope.ts';
import { projectConsentKey,projectConsentScope } from '../src/services/projectConsent.ts';
import { analyzeIntent } from '../src/lib/agent/intent.ts';

const signal=new AbortController().signal;
const persistence={save:async()=>{},load:async()=>undefined};
const pass=()=>[{type:'build',validatorId:'build',status:'passed',success:true,output:'deterministic verifier'}];
const report=(elements=[],interactions=[])=>({supported:true,width:800,height:600,errors:[],frames:[{timestamp:0,image:'',overflow:0,elements}],interactions});
const candidate=checks=>({id:'test',changes:[],checks,issues:[],finished:false,attempts:0});
const original='<html><body><button id="toggle">Toggle</button><dialog id="dialog"></dialog></body></html>';
const request={conversationId:'v41',prompt:'Crée une interface dans index.html.',modelId:'generic-local',project:{id:'isolated',name:'isolated',files:['index.html'],readFile:async()=>'<html></html>'},mode:'fast',allowChanges:true,signal,limits:{maxAgentSteps:3}};
const generated=actions=>({text:JSON.stringify({actions}),stopReason:'stop'});
const replace={type:'replaceFile',path:'index.html',content:original};

assert.equal(visualValidationSchema.properties.interactions.items.oneOf[0].additionalProperties,false);
assert.throws(()=>parseVisualValidation({interactions:[{type:'click',selector:'#x',value:'oops'}]}),/réservé/);
assert.throws(()=>parseVisualValidation({interactions:[{type:'fill',selector:'#x'}]}),/préciser/);
const dom=(tag,attributes={},extra={})=>({selector:'#target',found:true,tag,attributes,...extra});
const behavioral=(expect,observed,origin)=>verifyBehavior(report([], [{selector:'#toggle',success:true,type:'click',observations:[observed]}]),{interactions:[{type:'click',selector:'#toggle',expect:[{selector:'#target',...expect}]}]},origin)[0];
assert.equal(behavioral({attribute:{name:'open',present:true}},dom('dialog',{open:''})).status,'passed');
assert.equal(behavioral({attribute:{name:'open',present:false}},dom('dialog')).status,'passed');
assert.equal(behavioral({attribute:{name:'open',present:false}},dom('dialog',{open:''})).status,'failed');
assert.equal(behavioral({attribute:{name:'open',value:'true'}},dom('dialog',{open:''}),'model-suggestion').status,'unavailable');
assert.equal(behavioral({text:'Ready'},dom('button',{}, {text:'Ready',value:''})).status,'passed');
assert.equal(behavioral({value:'Ready'},dom('input',{}, {text:'',value:'Ready'})).status,'passed');
assert.equal(behavioral({value:'Ready'},dom('div',{}, {text:'Ready',value:''}),'model-suggestion').hardConstraint,false);
assert.equal(behavioral({text:'Ready'}, {selector:'#target',found:false}).status,'failed');
assert.equal(behavioral({style:{opacity:'1'}},dom('div',{}, {styles:{opacity:'1'}})).status,'passed');

const desktop=verificationExperience({'index.html':'a'},{viewport:{width:1280,height:800}},'engine-a');
const mobile=verificationExperience({'index.html':'a'},{viewport:{width:390,height:800}},'engine-a');
const check={...pass()[0],validatorId:'position'};
assert.notEqual(checkKey({...check,experience:desktop}),checkKey({...check,experience:mobile}));
const duplicates=identifyChecks([check,{...check,status:'failed',success:false}],desktop);
assert.notEqual(checkKey(duplicates[0]),checkKey(duplicates[1]));assert(duplicates.every(c=>c.comparable===false));
assert.deepEqual(regressions(candidate(duplicates),candidate(duplicates)),[]);

// An invalid suggested scenario cannot discard a valid transaction or turn an
// independent pass into failure. Its diagnostic remains visible.
const invalid=await new CortexRuntime().run(request,{persistence,generate:async()=>({text:JSON.stringify({actions:[replace],validation:{interactions:[{type:'click',selector:'#toggle',value:'bad'}]}}),stopReason:'stop'}),verify:async()=>pass(),render:async()=>report()});
assert.equal(invalid.task.phase,'completed');assert.equal(invalid.changes[0].after,original);assert.match(invalid.task.visualAdvice.join(' '),/Auto-test ignoré/);
// Non-visual code never receives DOM options even if the model suggests them.
let cjsOptions;
const pure=await new CortexRuntime().run({...request,prompt:'Modifie src/number.cjs pour exporter 1.',project:{id:'cjs',name:'cjs',files:['src/number.cjs'],readFile:async()=> 'module.exports = 0;'}},{persistence,generate:async()=>({text:JSON.stringify({actions:[{type:'replaceFile',path:'src/number.cjs',content:'module.exports = 1;'}],validation:{expectations:[{selector:'#imaginary',visible:true}]}}),stopReason:'stop'}),verify:async(_changes,_s,_id,options)=>{cjsOptions=options;return pass();}});
assert.equal(pure.task.phase,'completed');assert.equal(cjsOptions,undefined);assert.equal(pure.task.behaviorValidation,undefined);
// A real independent DOM defect stays blocking, whatever the model claims.
const missing=await new CortexRuntime().run({...request,limits:{maxAgentSteps:1}},{persistence,generate:async()=>generated([replace]),verify:async()=>[{type:'structure',validatorId:'required-dom',status:'failed',success:false,output:'DOM requis : target absent'}],render:async()=>report()});
assert.equal(missing.task.phase,'paused');assert(missing.checks.some(c=>c.validatorId==='required-dom'&&c.status==='failed'));

const prefixes=[];
const transitions=await new CortexRuntime().run(request,{persistence,generate:async()=>({text:JSON.stringify({actions:[replace],validation:{interactions:[{type:'click',selector:'#toggle',expect:[{selector:'#target',text:'open'}]},{type:'click',selector:'#toggle',expect:[{selector:'#target',text:'closed'}]}]}}),stopReason:'stop'}),
 verify:async()=>[{...pass()[0],renderReport:report()}],render:async(_html,_times,_signal,_ref,options)=>{prefixes.push(options.interactions.length);return report([],options.interactions.map((action,i)=>({selector:action.selector,type:action.type,success:true,observations:[dom('div',{}, {text:i===0?'open':'closed'})]})));}});
assert.deepEqual(prefixes,[1,2]);assert.equal(transitions.task.phase,'completed');
assert(transitions.checks.filter(c=>c.origin==='model-suggestion').every(c=>c.hardConstraint===false));
console.log('Cortex V4.1 A: provenance, typed DOM, invalid model oracles, independent defects and isolated transitions — PASS');

await initializeSemantic();
const cjs='exports.convert = value => value + 1;\nexports.other = 7;';
const symbols=semanticSource('src/util.cjs',cjs).symbols;
assert(symbols.find(s=>s.name==='convert').startOffset!==undefined);
const edits=new Map();
await stageAction({type:'replaceSymbol',path:'src/util.cjs',symbol:'convert',content:'exports.convert = value => value + 2;',sourceHash:sourceHash(cjs)},{id:'symbol',name:'symbol',files:['src/util.cjs'],readFile:async()=>cjs},edits,signal);
assert.equal(edits.get('src/util.cjs').after,'exports.convert = value => value + 2;\nexports.other = 7;');
const duplicate='exports.convert = x => x; exports.convert = x => x + 1;';
await assert.rejects(stageAction({type:'replaceSymbol',path:'src/util.cjs',symbol:'convert',content:'exports.convert = x => 1;',sourceHash:sourceHash(duplicate)},{id:'ambiguous',name:'ambiguous',files:['src/util.cjs'],readFile:async()=>duplicate},new Map(),signal),/ambigu/);
assert.equal(resolveLocalImport('src/main.cjs','./helper',['src/helper.cjs'],'cjs').target,undefined);
assert.equal(resolveLocalImport('src/main.cjs','./helper.cjs',['src/helper.cjs'],'cjs').target,'src/helper.cjs');
assert.equal(resolveLocalImport('src/main.cjs','./helper',['src/helper.js'],'cjs').target,'src/helper.js');
assert.equal(resolveLocalImport('src/main.mjs','./helper',['src/helper.js'],'esm').target,undefined);
assert.equal(resolveLocalImport('src/main.ts','./helper',['src/helper.ts'],'bundler').target,'src/helper.ts');
const imports=await verifyStagedChanges([{path:'src/main.cjs',before:'',after:"module.exports = require('./helper');"}],{files:[],estimatedTokens:0,budget:8192},['src/helper.cjs'],signal);
assert(imports.some(c=>c.type==='imports'&&!c.success&&c.file==='src/main.cjs'&&c.output.includes('résolutions tentées')));
const profile=newModelExperience({endpoint:'local',modelId:'generic'});
recordModelError(profile,'parsing');recordModelError(profile,'parsing');recordModelError(profile,'transport');
assert.equal(profile.rejectedEdits,0);assert.equal(profile.errors.parsing,2);assert.equal(adaptivePolicy(profile,'ultra').maxActions,2);

const codeSources={'a.ts':'export const a = 0;','b.ts':'export const b = 0;'};
const codeProject={id:'batch',name:'batch',files:Object.keys(codeSources),readFile:async path=>codeSources[path]};
const batchRequest={...request,prompt:'Modifie a.ts et b.ts.',project:codeProject};
const inert=await new CortexRuntime().run(batchRequest,{persistence,generate:async()=>generated([{type:'replaceFile',path:'a.ts',content:codeSources['a.ts']},{type:'patchFile',path:'b.ts',oldText:'= 0',newText:'= 1'}]),verify:async()=>pass()});
assert.equal(inert.task.phase,'completed');assert.equal(inert.changes.length,1);assert.equal(inert.changes[0].path,'b.ts');
let failedSnapshot;
const rejected=await new CortexRuntime().run({...request,limits:{maxAgentSteps:1}},{persistence:{...persistence,save:async task=>{failedSnapshot=task;}},generate:async()=>({text:JSON.stringify({actions:[replace,{type:'patchFile',path:'index.html',oldText:'absent-marker',newText:'no'}],validation:{expectations:[{selector:'#bad',visible:true}]}}),stopReason:'stop'}),verify:async()=>pass()});
assert.equal(rejected.changes.length,0);assert.equal(failedSnapshot.behaviorValidation,undefined);assert.equal(failedSnapshot.bestCandidate,undefined);
const page='<html><head><style>main { color: red; }</style></head><body><main>before</main></body></html>';
let structuralTurns=0;
const composed=await new CortexRuntime().run({...request,prompt:'Corrige le DOM dans index.html.',project:{...request.project,readFile:async()=>page}},{persistence,generate:async()=>++structuralTurns===1?generated([{type:'patchFile',path:'index.html',oldText:'before',newText:'initial'}]):generated([{type:'patchFile',path:'index.html',oldText:'<main>',newText:'<main id="required">'},{type:'patchFile',path:'index.html',oldText:'color: red',newText:'color: blue'}]),verify:async changes=>changes[0].after.includes('id="required"')?pass():[{type:'structure',status:'failed',success:false,output:'DOM requis : cible absente'}],render:async()=>report()});
assert.equal(composed.task.phase,'completed',JSON.stringify(composed.task.issues));assert.match(composed.changes[0].after,/color: blue/);assert.match(composed.changes[0].after,/id="required"/);

const cache=new VerificationCache();let actualChecks=0,env='compiler-v1';
const cached=async changes=>{const sources=await verificationSources(codeProject,changes,signal),key=cache.key(sources,{env,viewport:800});let value=cache.get(key);if(!value){actualChecks++;value=pass();cache.set(key,value);}return value;};
await cached([]);await cached([]);assert.equal(actualChecks,1);
await cached([{path:'a.ts',before:codeSources['a.ts'],after:'export const a = 2;'}]);assert.equal(actualChecks,2);
env='compiler-v2';await cached([]);assert.equal(actualChecks,3);
codeSources['b.ts']='export const b = 9;';await cached([]);assert.equal(actualChecks,4);
console.log('Cortex V4.1 B/C: coherent no-op/CSS batches, full rollback, CommonJS AST, mode-aware imports, error profiles and dependency/config invalidation — PASS');

let reuseCalls=0,reuseVerifications=0;
const reuse=await new CortexRuntime().run({...batchRequest,prompt:'Modifie a.ts pour corriger la valeur.'},{persistence,generate:async()=>generated(++reuseCalls===2?[{type:'runTests'}]:[{type:'patchFile',path:'a.ts',oldText:reuseCalls===1?'= 0':'= 1',newText:reuseCalls===1?'= 1':'= 2'}]),verify:async()=>++reuseVerifications===1?[{type:'build',status:'failed',success:false,output:'value expected 2'}]:pass()});
assert.equal(reuse.task.phase,'completed',JSON.stringify(reuse.task.issues));assert.equal(reuseCalls,3);assert.equal(reuseVerifications,2);assert(reuse.task.events.some(e=>e.detail.startsWith('Résultat réutilisé')));
assert(reuse.task.calls.every(c=>c.status==='completed'&&c.durationMs>=0));assert(reuse.task.calls.every(c=>c.tokens===undefined));assert(reuse.task.actionTrace.every(t=>!t.response.includes('oldText')));

const complete='<!doctype html><html><head></head><body>Complete</body></html>';
assert(recoverFileArtifact('```html index.html\n'+complete,['index.html'],{standaloneHtml:true}));
assert(recoverFileArtifact(complete,['index.html'],{standaloneHtml:true}));
assert.equal(recoverFileArtifact('```html index.html\n<html><body>partial',['index.html'],{standaloneHtml:true}),undefined);
assert.equal(recoverFileArtifact('```html wrong.html\n'+complete,['index.html'],{standaloneHtml:true}),undefined);
assert.equal(recoverFileArtifact('```html index.html\n'+complete,['index.html']),undefined);
validateActionEnvelope(JSON.stringify({actions:[{type:'runTests'}]}),cortexActionSchema);
assert.throws(()=>validateActionEnvelope(JSON.stringify({actions:[{type:'replaceFile',path:'a.ts',oldText:'0',newText:'1'}]}),cortexRepairSchema),/CORTEX_ACTION_FORMAT/);
assert(validateSchema({interactions:[{type:'click',selector:'#a',value:'illegal'}]},visualValidationSchema).length);
assert.throws(()=>validateActionEnvelope(JSON.stringify({actions:[{type:'runCommand',command:'anything'}]}),cortexActionSchema),/CORTEX_ACTION_FORMAT/);
const fitted=fitModelPayload({prompt:'OBJECTIF\nKeep keyboard and privacy.\nFICHIER a.ts\n'+'source '.repeat(3000)+'\nFIN FICHIER a.ts',system:'Safety instructions.',schema:cortexActionSchema,contextWindow:8192,outputTokens:2200});
assert.match(fitted.prompt,/Keep keyboard and privacy/);assert.match(fitted.prompt,/Source omise/);
assert.throws(()=>fitModelPayload({prompt:'Current goal',system:'Mandatory constraint '.repeat(3000),contextWindow:4096,outputTokens:1200}),/CORTEX_CONTEXT/);
const history=conversationRequirements([{id:'u1',role:'user',content:'No external dependency; keyboard support is required.'},{id:'a1',role:'assistant',content:'Claimed success'}]);
assert.match(history,/message u1/);assert.match(history,/No external dependency/);assert(!history.includes('Claimed success'));
let previousRequirement;
await new CortexRuntime().run({...batchRequest,conversationRequirements:history},{persistence,generate:async call=>{previousRequirement=call.prompt;assert(!call.system.includes('No external dependency'));return generated([{type:'patchFile',path:'a.ts',oldText:'= 0',newText:'= 1'}]);},verify:async()=>pass()});
assert.match(previousRequirement,/keyboard support is required/);
console.log('Cortex V4.1 C/D/E: real verifier reuse, mutation invalidation, HTML completeness, local exact schema, payload reserve, source-linked multi-turn requirements and measured-only call journal — PASS');

const memory={id:'remember',engineVersion:'4.1.0',fingerprintAlgorithm:'sha256',workspaceId:'same',prompt:'Corrige le calcul de valeur',paths:['a.ts'],evidence:['compiler passed'],sourceFingerprints:{'a.ts':'sha-current'}};
assert.match(retrieveTrajectories([memory],'Corrige le calcul de valeur','same',{'a.ts':'fnv'},{'a.ts':'sha-current'}),/Conseil historique/);
assert.equal(retrieveTrajectories([memory],'Corrige le calcul de valeur','same',{'a.ts':'fnv'},{'a.ts':'sha-new'}),'');
assert.equal(retrieveTrajectories([{...memory,engineVersion:'4.0.0'}],'Corrige le calcul de valeur','same',{'a.ts':'fnv'},{'a.ts':'sha-current'}),'');
initializeAccountScope('account-a');const grantA=projectConsentKey();initializeAccountScope('account-b');assert.notEqual(grantA,projectConsentKey());initializeAccountScope();
assert.notEqual(projectConsentScope('workspace-a',{id:'provider',baseUrl:'http://local'}),projectConsentScope('workspace-b',{id:'provider',baseUrl:'http://local'}));
assert.notEqual(projectConsentScope('workspace-a',{id:'provider',baseUrl:'http://local'}),projectConsentScope('workspace-a',{id:'provider',baseUrl:'https://cloud'}));

let stored,delivered=0;
const restoreStore={save:async task=>{stored=structuredClone(task);},load:async()=>structuredClone(stored)};
const paused=await new CortexRuntime().run({...batchRequest,conversationId:'resume-v41',modelFacts:{endpoint:'local',modelId:'generic-local',identity:'weights-a'}},{persistence:restoreStore,generate:async()=>generated([{type:'patchFile',path:'a.ts',oldText:'= 0',newText:'= 1'}]),verify:async()=>[{type:'build',status:'unavailable',success:false,output:'Compiler not available'}]});
assert.equal(paused.task.phase,'paused');
await assert.rejects(new CortexRuntime().run({...batchRequest,conversationId:'resume-v41',id:paused.task.id,modelFacts:{endpoint:'local',modelId:'generic-local',identity:'weights-b'}},{persistence:restoreStore,generate:async()=>{throw Error('must not call');}}),/configuration du modèle/);
assert.equal(stored.phase,'paused','a refused resume must not rewrite the original checkpoint');
const resumed=await new CortexRuntime().run({...batchRequest,conversationId:'resume-v41',id:paused.task.id,modelFacts:{endpoint:'local',modelId:'generic-local',identity:'weights-a'}},{persistence:restoreStore,generate:async()=>{throw Error('no extra generation needed');},verify:async()=>pass(),onProposal:async()=>{assert.notEqual(stored.phase,'completed');assert.equal(stored.proposalDelivery,'pending');delivered++;}});
assert.equal(resumed.task.phase,'completed');assert.equal(resumed.task.proposalDelivery,'delivered');assert.equal(delivered,1);
console.log('Cortex V4.1 E/F: source/version-aware historical advice, scoped grants, model identity on resume and proposal delivered before completed — PASS');

let protectedTurns=0;
const protectedRecovery=await new CortexRuntime().run({...batchRequest,project:{...codeProject,files:[...codeProject.files,'tests/protected.ts'],readFile:async path=>path==='tests/protected.ts'?'reference':codeSources[path]}},{persistence,generate:async()=>generated(++protectedTurns===1?[{type:'patchFile',path:'a.ts',oldText:'= 0',newText:'= 1'},{type:'replaceFile',path:'tests/protected.ts',content:'forbidden'}]:[{type:'patchFile',path:'a.ts',oldText:'= 0',newText:'= 1'}]),verify:async()=>pass()});
assert.equal(protectedRecovery.task.phase,'completed');assert.equal(protectedTurns,2);assert.equal(protectedRecovery.changes.length,1);assert(!protectedRecovery.changes.some(c=>c.path.startsWith('tests/')));
let cancelledTask;
const cancellation=new AbortController();
await assert.rejects(new CortexRuntime().run({...batchRequest,signal:cancellation.signal},{persistence:{save:async task=>{cancelledTask=task;},load:async()=>undefined},generate:async call=>{call.onDelta?.('partial response');cancellation.abort();throw new DOMException('Cancelled','AbortError');}}),/abort|cancel/i);
assert.equal(cancelledTask.phase,'cancelled');assert.equal(cancelledTask.calls.at(-1).status,'aborted');assert.equal(cancelledTask.calls.at(-1).tokensMeasured,false);assert(cancelledTask.calls.at(-1).receivedCharacters>0);
console.log('Cortex V4.1 safety: protected-file rollback does not blacklist a valid sibling edit; cancellation preserves honest partial telemetry — PASS');
assert.equal(analyzeIntent('Conserve la contrainte précédente et mets encore value à 1.').taskType,'codeGeneration');
assert.equal(analyzeIntent('Mets le délai à 20 millisecondes.').taskType,'codeGeneration');
assert.equal(analyzeIntent('Explique la fonction de ce fichier.').taskType,'repositoryTask');
let questionContext;
await new CortexRuntime().run({...batchRequest,prompt:'Explique a.ts.',conversationRequirements:history},{persistence,generate:async call=>{questionContext=call.prompt;return{text:'Explanation',stopReason:'stop'};}});
assert.match(questionContext,/keyboard support is required/);
assert(validateSchema('anything',{type:'string',pattern:'^safe$'}).length,'unsupported schema constraints fail closed');
for(const valid of [true,false]){
  const vision=await new CortexRuntime().run(request,{persistence,supportsVision:true,generate:async call=>call.schema?.properties?.issues?{text:JSON.stringify({issues:valid?[]:'invalid'}),stopReason:'stop'}:generated([replace]),verify:async()=>[{...pass()[0],renderReport:report()}]});
  assert.equal(vision.task.phase,'completed');assert.equal(vision.task.modelExperience.visionSuccesses,valid?1:0);assert.equal(vision.task.modelExperience.visionFailures,valid?0:1);assert.equal(vision.task.calls.at(-1).role,'vision-advice');assert.equal(vision.task.calls.at(-1).parsing,valid?'accepted':'rejected');
}
