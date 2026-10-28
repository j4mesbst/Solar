import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { classifyRepair, recordRepairVerification, isStyleOnlyChange } from '../src/lib/cortex/repair.ts';
import { missingDomTargets, domSourceExcerpt } from '../src/lib/cortex/dom-repair.ts';
import { initializeSemantic, sourceHash } from '../src/lib/cortex/semantic.ts';
import { render, renderDirectory } from './solar-bench/webkit.mjs';
import { verifyBehavior, effectiveInspection } from '../src/lib/cortex/behavior.ts';

const signal=new AbortController().signal;
const fail=(selector,file)=>({type:'structure',file,status:'failed',success:false,validatorId:`required:${selector}`,output:`DOM requis : ${selector}.`});
const empty='<!doctype html><html><body></body></html>';
const initial='<!doctype html>\n<html><head><style>body{color:#111}</style></head>\n<body><main>Ready</main></body></html>';
const fixed=initial.replace('</main>','<select id="choice" aria-label="Choice"><option>A</option></select></main>');
const changes=[{path:'index.html',before:empty,after:initial}];
const required=fail('select#choice[aria-label="Choice"]','index.html');
assert.equal(missingDomTargets([fail('.field[data-name="a.b"],select')])[0].selector,'.field[data-name="a.b"],select');
assert.equal(missingDomTargets([{...required,hardConstraint:false}]).length,0);
const attribute={...required,output:'Interaction final : attendu {"selector":"select#choice","attribute":{"name":"aria-label","value":"Choice"}}, observé {"selector":"select#choice","found":false}.'};
assert.deepEqual(missingDomTargets([attribute])[0].expected.attribute,{name:'aria-label',value:'Choice'});
assert.equal(missingDomTargets([{...attribute,output:'Interaction : attendu {"selector":".gone","visible":false}, observé null.'}]).length,0);
const target=classifyRepair([{type:'visual',status:'failed',success:false,output:'color'},required,fail('dialog#settings')],changes);
assert.equal(target.kind,'structure');assert.equal(target.missingDom.length,2);assert.match(target.brief,/PRIORITÉ DOM/);
assert.match(classifyRepair([attribute],changes).brief,/aria-label/);
const cssHeavy='<html>\n<head><style>\n'+Array.from({length:120},()=>'.box{color:red}').join('\n')+'\n</style></head>\n<body><main id="body-target"></main></body></html>';
assert.match(domSourceExcerpt('index.html',cssHeavy),/body-target/);
assert.match(domSourceExcerpt('index.html',cssHeavy),/#/);

// Reducing the visual error cannot be counted as repairing the missing node.
const memory={prompt:'Fix UI',steps:1};
const measured=value=>({checks:[required,{type:'visual',validatorId:'pixels',status:'passed',success:true,output:'Measured',measurement:value}],changes});
recordRepairVerification(memory,measured(.1),target);
assert.equal(recordRepairVerification(memory,measured(.01),target).progress,false);
assert.equal(memory.repairMemory.strategy,'reassess');
assert.equal(recordRepairVerification(memory,{checks:[],changes},undefined).progress,true);
await initializeSemantic();
assert(isStyleOnlyChange('src/App.jsx','export default()=> <main style={{color:"red"}} />','export default()=> <main style={{color:"blue"}} />'));
assert(!isStyleOnlyChange('src/App.jsx','export default()=> <main />','export default()=> <main><select /></main>'));

const persistence={save:async()=>{},load:async()=>undefined};
const names=call=>call.schema.properties.actions.items.oneOf.map(item=>item.properties.type.enum[0]);
let calls=0,verifications=0;
const result=await new CortexRuntime().run({conversationId:'dom-html',prompt:'Crée une interface HTML dans index.html.',modelId:'mock',project:{id:'dom-html',name:'dom-html',files:['index.html'],readFile:async()=>empty},mode:'fast',allowChanges:true,signal,limits:{maxAgentSteps:7}}, {
  persistence,
  generate:async call=>{
    calls++;
    if(calls===1)return {text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:initial}]}),stopReason:'stop'};
    for(const name of ['patchStyle','runCheck','runBuild','runTests','finish','inspectUI','inspectMotion','replaceFile','patchFile','createFile'])assert(!names(call).includes(name),name);
    assert.equal(call.schema.properties.actions.maxItems,1,'one base hash cannot safely drive two edits of the same DOM source in one turn');
    assert.match(call.prompt,/select#choice/);assert.match(call.prompt,/aria-label/);
    if(calls<=4){assert.match(call.prompt,/<body><main>Ready/);assert.match(call.prompt,new RegExp(sourceHash(initial)));}
    if(calls===2)return {text:JSON.stringify({actions:[{type:'replaceRange',path:'index.html',start:3,end:3,content:initial.split('\n')[2],sourceHash:sourceHash(initial)}]}),stopReason:'stop'};
    if(calls===3){assert.match(call.prompt,/sans effet/);return {text:JSON.stringify({actions:[{type:'replaceRange',path:'index.html',start:2,end:2,content:initial.split('\n')[1].replace('#111','#222'),sourceHash:sourceHash(initial)}]}),stopReason:'stop'};}
    if(calls===4){assert.match(call.prompt,/CSS/);return {text:JSON.stringify({actions:[{type:'replaceRange',path:'index.html',start:3,end:3,content:'<body><main><template><select id="choice" aria-label="Choice"></select></template>Ready</main></body></html>',sourceHash:sourceHash(initial)}]}),stopReason:'stop'};}
    const staged='<body><main><template><select id="choice" aria-label="Choice"></select></template>Ready</main></body></html>';
    assert.equal(calls,5);assert.equal(call.context.state.repair.strategy,'reassess');assert.match(call.context.next,/Aucun progrès DOM/);
    const current=initial.split('\n').slice(0,2).concat(staged).join('\n');
    return {text:JSON.stringify({actions:[{type:'replaceRange',path:'index.html',start:3,end:3,content:fixed.split('\n')[2],sourceHash:sourceHash(current)}]}),stopReason:'stop'};
  },
  verify:async staged=>{
    verifications++;
    const scenario={expectations:[{selector:'select#choice',attribute:{name:'aria-label',value:'Choice'}}]};
    const report=await render(staged[0].after,[0],signal,undefined,effectiveInspection(scenario));
    return verifyBehavior(report,scenario,'independent').map(check=>({...check,file:'index.html',renderReport:report}));
  },
});
assert.equal(result.task.phase,'completed',JSON.stringify(result.task.issues));assert.equal(calls,5);assert.equal(verifications,3);
assert.equal(result.changes[0].after,fixed);assert(result.checks.every(check=>check.status==='passed'));
assert(result.task.repairMemory.attempts.some(attempt=>!attempt.progress));
assert(result.task.telemetry.rolledBackTransactions>=2);

