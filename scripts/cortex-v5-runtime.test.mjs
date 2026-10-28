import assert from 'node:assert/strict';
import {CortexRuntime} from '../src/lib/cortex/runtime.ts';

const source='<!doctype html><html><body><main></main></body></html>';
const updated='<!doctype html><html><body><main><div id="box">Motion</div></main></body></html>';
const times=[0,250,500,750,1000,1100];
const frames=reduced=>times.map(time=>({timestamp:time,image:'data:image/jpeg;base64,dGVzdA==',overflow:0,reducedMotion:reduced,telemetry:[],elements:[{selector:'#box',x:reduced?100:Math.min(100,time/10),y:0,width:40,height:40,opacity:1,transform:'none',filter:'none',visible:true,text:'Motion'}]}));
const report=reduced=>({supported:true,width:640,height:400,errors:[],frames:frames(reduced),reducedMotionEmulated:true,referenceComparison:{aspectCompatible:true,meanError:.05,cells:[{x:0,y:0,width:.25,height:.25,error:.05}]}});
let analyzed=0,verified=0,reducedCaptures=0;
const result=await new CortexRuntime().run({conversationId:'v5-integration',prompt:'Crée une animation GSAP dans index.html.',modelId:'capable-model',modelFacts:{endpoint:'local-test',modelId:'capable-model',contextWindow:32768,vision:false},project:{id:'v5-integration',name:'v5-integration',files:['index.html'],readFile:async()=>source},mode:'fast',allowChanges:true,signal:new AbortController().signal,referenceImage:'data:image/png;base64,dGVzdA==',referenceTolerance:.1,inspection:{timeline:[0,250,500,750,1000]},motionContracts:[{id:'move',selector:'#box',property:'x',startMs:0,endMs:1000,from:0,to:100,requireMovement:true,settle:true,tolerance:2},{id:'reduced',selector:'#box',property:'x',startMs:0,endMs:1000,from:100,to:100,reducedMotion:true,tolerance:2}]}, {
  persistence:{save:async()=>{},load:async()=>undefined},
  analyzeReference:async()=>{analyzed++;return {width:640,height:400,method:'raster-64x40',palette:[],cells:[]};},
  generate:async call=>{assert.match(JSON.stringify(call),/MOUVEMENT/);return {text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:updated}]}),stopReason:'stop'};},
  verify:async(_changes,_signal,_id,inspection)=>{verified++;assert.deepEqual(inspection.timeline,times);return [{type:'build',status:'passed',success:true,output:'Compiled',renderReport:report(false)}];},
  render:async(_html,capturedTimes,_signal,_reference,inspection)=>{reducedCaptures++;assert.equal(inspection.reducedMotion,true);assert.deepEqual(capturedTimes,times);return report(true);},
});
assert.equal(result.task.phase,'completed',JSON.stringify(result.task.issues));
assert.equal(analyzed,1);assert.equal(verified,1);assert.equal(reducedCaptures,1);
assert(result.checks.some(check=>check.validatorId==='v5-reference'&&check.status==='passed'));
assert(result.checks.some(check=>check.validatorId==='v5-motion:move'&&check.status==='passed'));
assert(result.checks.some(check=>check.validatorId==='v5-motion:reduced'&&check.status==='passed'));
assert.equal(result.task.engineering.builder.compiled,true);
assert.equal(result.task.engineering.diagnostics.length,0);
console.log('Cortex V5 runtime: reference measurement, declared model budget, contract-specific timeline, reduced capture and provenance — PASS');
