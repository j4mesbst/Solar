import assert from 'node:assert/strict';import{build}from'esbuild';import{mkdtemp,writeFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import path from'node:path';import{pathToFileURL}from'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'solar-discovery-'));
try{
 let models=[],fail=false,calls=0;globalThis.models=()=>models;globalThis.save=m=>{models=[...models.filter(x=>x.id!==m.id),m]};
 globalThis.fetch=async()=>{calls++;if(fail)throw Error('Inspection indisponible');return new Response(JSON.stringify({capabilities:['completion','tools','vision','thinking'],model_info:{'qwen35.context_length':'262144'}}));};
 const compiled=await build({stdin:{contents:'export {reconcileModels} from "./src/services/ollama.ts";export {modelContext} from "./src/services/contextBudget.ts";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'},plugins:[{name:'store-fixture',setup(b){b.onLoad({filter:/[/\\]store\.ts$/},()=>({loader:'ts',contents:'export const solarStore={listModels:async()=>globalThis.models(),saveModel:async m=>globalThis.save(m)};'}));}}]});const file=path.join(dir,'test.mjs');await writeFile(file,compiled.outputFiles[0].text);const s=await import(pathToFileURL(file));
 const provider={id:'local',protocol:'ollama',baseUrl:'http://127.0.0.1:11434'};const found={id:'local:model',providerId:'local',name:'fixture',enabled:true,source:'remote',capabilities:[]};
 await s.reconcileModels(provider,[found]);assert.equal(models[0].contextWindow,262144);assert.equal(models[0].contextSource,'provider');assert(models[0].capabilities.includes('tools'));assert(models[0].capabilities.includes('reasoning'));assert.equal(s.modelContext(models[0],provider).window,262144);
 await s.reconcileModels(provider,[found]);assert.equal(calls,2);assert(models[0].capabilities.includes('vision'));assert(models[0].capabilities.includes('tools'));
 fail=true;await s.reconcileModels(provider,[found]);assert.equal(models[0].contextWindow,262144);assert(models[0].capabilities.includes('tools'));assert(models[0].metadataError);
 fail=false;models[0].contextWindow=131072;models[0].contextSource='manual';await s.reconcileModels(provider,[found]);assert.equal(models[0].contextWindow,131072);assert.equal(models[0].contextSource,'manual');assert.equal(models[0].metadataError,undefined);
 console.log('Ollama discovery: PASS — 262K metadata, numeric strings, refresh preserves tools/vision/reasoning, failure retains confirmed facts and manual capacity wins.');
}finally{await rm(dir,{recursive:true,force:true});}
