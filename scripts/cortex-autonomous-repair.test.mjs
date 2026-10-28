import assert from 'node:assert/strict';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { classifyRepair, isStyleOnlyChange, recordRepairVerification, repairMemoryContext, verificationCategory } from '../src/lib/cortex/repair.ts';
import { sourceHash } from '../src/lib/cortex/semantic.ts';
import { normalizeProposedAction } from '../src/lib/agent/actions.ts';
import { fixtures } from './solar-bench/registry.mjs';
import { validateFixture } from './solar-bench/validators.mjs';
import { render, SOLAR_ROOT } from './solar-bench/webkit.mjs';

const signal=new AbortController().signal;
const htmlProject={files:['index.html'],readFile:async()=>'<html></html>'};
const escaped='<!doctype html>\\n<html lang=\\"fr\\">\\n<head><meta charset=\\"utf-8\\"></head>\\n<body><div>ok</div></body></html>';
const normalized=await normalizeProposedAction({type:'replaceFile',path:'index.html',content:escaped},htmlProject,new Map(),signal);
assert.match(normalized.note,/double-échappé/);
assert.match(normalized.action.content,/<!doctype html>\n<html lang="fr">/);
const inline='<!doctype html><html><script>const x="\\n";</script></html>';
assert.equal((await normalizeProposedAction({type:'replaceFile',path:'index.html',content:inline},htmlProject,new Map(),signal)).action.content,inline);
const fixture=fixtures.find(item=>item.id==='ui-tabs');assert(fixture);
const first='<!doctype html><html><head><meta charset="utf-8"><style>body{color:#111}</style></head><body><button id="tab-one">Un</button><button id="tab-two">Deux</button><section id="panel">Contenu de l’onglet Un.</section></body></html>';
const handler='<script>const panel=document.querySelector("#panel");document.querySelector("#tab-two").addEventListener("click",()=>{panel.textContent="Contenu de l’onglet Deux."});document.querySelector("#tab-one").addEventListener("click",()=>{panel.textContent="Contenu de l’onglet Un."});</script>';
const validated=await validateFixture(fixture,[{path:'index.html',before:fixture.files['index.html'],after:first}],{signal,root:SOLAR_ROOT,render});
const report=validated.find(check=>check.renderReport)?.renderReport;
assert.equal(report?.interactions?.[0]?.success,true,'WebKit must dispatch the click');
const failed=validated.find(check=>check.status==='failed');assert(failed);
assert.equal(verificationCategory(failed,report),'functional');
const target=classifyRepair(validated,[{path:'index.html',before:fixture.files['index.html'],after:first}],report);
assert.equal(target.kind,'interaction');assert.match(target.brief,/aucune mise à jour d'état/);
assert.match(target.brief,/Contenu de l’onglet Un/);
assert.equal(isStyleOnlyChange('index.html',first,first.replace('#111','#222')),true);
assert.equal(isStyleOnlyChange('index.html',first,first.replace('</body>',handler+'</body>')),false);

const memoryTask={prompt:fixture.prompt,steps:1,pendingRepairEdit:{step:1,hypothesis:'Premier artefact',actions:['replaceFile'],files:['index.html']}};
const changes=[{path:'index.html',before:fixture.files['index.html'],after:first}];
const candidate={checks:validated,changes};
assert.equal(recordRepairVerification(memoryTask,candidate,target).progress,true);
memoryTask.steps=2;memoryTask.pendingRepairEdit={step:2,hypothesis:'CSS pourrait activer le panneau',actions:['patchStyle'],files:['index.html']};
candidate.changes=[{...changes[0],after:first.replace('#111','#222')}];
assert.equal(recordRepairVerification(memoryTask,candidate,target).progress,false);
memoryTask.steps=3;memoryTask.pendingRepairEdit={step:3,hypothesis:'Autre couleur',actions:['patchStyle'],files:['index.html']};
assert.equal(recordRepairVerification(memoryTask,candidate,target).strategy,'reassess');
assert.match(repairMemoryContext(memoryTask),/aucun progrès vérifié/);
assert.equal(memoryTask.repairMemory.attempts.length,3);

// The model is simulated; all functional verdicts come from the unchanged
// independent WebKit validator. Two CSS-only detours must be rejected before
// the focused handler repair is accepted and revalidated.
let calls=0,externalChecks=0;const saved=new Map();
const output=await new CortexRuntime().run({conversationId:'functional-repair',prompt:fixture.prompt,modelId:'simulated',project:{id:'functional-repair',name:'functional-repair',files:Object.keys(fixture.files),readFile:async path=>fixture.files[path]},mode:'ultra',allowChanges:true,signal},{
  persistence:{save:async task=>saved.set(task.id,structuredClone(task)),load:async id=>saved.get(id)},
  generate:async call=>{
    calls++;
    if(calls===1)return{text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:first}]}),stopReason:'stop'};
    assert.match(call.prompt,/VALIDATION FONCTIONNELLE/);
    assert(call.schema.properties.actions.items.oneOf.some(item=>item.properties.type.enum[0]==='patchStyle'),'CSS may accompany an essential DOM repair; a CSS-only batch is still rejected');
    if(calls===2)return{text:JSON.stringify({diagnosis:'Je pensais améliorer la couleur',actions:[{type:'applyPatch',path:'index.html',oldText:'#111',newText:'#222'}]}),stopReason:'stop'};
    if(calls===3)return{text:JSON.stringify({diagnosis:'Encore du CSS',actions:[{type:'patchStyle',path:'index.html',selector:'body',changes:{color:'#333'},sourceHash:sourceHash(first)}]}),stopReason:'stop'};
    assert.equal(calls,4);
    assert.equal(call.context.state.repair.strategy,'reassess');
    assert(call.context.state.repair.attempts.filter(attempt=>!attempt.progress).length>=2);
    assert.match(call.context.next,/APPROCHE ALTERNATIVE inspect/);
    return{text:JSON.stringify({diagnosis:'Le clic est envoyé mais aucun handler ne modifie #panel',actions:[{type:'patchFile',path:'index.html',oldText:'</body>',newText:handler+'</body>'}]}),stopReason:'stop'};
  },
  verify:async changes=>{externalChecks++;return validateFixture(fixture,changes,{signal,root:SOLAR_ROOT,render});},
  supportsVision:false,
});
assert.equal(output.task.phase,'completed',JSON.stringify(output.task.issues));
assert.equal(calls,4);assert.equal(externalChecks,2);
assert.equal(output.task.verificationStatus,'verified');
assert(output.task.calls.every(call=>call.parsing==='accepted'),'valid JSON rejected by the editing guard must remain classified as parsed');
assert(output.task.actionTrace.some(trace=>trace.actions?.some(action=>action.type==='patchStyle')),'rejected actions retain their type without raw source');
assert(output.checks.every(check=>check.status==='passed'),JSON.stringify(output.checks));
assert(output.task.repairMemory.attempts.some(item=>item.category==='functional'&&!item.progress));
assert.equal(output.task.repairMemory.noProgress,0);
console.log('cortex-autonomous-repair: real click failure classified functional, CSS detours rejected, evidence-driven strategy switch, handler patch validated by WebKit — ok');
