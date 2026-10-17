import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { nearbyLocalImports, resolveLocalImport } from '../src/lib/agent/module-resolution.ts';
import { verifyModuleExports, verifyStagedChanges } from '../src/lib/agent/verification.ts';
import { classifyRepair } from '../src/lib/cortex/repair.ts';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';

const signal = new AbortController().signal;
const source = {
  'lib/entry.cjs': 'exports.joinName = (first,last) => `${first} ${last}`.trim();\n',
  'lib/join.cjs': 'module.exports = {};\n',
};
const project = { id:'two-files', name:'two-files', files:Object.keys(source), readFile:async path=>source[path] };
assert.equal(resolveLocalImport('lib/entry.cjs','./join',project.files,'cjs').target,undefined);
assert.deepEqual(nearbyLocalImports('lib/entry.cjs','./join',project.files,'cjs'),[{path:'lib/join.cjs',specifier:'./join.cjs'}]);
assert.equal(resolveLocalImport('lib/entry.cjs','./join.cjs',project.files,'cjs').target,'lib/join.cjs');
assert.equal(resolveLocalImport('lib/entry.cjs','./join',['lib/join.js'],'cjs').target,'lib/join.js');
assert.deepEqual(nearbyLocalImports('lib/entry.cjs','./join',['lib/join.js'],'cjs'),[]);
assert(verifyModuleExports('lib/join.cjs','module.exports = { joinName };').some(check=>!check.success));
assert(verifyModuleExports('lib/join.cjs','const joinName = () => 1; module.exports = { joinName };').every(check=>check.success));

const broken = [
  {path:'lib/entry.cjs',before:source['lib/entry.cjs'],after:"module.exports.joinName = require('./join').joinName;\n"},
  {path:'lib/join.cjs',before:source['lib/join.cjs'],after:'module.exports.otherName = (first,last) => `${first} ${last}`.trim();\n'},
];
const staticChecks=await verifyStagedChanges(broken,{files:[],budget:8192,estimatedTokens:0},project.files,signal);
const importFailure=staticChecks.find(check=>check.type==='imports'&&!check.success);
assert(importFailure);
assert.match(importFailure.output,/lib\/join\.cjs \(import explicite \.\/join\.cjs\)/);
assert(staticChecks.filter(check=>check.type==='structure').every(check=>check.success));
const repair=classifyRepair(staticChecks.map(check=>({...check,status:check.success?'passed':'failed'})),broken,undefined,project.files);
assert.deepEqual(repair.files,['lib/entry.cjs','lib/join.cjs']);
assert.match(repair.brief,/\.\/join\.cjs/);
const importerOnly=classifyRepair([{type:'imports',file:'lib/entry.cjs',status:'failed',success:false,output:importFailure.output}],[broken[0]],undefined,project.files);
assert.deepEqual(importerOnly.files,['lib/entry.cjs','lib/join.cjs']);

const runNode=promisify(execFile);
let generated=0,checks=0;
const task=await new CortexRuntime().run({conversationId:'two-files',prompt:'Déplace joinName vers lib/join.cjs et réexporte depuis lib/entry.cjs.',modelId:'mock-local',project,mode:'fast',allowChanges:true,signal,limits:{maxAgentSteps:5}}, {
  persistence:{save:async()=>{},load:async()=>undefined},
  generate:async call=>{
    generated++;
    if(generated<=4){
      assert(!JSON.stringify(call.schema).includes('"runCheck"'),'unchanged checks must not be offered before a required edit or after a measured import failure');
    }
    if(generated===3 || generated===4){
      assert(!JSON.stringify(call.schema).includes('"readFile"'),'fully read import sources must not be offered for an identical reread');
      assert.match(call.prompt,/\.\/join\.cjs/);
      assert.match(call.prompt,/lib\/entry\.cjs/);
      assert.match(call.prompt,/lib\/join\.cjs/);
    }
    const actions=generated===1?[
      {type:'replaceFile',path:'lib/entry.cjs',content:broken[0].after},
      {type:'replaceFile',path:'lib/join.cjs',content:broken[1].after},
    ]:generated===2?[
      {type:'readFile',path:'lib/entry.cjs'},
      {type:'readFile',path:'lib/join.cjs'},
    ]:generated===3?[
      {type:'replaceFile',path:'lib/entry.cjs',content:"module.exports.joinName = require('./join.cjs').joinName;\n"},
      {type:'replaceFile',path:'lib/join.cjs',content:'module.exports = ;\n'},
    ]:[
      {type:'patchFile',path:'lib/entry.cjs',oldText:"require('./join')",newText:"require('./join.cjs')"},
      {type:'patchFile',path:'lib/join.cjs',oldText:'module.exports.otherName',newText:'module.exports.joinName'},
    ];
    return {text:JSON.stringify({actions}),stopReason:'stop'};
  },
  verify:async changes=>{
    checks++;
    const root=await mkdtemp(join(tmpdir(),'solar-multifile-repair-'));
    try{
      await mkdir(join(root,'lib'));
      for(const [path,content] of Object.entries(source))await writeFile(join(root,path),changes.find(change=>change.path===path)?.after??content);
      try{
        await runNode(process.execPath,['-e',"const a=require('node:assert/strict');a.equal(require('./lib/entry.cjs').joinName('Ada','Lovelace'),'Ada Lovelace');a.equal(require('./lib/join.cjs').joinName('Ada','Lovelace'),'Ada Lovelace');"],{cwd:root,timeout:5000});
        return [{type:'tests',status:'passed',success:true,output:'Node CommonJS runtime: both exports pass'}];
      }catch(error){return [{type:'tests',status:'failed',success:false,output:String(error.stderr||error.message)}];}
    }finally{await rm(root,{recursive:true,force:true});}
  },
});
assert.equal(task.task.phase,'completed',JSON.stringify(task.task.issues));
assert.equal(generated,4);
assert.equal(checks,2);
assert.deepEqual(task.changes.map(change=>change.path),['lib/entry.cjs','lib/join.cjs']);
assert(task.checks.every(check=>check.status==='passed' || check.hardConstraint===false));
console.log('Cortex multi-file repair: Node .cjs resolution, exports, two-file atomic correction and independent execution — PASS');
