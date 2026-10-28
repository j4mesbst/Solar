import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'solar-gts2-batch-'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));let checks=0;
const test=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
try {
 const built=await build({entryPoints:['src/lib/cortex/tool-runtime.ts'],bundle:true,format:'esm',platform:'node',write:false});
 const file=path.join(dir,'core.mjs');await writeFile(file,built.outputFiles[0].text);const {runCortexTools}=await import(pathToFileURL(file));
 const tool=(name='fixture.read',extra={})=>({name,description:'Fictitious read',pluginId:'fixture',risk:'read',externalEffects:false,parallelSafe:true,permissions:['fixture.read'],parameters:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},...extra});
 const actions=Array.from({length:6},(_,i)=>({name:'fixture.read',arguments:{id:String(i)}}));
 const run=async(core=runCortexTools,options={})=>{
  const {tools=[tool()],calls=[],prompt='Consulte les ressources indépendantes.',concurrency=3,delay=12,fail,abortAt,budget,provided=actions,controller=new AbortController()}=options;
  let active=0,peak=0,count=0,models=0;const order=[];
  const started=performance.now();
  const work=core({prompt,signal:controller.signal,tools,concurrency,budget,calls,maxSteps:4},{generate:async()=>++models===1?{text:'',toolCalls:provided}:{text:'Réponse fondée sur les lectures.'},execute:async(name,args)=>{count++;peak=Math.max(peak,++active);order.push('start:'+args.id);if(args.id===abortAt)controller.abort();await wait(delay);active--;order.push('end:'+args.id);if(args.id===fail)throw Error('read failure');return{id:args.id,name};}});
  try{const result=await work;return{result,peak,count,models,active,order,ms:performance.now()-started};}catch(error){return{error,peak,count,models,active,order,ms:performance.now()-started};}
 };
 await test('Six independent native reads use bounded concurrency 3 and retain six actual receipts',async()=>{const r=await run();assert(!r.error,String(r.error));assert.equal(r.peak,3);assert.equal(r.count,6);assert.equal(r.models,2);assert.equal(r.result.calls.length,6);assert.equal(r.result.telemetry.compiledNodes,6);});
 await test('Standard mode, sequential instructions and tools without parallel guarantees remain serial',async()=>{for(const options of [{concurrency:1},{prompt:'Lis ces ressources puis vérifie les résultats.'},{tools:[tool('fixture.read',{parallelSafe:false})]}]){const r=await run(runCortexTools,options);assert(!r.error);assert.equal(r.peak,1);assert.equal(r.count,6);}});
 await test('Mixed mutation batches preserve order and write receipts',async()=>{const r=await run(runCortexTools,{tools:[tool(),tool('fixture.write',{risk:'write',externalEffects:true,permissions:['fixture.write']})],provided:[actions[0],{name:'fixture.write',arguments:{id:'w'}},actions[1]]});assert(!r.error);assert.equal(r.peak,1);assert.deepEqual(r.order,['start:0','end:0','start:w','end:w','start:1','end:1']);assert(r.result.calls[1].externalEffects);assert.deepEqual(r.result.calls[1].receipt,['w']);});
 await test('Whole batch arguments are validated before any dispatch',async()=>{const r=await run(runCortexTools,{provided:[actions[0],{name:'fixture.read',arguments:{wrong:true}}]});assert.equal(r.count,0);assert.equal(r.result.telemetry.repairs,1);});
 await test('Failed siblings finish before return and no second wave starts',async()=>{const r=await run(runCortexTools,{fail:'0'});assert.match(r.error.message,/read failure/);assert.equal(r.count,3);assert.equal(r.active,0);});
 await test('Duplicate reads coalesce and concurrent dispatch cannot exceed tool budget',async()=>{const r=await run(runCortexTools,{provided:[actions[0],actions[0]]});assert(!r.error);assert.equal(r.count,1);assert.equal(r.result.calls.length,1);assert.equal(r.result.telemetry.reusedReads,1);const b=await run(runCortexTools,{budget:{maxToolCalls:1}});assert(b.error);assert.equal(b.count,1);assert.equal(b.active,0);});
 await test('Cancellation drains in-flight reads and never starts another wave',async()=>{const r=await run(runCortexTools,{abortAt:'0'});assert(r.error);assert(r.count<=3);assert.equal(r.active,0);});
 await test('Uncertain restored writes are never replayed',async()=>{const r=await run(runCortexTools,{calls:[{tool:'fixture.write',arguments:{id:'w'},result:'[not retained]',externalEffects:true}],tools:[tool(),tool('fixture.write',{risk:'write',externalEffects:true})]});assert.match(r.error.message,/pas rejouée/);assert.equal(r.count,0);});
 console.log(`GTS2 batches: ${checks}/${checks} groups passed. Models and I/O fictitious.`);
 if(process.env.GTS2_BATCH_BENCH){const before=await import(pathToFileURL(path.resolve('output/gts2/baseline/core.mjs'))),rows=[];for(let repetition=0;repetition<3;repetition++)for(const variant of repetition%2?['after','before']:['before','after']){const r=await run(variant==='before'?before.runCortexTools:runCortexTools,{delay:60});assert(!r.error);rows.push({variant,repetition,ms:r.ms,peak:r.peak,count:r.count,models:r.models});}await mkdir('output/gts2/native-batches',{recursive:true});await writeFile('output/gts2/native-batches/results.json',JSON.stringify({protocol:'Six independent fake reads, 60ms each; fake two-response model; not an LLM benchmark',rows},null,2));console.log(JSON.stringify(rows));}
}finally{await rm(dir,{recursive:true,force:true});}
