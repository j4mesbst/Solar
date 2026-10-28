import assert from 'node:assert/strict';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { normalizeProposedAction } from '../src/lib/agent/actions.ts';
import { verifyModuleExports, verifyStagedChanges } from '../src/lib/agent/verification.ts';
import { recoverFileArtifact } from '../src/lib/cortex/structured.ts';
import { classifyRepair } from '../src/lib/cortex/repair.ts';
import { fixtures } from './solar-bench/registry.mjs';
import { validateFixture } from './solar-bench/validators.mjs';
import { render, SOLAR_ROOT } from './solar-bench/webkit.mjs';
import { selectSmartFixtures } from './solar-bench/smart.mjs';

const signal=new AbortController().signal;
const baseline='<!doctype html><html><body><main></main></body></html>';
const valid='<!doctype html><html><body><main><h1>Solar</h1></main></body></html>';
const project={id:'repair',name:'repair',files:['index.html'],readFile:async()=>baseline};
const normalized=await normalizeProposedAction({type:'patchFile',path:'index.html',oldText:'<!doctype html><html><body></body></html>',newText:valid},project,new Map(),signal);
assert.equal(normalized.action.type,'patchFile'); // An obsolete full-file patch must not silently overwrite current edits.
assert.equal((await normalizeProposedAction({type:'patchFile',path:'index.html',oldText:'old',newText:valid},project,new Map(),signal)).action.type,'patchFile');
assert.deepEqual(JSON.parse(recoverFileArtifact('```html index.html\n'+valid+'\n```',['index.html'])).actions[0],{type:'replaceFile',path:'index.html',content:valid});
assert.equal(recoverFileArtifact('```html index.html\n<html>incomplete\n```',['index.html']),undefined);
assert.equal(recoverFileArtifact('```html ../outside.html\n'+valid+'\n```',['index.html']),undefined);
assert.equal(verifyModuleExports('src/index.cjs',"const {formatName}=require('./format.cjs');module.exports={formatName};").every(check=>check.success),true);
const bad='<!doctype html><html><body><button id="tab-one">Un</button><script>const a = ;</script></body></html>';
const syntax=await verifyStagedChanges([{path:'index.html',before:baseline,after:bad}],{files:[],relatedPaths:[],architectureSummary:'',estimatedTokens:1,budget:100},project.files,signal);
const issue=syntax.find(check=>check.type==='syntax'&&!check.success);
assert(issue);assert.equal(issue.file,'index.html');assert(issue.line>0);assert(issue.column>0);assert.match(issue.output,/index\.html:\d+:\d+/);
assert.equal(classifyRepair(syntax.map(check=>({...check,status:check.success?'passed':'failed'})),[{path:'index.html',before:baseline,after:bad}]).kind,'syntax');
const missing=classifyRepair([{type:'visual',status:'failed',success:false,output:'#panel: attendu Deux, observé null'}],[{path:'index.html',before:baseline,after:valid}],{frames:[{elements:[{selector:'#tab-one'}]}]});
assert.equal(missing.kind,'structure');assert.match(missing.brief,/#tab-one/);
assert.equal(selectSmartFixtures(['src/.DS_Store']).mode,'quick');
assert.equal(selectSmartFixtures(['src/services/skillEngine.ts']).mode,'regression');
assert.equal(selectSmartFixtures(['src/services/solarModels.ts']).mode,'regression');

// The independent UI validator runs only after the simulated model fixes a
// real syntax defect. Its selectors and WebKit interaction are unchanged.
const fixture=fixtures.find(item=>item.id==='ui-tabs');
const working='<!doctype html><html><body><button id="tab-one">Un</button><button id="tab-two">Deux</button><p id="panel">Un</p><script>document.querySelector("#tab-two").addEventListener("click",()=>{document.querySelector("#panel").textContent="Deux"})</script></body></html>';
const saved=new Map();let calls=0,externalChecks=0;
const output=await new CortexRuntime().run({conversationId:'mock-ui-tabs',prompt:fixture.prompt,modelId:'simulated',project:{id:fixture.id,name:fixture.id,files:Object.keys(fixture.files),readFile:async path=>fixture.files[path]},mode:'ultra',allowChanges:true,signal},{
 persistence:{save:async task=>saved.set(task.id,structuredClone(task)),load:async id=>saved.get(id)},
 generate:async()=>({text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:++calls===1?bad:working}]}),stopReason:'stop'}),
 verify:async changes=>{externalChecks++;return validateFixture(fixture,changes,{signal,root:SOLAR_ROOT,render});},
 supportsVision:false,
});
assert.equal(output.task.phase,'completed');assert.equal(output.task.verificationStatus,'verified');assert.equal(calls,2);assert.equal(externalChecks,1);
assert(output.checks.every(check=>check.status==='passed'),JSON.stringify(output.checks));
console.log('cortex-v3.3.2: safe full-file conflict, fenced recovery, syntax location, DOM evidence, Smart mapping, mocked repair + real WebKit validator — ok');
