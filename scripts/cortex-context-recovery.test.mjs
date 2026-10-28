import assert from 'node:assert/strict';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { recoverContext,rememberContext } from '../src/lib/cortex/context-engine.ts';
import { sourceHash } from '../src/lib/cortex/semantic.ts';
import { validateAction } from '../src/lib/agent/actions.ts';

const signal=new AbortController().signal;
const baseTask={version:1,id:'recovery-unit',steps:1,prompt:'Corrige la valeur.',phase:'repairing',context:{files:[]},plan:[],candidates:[],events:[]};
const observation=rememberContext(baseTask,{category:'observation',content:'Diagnostic exact à récupérer.',origin:'independent',status:'failed',sources:{'src/value.ts':sourceHash('export const value = 0;')}});
assert.match(validateAction({type:'readContext',id:`checkpoint:${baseTask.id}/${observation.id}`}, {files:[],readFile:async()=>''},new Map(),true),/mal formée/);
assert.throws(()=>recoverContext(baseTask,'ctx-999-deadbeef'),/absente/);
const altered=structuredClone(baseTask);altered.contextArchive[0].content+=' altéré';
assert.throws(()=>recoverContext(altered,observation.id),/altérée/);

const sources={'src/value.ts':'export const value = 0;'};
const project={id:'context-recovery-project',name:'Context recovery',files:Object.keys(sources),readFile:async path=>sources[path]};
const generated=actions=>({text:JSON.stringify({actions}),stopReason:'stop'});
let calls=0,validId='',validEnd=0;
const result=await new CortexRuntime().run({conversationId:'context-recovery',prompt:'Modifie src/value.ts pour que value soit égal à 1.',modelId:'mock-local',modelFacts:{endpoint:'mock://local',modelId:'mock-local',contextWindow:8192},project,mode:'fast',allowChanges:true,signal,limits:{maxAgentSteps:6}}, {
  persistence:{save:async()=>{},load:async()=>undefined},
  generate:async call=>{
    calls++;
    if(calls===1){assert(!JSON.stringify(call.schema).includes('readContext'));return generated([{type:'patchFile',path:'src/value.ts',oldText:'= 0',newText:'= 1'}]);}
    const references=call.context.state.recoverableContext;
    if(calls===4){
      assert.deepEqual(references,[],'a fully recovered observation must not be offered again');
      assert(call.context.items.some(item=>item.id.startsWith(`recovered:${validId}:0`)&&item.content.length===validEnd));
      return generated([{type:'patchFile',path:'src/value.ts',oldText:'= 1',newText:'= 2'}]);
    }
    assert(Array.isArray(references)&&references.length>0,'a failed check must expose its exact recoverable observation');
    validId=references[0].id;validEnd=references[0].end;
    const schema=JSON.stringify(call.schema);
    assert(schema.includes(`"enum":["${validId}"]`));
    assert(!schema.includes('checkpoint:context-recovery'));
    if(calls===2)return generated([{type:'readContext',id:`checkpoint:invented/${validId}`,start:0,end:validEnd}]);
    return generated([{type:'readContext',id:validId,start:0,end:validEnd}]);
  },
  verify:async changes=>changes[0]?.after.includes('= 2')?[{type:'tests',origin:'independent',status:'passed',success:true,output:'Valeur vérifiée.'}]:[{type:'tests',origin:'independent',status:'failed',success:false,output:'Valeur attendue : 2. '+('Diagnostic indépendant détaillé. '.repeat(40))}],
});
assert.equal(result.task.phase,'completed',JSON.stringify({calls,issues:result.task.issues,events:result.task.events,actionTrace:result.task.actionTrace}));
assert.equal(calls,4);
assert.equal(result.changes[0].after,'export const value = 2;');
assert(result.task.actionTrace.some(trace=>/CORTEX_ACTION_FORMAT|mal formée|variante/i.test(trace.outcome)));
console.log('Cortex context recovery: malformed reference rejected, exact id bounded, recovery resumed, verified edit completed — PASS');