// The model may explore a different viewport, but the independent checks keep
// their original settings and a successful structural edit is never rolled back.
let scopeCalls=0;const scopes=[];
const scope=await new CortexRuntime().run({conversationId:'scope',prompt:'Crée une interface HTML dans index.html.',modelId:'mock',project:{id:'scope',name:'scope',files:['index.html'],readFile:async()=>empty},mode:'fast',allowChanges:true,signal,inspection:{viewport:{width:1280,height:800}},limits:{maxAgentSteps:4}}, {
  persistence,generate:async()=>({text:JSON.stringify({actions:++scopeCalls===1?[{type:'replaceFile',path:'index.html',content:initial}]:scopeCalls===2?[{type:'inspectUI',path:'index.html',viewport:{width:390,height:800}}]:[{type:'patchFile',path:'index.html',oldText:'</main>',newText:'<p>Fixed</p></main>'}]}),stopReason:'stop'}),
  verify:async(_changes,_s,_id,options)=>{scopes.push(options.viewport);return [{type:'tests',validatorId:'content',status:scopeCalls<3?'failed':'passed',success:scopeCalls>=3,output:scopeCalls<3?'Missing content':'Content verified'}];},
  render:async()=>({supported:true,width:1280,height:800,errors:[],frames:[{timestamp:0,image:'',elements:[],overflow:0}]}),
});
assert.equal(scope.task.phase,'completed',JSON.stringify(scope.task.issues));assert(scopes.every(view=>view.width===1280));assert(scope.changes[0].after.includes('Fixed'));

// Real React mounting: source text inside a non-rendered branch is not enough.
const directory=await mkdtemp('/private/tmp/solar-dom-repair-react-');
try{
  const before='const App=()=> <main>Ready</main>; export default App;';
  const broken='const App=()=> <main>{false && <dialog id="settings" aria-label="Settings"/>}Ready</main>; export default App;';
  const after='const App=()=> <main><dialog open id="settings" aria-label="Settings">Settings</dialog></main>; export default App;';
  const sources={'src/App.jsx':before};let generations=0,executions=0;
  await writeFile(join(directory,'index.html'),'<!doctype html><div id="root"></div><script src="/app.js"></script>');
  const react=await new CortexRuntime().run({conversationId:'dom-react',prompt:'Corrige le composant React src/App.jsx.',modelId:'mock',project:{id:'dom-react',name:'dom-react',files:Object.keys(sources),readFile:async path=>sources[path]},mode:'fast',allowChanges:true,signal,limits:{maxAgentSteps:4}}, {
    persistence,generate:async call=>{
      generations++;
      if(generations===1)return {text:JSON.stringify({actions:[{type:'replaceFile',path:'src/App.jsx',content:broken}]}),stopReason:'stop'};
      assert.match(call.prompt,/dialog#settings/);assert.match(call.prompt,/aria-label/);assert.match(call.prompt,/false &&/);
      return {text:JSON.stringify({actions:[{type:'replaceRange',path:'src/App.jsx',start:1,end:1,content:after,sourceHash:sourceHash(broken)}]}),stopReason:'stop'};
    },
    verify:async staged=>{
      executions++;
      await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';${staged[0].after.replace('export default App;','')}createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,format:'iife',outfile:join(directory,'app.js'),define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
      const scenario={expectations:[{selector:'dialog#settings',attribute:{name:'aria-label',value:'Settings'}}]};
      const report=await renderDirectory(directory,[0],signal,effectiveInspection(scenario));
      return verifyBehavior(report,scenario,'independent').map(check=>({...check,file:'src/App.jsx',renderReport:report}));
    },
  });
  assert.equal(react.task.phase,'completed',JSON.stringify(react.task.issues));assert.equal(generations,2);assert.equal(executions,2);assert.equal(react.changes[0].after,after);
}finally{await rm(directory,{recursive:true,force:true});}
console.log('Cortex structural repair: selector/attributes, DOM before CSS, live HTML/React, inert/rejected edits, rendered confirmation, immediate reassessment and fixed verification scope — PASS');
