import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { cortexAdapter } from '../adapters/cortex.mjs';

const base=await mkdtemp(join(tmpdir(),'solar-cortex-stage-test-'));
try {
  const workspace=join(base,'workspace'),stateDir=join(base,'state'), evalDir=join(base,'evaluation');
  await Promise.all([mkdir(join(workspace,'src'),{recursive:true}),mkdir(stateDir),mkdir(evalDir)]);
  const initial='export const value="initial";\n';
  await writeFile(join(workspace,'src/value.ts'),initial);
  await writeFile(join(workspace,'package.json'),'{"scripts":{"test":"node ../evaluation/public-runner.mjs"}}');
  const publicRunner=join(evalDir,'public-runner.mjs');
  await writeFile(publicRunner,`import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';assert.match(readFileSync('src/value.ts','utf8'),/fixed/);`);
  execFileSync('/usr/bin/git',['init','--quiet'],{cwd:workspace});
  execFileSync('/usr/bin/git',['add','--all'],{cwd:workspace});
  execFileSync('/usr/bin/git',['-c','user.email=test@invalid.local','-c','user.name=Test','commit','--quiet','-m','initial'],{cwd:workspace});
  const fixture={id:'stage-test',title:'Staging',files:{'src/value.ts':initial,'package.json':'{}', 'public-test.mjs':'ignored'}};
  const changes=[{path:'src/value.ts',before:initial,after:'export const value="bad";\n'}];
  const good=[{path:'src/value.ts',before:initial,after:'export const value="fixed";\n'}];
  const observed=[];
  const fakeRuntime={
    async run(request,services){
      const first=await services.verify(changes);
      assert.equal(first[0].status,'failed');
      observed.push(await readFile(join(workspace,'src/value.ts'),'utf8'));
      const second=await services.verify(good);
      assert.equal(second[0].status,'passed');
      observed.push(await readFile(join(workspace,'src/value.ts'),'utf8'));
      return {task:{phase:'completed',repairs:1,issues:[],telemetry:{}},changes:good};
    }
  };
  const context={fixture,workspace,profile:{contextWindow:16384,maxOutputTokens:2200},model:'mock',signal:new AbortController().signal,ollama:{capabilities:[]},evaluation:{publicRunner}};
  const aborted=await cortexAdapter.run({...context,snapshotModules:{CortexRuntime:class {async run(req,services){
    const failure=await services.verify(changes);
    assert.equal(failure[0].status,'failed');
    return {task:{phase:'paused',issues:['check failed'],repairs:1,telemetry:{}},changes:[]};
  }},CORTEX_VERSION:'4.2-test',createCortexBackend:()=>()=>{}}});
  assert.deepEqual(aborted.changedFiles,[],'Failed proposal must leave zero changes in the evaluated workspace');
  assert.equal(await readFile(join(workspace,'src/value.ts'),'utf8'),initial);
  const run=await cortexAdapter.run({...context,snapshotModules:{CortexRuntime:class {run=(...args)=>fakeRuntime.run(...args)},CORTEX_VERSION:'4.2-test',createCortexBackend:()=>()=>{}}});
  assert.deepEqual(observed,[initial,initial],'No speculative check may mutate the writable workspace');
  assert.equal(await readFile(join(workspace,'src/value.ts'),'utf8'),good[0].after);
  assert.deepEqual(run.changedFiles,['src/value.ts']);
  assert.equal(run.taskPhase,'completed');
  const blocked=await cortexAdapter.run({...context,snapshotModules:{CortexRuntime:class {async run(req,services){
    const unsafe=[{path:'test-cache.test.ts',after:'import assert from \"node:assert\";'}];
    const verdict=await services.verify(unsafe);
    assert.equal(verdict[0].status,'failed','public checker must refuse edits of test files');
    assert.match(verdict[0].output,/protégés/);
    return {task:{phase:'completed',issues:[],repairs:0,telemetry:{}},changes:unsafe};
  }},CORTEX_VERSION:'4.2-test',createCortexBackend:()=>()=>{}}});
  assert.equal(blocked.process.code,1);
  assert.deepEqual(blocked.changedFiles,['src/value.ts'],'a refused proposal must not create test files');
  assert.deepEqual(await readdir(evalDir),['public-runner.mjs']);
  console.log('Cortex V3 speculative staging isolation: failed check, successful check, workspace unchanged before commit — PASS');
} finally { await rm(base,{recursive:true,force:true}); }
