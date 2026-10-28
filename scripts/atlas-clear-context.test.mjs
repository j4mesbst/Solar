import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'solar-clear-')),data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
let count=0;const test=async(name,fn)=>{await fn();count++;console.log('PASS '+name);};
try{
 const out=await build({entryPoints:['src/services/conversationContext.ts'],bundle:true,format:'esm',platform:'node',write:false,define:{'import.meta.env':'{}'}});const file=path.join(dir,'context.mjs');await writeFile(file,out.outputFiles[0].text);const s=await import(pathToFileURL(file));
 const msg=(id,role,content,extra={})=>({id,role,content,conversationId:'test',status:'completed',createdAt:'2026-10-24T10:00:00Z',order:0,...extra});
 const before=[msg('u1','user','PHOENIX ancien : livraison lundi. Ancienne pièce de contexte.'),msg('a1','assistant','ANCIEN_RESULTAT_A_NE_PAS_REINJECTER',{metrics:{promptTokens:6000,tokens:200}}),msg('cmd','user','/context',{localCommand:'context'}),msg('report','assistant','Rapport ancien',{localCommand:'context'})];
 const input=(messages,more={})=>({conversationId:'test',messages,model:{id:'m',providerId:'p',name:'Test',contextWindow:131072,maxOutputTokens:384,capabilities:[],enabled:true},provider:{id:'p',name:'Test',protocol:'ollama',baseUrl:'http://fixture.invalid',enabled:true},effort:'low',signal:new AbortController().signal,system:'Profil personnel conservé.',...more});
 await test('Clear drops old summary/doc context, preserves transcript and excludes a last local command boundary',async()=>{
  await s.prepareConversationContext(input(before,{force:true,summarize:async()=> 'ANCIEN_RESUME_A_NE_PAS_REINJECTER'}));const original=JSON.stringify(before);
  await s.resetConversationContext('test',before);assert.equal(JSON.stringify(before),original);
  const r=await s.prepareConversationContext(input(before));assert.deepEqual(r.messages,[]);assert(!r.system.includes('ANCIEN_'));assert(r.system.includes('Profil personnel conservé.'));assert.equal(r.report.compactions,0);assert.equal(r.report.documentNotes,0);
  const report=await s.conversationContextReport(input(before));assert.equal(report.measuredPrompt,undefined);
 });
 await test('Raw tool-intent history is scoped to the same reset boundary and new turns survive',async()=>{
  const next=msg('u2','user','Quelle est la nouvelle échéance PHOENIX ?');const history=[...before,next];const scoped=await s.conversationHistoryForContext('test',history);assert.deepEqual(scoped,[next]);
  const r=await s.prepareConversationContext(input(scoped));assert.deepEqual(r.messages.map(m=>m.id),['u2']);assert(!r.system.includes('ANCIEN_'));
  const full=await s.prepareConversationContext(input(history));assert.deepEqual(full.messages.map(m=>m.id),['u2']);
 });
 await test('Compaction after clear cannot resurrect an old source through archive retrieval',async()=>{
  const history=[...before,msg('u2','user','NOUVEAU dossier PHOENIX : vendredi.'),msg('a2','assistant','NOUVEAU_RESULTAT')];let summaries=0;
  const r=await s.prepareConversationContext(input(history,{force:true,summarize:async text=>{summaries++;assert(!text.includes('ANCIEN_'));assert(!text.includes('livraison lundi'));return 'NOUVEAU_RESUME : vendredi.';}}));assert.equal(summaries,1);assert(r.system.includes('NOUVEAU_RESUME'));assert(!r.system.includes('ANCIEN_'));assert(!r.system.includes('livraison lundi'));
  const later=[...history,msg('u3','user','PHOENIX livraison lundi : que sais-tu ?')];const again=await s.prepareConversationContext(input(later));assert(!again.system.includes('ANCIEN_RESULTAT'));assert(!again.system.includes('PHOENIX ancien'));assert.deepEqual((await s.conversationHistoryForContext('test',later)).map(m=>m.id),['u2','a2','u3']);
 });
 await test('Another conversation and temporary storage have independent boundaries',async()=>{
  const separate=await s.prepareConversationContext(input(before,{conversationId:'other'}));assert.equal(separate.messages.length,2);
  await s.resetConversationContext('other',before,true);assert.deepEqual(await s.conversationHistoryForContext('other',before,true),[]);assert.equal((await s.conversationHistoryForContext('other',before)).length,before.length);
 });
 await test('A later clear resets the boundary again without changing any message',async()=>{
  const history=[...before,msg('u4','user','Nouvelle demande'),msg('a4','assistant','Dernière réponse')],original=JSON.stringify(history);await s.resetConversationContext('test',history);assert.deepEqual((await s.prepareConversationContext(input(history))).messages,[]);assert.equal(JSON.stringify(history),original);
 });
 console.log(`Atlas clear context: ${count}/${count} groups passed. No model or private account used.`);
}finally{await rm(dir,{recursive:true,force:true});}
