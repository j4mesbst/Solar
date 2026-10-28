import assert from 'node:assert/strict';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { PatchConflictError, stageAction } from '../src/lib/agent/actions.ts';
import { sourceHash } from '../src/lib/cortex/semantic.ts';
import { fixtures } from './solar-bench/registry.mjs';
import { validateFixture } from './solar-bench/validators.mjs';
import { render, SOLAR_ROOT } from './solar-bench/webkit.mjs';

const signal=new AbortController().signal;
const project={id:'edits',name:'edits',files:['index.html'],readFile:async()=>'<html><body>first first</body></html>'};
for(const [oldText,matches] of [['absent',0],['first',2]]){
  const staged=new Map();
  await assert.rejects(stageAction({type:'applyPatch',path:'index.html',oldText,newText:'changed'},project,staged,signal),error=>{
    assert(error instanceof PatchConflictError);assert.equal(error.matches,matches);assert.equal(error.currentHash,sourceHash('<html><body>first first</body></html>'));return true;
  });
  assert.equal(staged.size,0,'a rejected patch must not change the candidate');
}

const fixture=fixtures.find(item=>item.id==='ui-tabs');
assert(fixture);
const bad='<!doctype html><html><body><button id="tab-one">Un</button><script>const panel = ;</script></body></html>';
const good='<!doctype html><html><body><button id="tab-one">Un</button><button id="tab-two">Deux</button><p id="panel">Un</p><script>document.querySelector("#tab-two").addEventListener("click",()=>{document.querySelector("#panel").textContent="Deux"})</script></body></html>';
const stale={type:'applyPatch',path:'index.html',oldText:bad.replace('id="tab-one"','id="tab-one" '),newText:good};
const snapshots=[];let calls=0,validations=0;
const result=await new CortexRuntime().run({conversationId:'patch-recovery',prompt:fixture.prompt,modelId:'simulated',project:{id:'ui-tabs-recovery',name:'ui-tabs-recovery',files:Object.keys(fixture.files),readFile:async path=>fixture.files[path]},mode:'ultra',allowChanges:true,signal},{
  persistence:{save:async task=>snapshots.push(structuredClone(task)),load:async()=>undefined},
  generate:async call=>{
    calls++;
    if(calls===1)return{text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:bad}]}),stopReason:'stop'};
    if(calls===2)return{text:JSON.stringify({actions:[stale]}),stopReason:'stop'};
    assert.equal(calls,3);
    assert(call.context.items.some(item=>item.reference==='index.html'&&item.content.includes(bad)),'the exact staged source must be refreshed after conflict');
    assert(call.prompt.includes(JSON.stringify(bad).slice(1,-1)),'the exact source must survive serialized context selection');
    assert(call.prompt.includes(`#${sourceHash(bad)}`),'the current hash must be exposed');
    assert(call.schema.properties.actions.items.oneOf.some(item=>item.properties.type.enum[0]==='replaceRange'),'the guarded recovery must actually be exposed; text restrictions are path-specific at staging');
    return{text:JSON.stringify({actions:[{type:'replaceRange',path:'index.html',start:1,end:1,content:good,sourceHash:sourceHash(bad)}]}),stopReason:'stop'};
  },
  verify:async changes=>{validations++;return validateFixture(fixture,changes,{signal,root:SOLAR_ROOT,render});},
  supportsVision:false,
});
assert.equal(result.task.phase,'completed',JSON.stringify(result.task.issues));
assert.equal(calls,3);assert.equal(validations,1);
assert.equal(result.changes[0].after,good);assert.equal(result.changes[0].before,fixture.files['index.html']);
assert.equal(result.task.actionTrace[1].files[0].hash,result.task.actionTrace[0].files[0].hash,'the rejected patch must leave the file unchanged');
assert(result.task.rejectedEdits?.length);
assert.equal(result.task.patchConflict,undefined);
assert(result.checks.every(check=>check.status==='passed'),JSON.stringify(result.checks));

// A model that ignores the refreshed source cannot reapply an already rejected
// patch, even if it ignores the constrained schema.
let repeats=0;
const repeated=await new CortexRuntime().run({conversationId:'patch-repeat',prompt:fixture.prompt,modelId:'simulated',project:{id:'ui-tabs-repeat',name:'ui-tabs-repeat',files:Object.keys(fixture.files),readFile:async path=>fixture.files[path]},mode:'ultra',allowChanges:true,signal,limits:{maxAgentSteps:3}},{
  persistence:{save:async()=>{},load:async()=>undefined},
  generate:async()=>({text:JSON.stringify({actions:[++repeats===1?{type:'replaceFile',path:'index.html',content:bad}:stale]}),stopReason:'stop'}),
  supportsVision:false,
});
assert.equal(repeated.task.phase,'paused');
assert.equal(repeated.changes[0].after,bad);
assert.match(repeated.task.actionTrace.at(-1).outcome,/déjà rejeté/);

let live=fixture.files['index.html'],driftCalls=0,proposals=0;
const drift=await new CortexRuntime().run({conversationId:'patch-drift',prompt:fixture.prompt,modelId:'simulated',project:{id:'ui-tabs-drift',name:'ui-tabs-drift',files:Object.keys(fixture.files),readFile:async path=>path==='index.html'?live:fixture.files[path]},mode:'ultra',allowChanges:true,signal},{
  persistence:{save:async()=>{},load:async()=>undefined},
  generate:async()=>{driftCalls++;return{text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:good}]}),stopReason:'stop'};},
  verify:async()=>{live+='\n<!-- concurrent edit -->';return[{type:'build',status:'failed',success:false,output:'check failed'}];},
  onProposal:async()=>{proposals++;},supportsVision:false,
});
assert.equal(drift.task.phase,'paused');assert.equal(driftCalls,1);assert.equal(proposals,0);
assert.match(drift.task.issues[0],/changé sur disque/);
assert.equal(live,fixture.files['index.html']+'\n<!-- concurrent edit -->');
console.log('cortex-patch-recovery: absent/ambiguous rejection, exact refresh, hash-guarded range repair + real WebKit, repeated-patch rejection, external-drift pause — ok');
