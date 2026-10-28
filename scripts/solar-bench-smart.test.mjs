import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtures } from './solar-bench/registry.mjs';
import { QUICK_IDS, REGRESSION_IDS, selectSmartFixtures, sourceDigest, cacheKey, loadPassedCache, FastFailureDetector } from './solar-bench/smart.mjs';
import { makeReport } from './solar-bench/report.mjs';
import { createTerminalProgress } from './solar-bench/progress.mjs';

assert.equal(QUICK_IDS.length,3);
// The historical regression preset intentionally remains the original eight.
assert.equal(REGRESSION_IDS.length,8);
assert.equal(new Set(REGRESSION_IDS.map(id=>fixtures.find(f=>f.id===id)?.domain)).size,5);
assert.equal(selectSmartFixtures([]).mode,'quick');
assert.equal(selectSmartFixtures(['src/lib/cortex/semantic.ts']).mode,'targeted');
assert.deepEqual(new Set(selectSmartFixtures(['src/lib/cortex/semantic.ts']).fixtures.map(f=>f.domain)),new Set(['code','refactoring']));
assert.deepEqual(new Set(selectSmartFixtures(['src/components/Chat.tsx']).fixtures.map(f=>f.domain)),new Set(['ui','visual','animations']));
assert.equal(selectSmartFixtures(['src/services/newEngine.ts']).mode,'regression');
assert.equal(selectSmartFixtures(['README.md']).mode,'quick');
const root=await mkdtemp(join(tmpdir(),'solar-bench-smart-'));
try{
  await mkdir(join(root,'src'),{recursive:true});await writeFile(join(root,'src','runtime.ts'),'v1');await writeFile(join(root,'package.json'),'{}');
  const initial=await sourceDigest(root);await writeFile(join(root,'src','runtime.ts'),'v2');assert.notEqual(await sourceDigest(root),initial);
  const fixture=fixtures[0],options={timeoutMs:600000,features:{}};
  const identity={fixture,variant:'cortex',source:initial,modelIdentity:'digest-a',model:'model',options,runnerVersion:'test',registryVersion:2};
  const key=cacheKey(identity);
  for(const change of [{source:'different'},{modelIdentity:'digest-b'},{fixture:{...fixture,validatorVersion:3}},{options:{...options,features:{cegis:false}}}])assert.notEqual(cacheKey({...identity,...change}),key);
  const runDir=join(root,'results','run-1');await mkdir(runDir,{recursive:true});await writeFile(join(runDir,'BENCHMARK_RESULTS.json'),JSON.stringify({results:[{fixtureId:fixture.id,variant:'cortex',status:'passed',resultCacheKey:key,durationMs:100},{fixtureId:'failed',status:'failed',resultCacheKey:'fail'}]}));
  assert.equal((await loadPassedCache(join(root,'results'),new Set([key,'fail']))).size,1);
}finally{await rm(root,{recursive:true,force:true});}
const detector=new FastFailureDetector();
let generation=0;
const state=(after,issues=[])=>({branch:0,phase:'generating',generations:++generation,candidates:[{changes:after?[{path:'a',after}]:[],checks:[],issues}]});
assert.equal(detector.observe(state('a')),undefined);
assert.equal(detector.observe({branch:0,phase:'generating',generations:generation,candidates:[{changes:[{path:'a',after:'a'}],checks:[],issues:[]}]}),undefined);
assert.equal(detector.observe(state('b')),undefined);
assert.equal(detector.observe(state('c')),undefined);
assert.equal(detector.observe(state('c')),undefined);
assert.equal(detector.observe(state('c'))?.status,'stagnation');
const empty=new FastFailureDetector();
for(let i=0;i<2;i++)assert.equal(empty.observe(state(null)),undefined);
assert.equal(empty.observe(state(null))?.status,'stagnation');
const infra=new FastFailureDetector();assert.equal(infra.observe(state(null,['Ollama HTTP 500'])),undefined);assert.equal(infra.observe(state(null,['Ollama HTTP 500']))?.status,'infrastructure-error');
const run={id:'smart-test',startedAt:'2026-10-15',model:'model',machine:'test',cortex:{version:1,commit:'abc'},options:{smart:true,selectionMode:'quick',variant:'cortex',timeoutMs:1000},results:[{fixtureId:'swift-debug',domain:'code',variant:'cortex',status:'CACHED',cachedFrom:'old',durationMs:0,originalDurationMs:1234,checks:[]}],summary:{total:1,passed:1,cached:1,executed:0,durationMs:10},diagnostics:[],recommendations:[]};
assert.match(makeReport(run),/Résultat partiel/);assert.match(makeReport(run),/CACHED \(old\)/);
const lines=[];const progress=createTerminalProgress({write:value=>lines.push(value),isTTY:false,color:false});progress({type:'init',model:'model',fixtureCount:1,total:1,mode:'quick'});progress({type:'complete',result:run.results[0],passed:1,failed:0,cached:1,completed:1,total:1});progress({type:'summary',passed:1,failed:0,executed:0,cached:1,total:1,durationMs:10,reportPath:'/tmp/report'});assert.match(lines.join(''),/CACHED/);assert.match(lines.join(''),/aucun score global/);
console.log('solar-bench smart: selection, conservative cache, fast failure — ok');
