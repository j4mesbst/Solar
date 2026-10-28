import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'solar-gts3-math-'));
try{const built=await build({stdin:{contents:'export * from "./src/services/gtsCompute.ts";export {ToolRegistry,ToolExecutor} from "./src/services/toolRegistry.ts";',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});const file=path.join(dir,'math.mjs');await writeFile(file,built.outputFiles[0].text);const {computeNumbers,gtsComputeTool,needsArithmetic,ToolRegistry,ToolExecutor}=await import(pathToFileURL(file));const signal=new AbortController().signal;
assert.equal(computeNumbers({operation:'sum',values:[.1,.2,-.05]},signal).value,'0.25');
assert.equal(computeNumbers({operation:'sum',values:[1e-7,2e-7,1e5]},signal).value,'100000.0000003');
assert.equal(computeNumbers({operation:'sum',values:Array.from({length:15},(_,i)=>100+i*10)},signal).value,'2550');
assert.equal(computeNumbers({operation:'count',values:[0,0]},signal).value,'2');
assert.equal(computeNumbers({operation:'min',values:[0,-5,8]},signal).value,'-5');
assert.equal(computeNumbers({operation:'max',values:[0,-5,8]},signal).value,'8');
for(const values of [[],[NaN],[Infinity],[Number.MAX_SAFE_INTEGER+1],Array(1001).fill(1),['2']])assert.throws(()=>computeNumbers({operation:'sum',values},signal));
assert.throws(()=>computeNumbers({operation:'eval',values:[1]},signal));const cancelled=new AbortController();cancelled.abort();assert.throws(()=>computeNumbers({operation:'sum',values:[1]},cancelled.signal));
assert(needsArithmetic('Analyse le budget total des quinze fichiers.'));assert(!needsArithmetic('Résume Gmail. Maximum 40 mots.'));
const registry=new ToolRegistry();registry.register(gtsComputeTool);const executor=new ToolExecutor(registry);const r=await executor.run('solar.compute',{operation:'sum',values:[1,2]},new Set(),signal,{account:'fixture',isCurrentAccount:()=>true,accessMode:'read-only'});assert.equal(r.value,'3');await assert.rejects(executor.run('solar.compute',{operation:'sum',values:['1']},new Set(),signal));
console.log('GTS3 arithmetic: PASS decimal sums, 15-source budget, count/min/max, validation, finite/safe range, limits, cancellation and read-only ToolExecutor. No eval/network/files.');
}finally{await rm(dir,{recursive:true,force:true});}
