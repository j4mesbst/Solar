import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'solar-context-'));const storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
globalThis.sessionStorage=globalThis.localStorage;
try{
 const compiled=await build({stdin:{contents:'export * from "./src/services/contextBudget.ts";export * from "./src/services/conversationContext.ts";export * from "./src/services/contextCommands.ts";export * from "./src/services/accountScope.ts";export * from "./src/lib/cortex/tool-runtime.ts";export * from "./src/services/mailTools.ts";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'},plugins:[{name:'mail-fixture',setup(build){build.onLoad({filter:/[/\\]integrationApi\.ts$/},()=>({loader:'ts',contents:'export async function integrationRequest(...args){return globalThis.mailFixture(...args)}'}));}}]});
 const file=path.join(dir,'context.mjs');await writeFile(file,compiled.outputFiles[0].text);const s=await import(pathToFileURL(file));
 const provider={id:'fixture',protocol:'openai-compatible',name:'Fixture'},model={id:'fixture-model',name:'Fixture 128K',providerId:'fixture',contextWindow:131072,capabilities:['tools']};
 const message=(id,role,content)=>({id,role,content,conversationId:'test',order:Number(id.replace(/\D/g,''))||0,status:'completed',createdAt:new Date().toISOString()});
 const short=[message('u1','user','Bonjour, le projet est Solar.'),message('a1','assistant','Compris.')];
 const base={conversationId:'test',messages:short,model,provider,effort:'medium',signal:new AbortController().signal};
 assert.equal(s.modelContext(model,provider).window,131072);assert.equal(s.modelContext({...model,contextWindow:undefined},provider).declared,false);
 let report=await s.conversationContextReport(base);assert(report.percent<1);assert(report.available>120000);
 assert.equal(s.contextCommand('/context'),'context');assert.equal(s.contextCommand('/memory'),'memory');assert.equal(s.contextCommand('/context explique'),undefined);assert.equal(s.contextCommand('/memory',1),undefined);
 const ignored=[...short,{...message('u2','user','/context'),localCommand:'context'}, {...message('a2','assistant','Détails.'),localCommand:'context'}];assert.equal((await s.conversationContextReport({...base,messages:ignored})).input,report.input);
 let calls=0;const phase=[];const summarize=async text=>{calls++;assert(text.includes('Échanges à intégrer'));return 'Objectif : projet Solar. Décision : conserver son nom. Travail ouvert : terminer le chat.';};
 const compacted=await s.prepareConversationContext({...base,force:true,system:'Instructions privées à ne pas dupliquer dans le stockage de contexte.',onCompacting:active=>phase.push(active),summarize});
 assert.equal(calls,1);assert.deepEqual(phase,[true,false]);assert(compacted.compacted);assert.equal(short.length,2);assert.equal(compacted.messages.length,0);assert(compacted.system.includes('Objectif : projet Solar'));
 const saved=JSON.parse(storage.get('solar.context.test.v1'));assert.equal(saved.count,2);assert.equal(saved.through,'a1');assert(!JSON.stringify(saved).includes('Instructions privées'));assert.equal(typeof saved.envelope.systemTokens,'number');
 const next=[...short,message('u3','user','Reprends le travail, sans renommer Solar.')];const prepared=await s.prepareConversationContext({...base,messages:next,system:'Tu es Solar.'});assert.equal(prepared.messages.length,1);assert(prepared.system.includes('Objectif'));assert.equal(prepared.report.compactions,1);
 const read=await s.runContextCommand('context',{...base,messages:next});assert.equal(read.report.compactedMessages,2);assert(read.report.summary>0);assert.equal(calls,1,'/context has no model call');
 s.initializeAccountScope('other');assert.equal((await s.conversationContextReport({...base,messages:next})).compactions,0);s.initializeAccountScope('');
 const before=storage.get('solar.context.test.v1');const controller=new AbortController();await assert.rejects(s.prepareConversationContext({...base,messages:[...next,message("a3","assistant","À poursuivre")],force:true,signal:controller.signal,summarize:async()=>{controller.abort();return 'Ne jamais enregistrer ce résultat annulé.';}}));assert.equal(storage.get('solar.context.test.v1'),before);
 await s.prepareConversationContext({...base,conversationId:'temporary',temporary:true,force:true,summarize});assert.equal(storage.has('solar.context.temporary.v1'),false);assert((await s.conversationContextReport({...base,conversationId:'temporary',temporary:true})).compactions>0);
 const archivedMessages=[message('u8','user','Projet Zephyr : la couleur retenue est pétrole, référence ARCHIVE_ATTESTED.'),message('a8','assistant','Bien reçu.')];
 await s.prepareConversationContext({...base,conversationId:'archive-recall',messages:archivedMessages,force:true,summarize:async()=> 'Sujet : projet Zephyr.'});
 const recalled=await s.prepareConversationContext({...base,conversationId:'archive-recall',system:'Tu es Solar.',messages:[...archivedMessages,message('u9','user','Quelle couleur pour le projet Zephyr ?')]});assert(recalled.system.includes('ARCHIVE_ATTESTED'));assert(recalled.system.includes('[message u8,'));
 // Automatic compaction batches an old oversized text instead of discarding it.
 const long=[message('u1','user','Objectif Solar. '+ 'texte '.repeat(8000)),message('a1','assistant','Décision confirmée.'),message('u2','user','Continue le travail.')];let chunks=0;
 const auto=await s.prepareConversationContext({...base,conversationId:'long',model:{...model,contextWindow:8192},messages:long,summarize:async()=>{chunks++;return 'Objectif Solar, décision confirmée, continuer.';}});assert(chunks>1);assert.equal(auto.messages.at(-1).content,'Continue le travail.');assert(auto.report.input+auto.report.outputReserve<8192);assert.equal(long[0].content.length>40000,true);
 await assert.rejects(s.prepareConversationContext({...base,conversationId:'oversized-current',model:{...model,contextWindow:4096},messages:[message('u1','user','x'.repeat(40000))],summarize}),/pièces jointes/);
 for(const value of [{messages:Array.from({length:3},(_,i)=>({id:'mail-'+i,body:'abc"\\\n'.repeat(20000)}))},'"\\\n'.repeat(20000)]){const bounded=s.boundedToolResult(JSON.stringify(value),3000);assert(bounded.length<=3000);assert.doesNotThrow(()=>JSON.parse(bounded));}
 const kept=JSON.parse(s.boundedToolResult(JSON.stringify({messages:[{id:'MAIL123',body:'x'.repeat(50000)},{id:'MAIL456',body:'x'.repeat(50000)}]}),2500));assert(JSON.stringify(kept).includes('MAIL123'));assert(JSON.stringify(kept).includes('MAIL456'));
 // One malformed plan is repaired before any execution. No mutation repeats.
 let plans=0,executions=0;const tool={name:'mail.read',pluginId:'mail',description:'Lire',parameters:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}};
 const result=await s.runCortexTools({prompt:'Lis le mail',tools:[tool],requiredPlugins:['mail'],signal:new AbortController().signal},{generate:async()=>({text:++plans===1?'bad JSON':plans===2?JSON.stringify({tool:'mail.read',arguments:{id:'M1'}}):JSON.stringify({answer:'Mail réellement lu.'})}),execute:async()=>{executions++;return {id:'M1',body:'Message de test'};}});assert.equal(executions,1);assert.equal(result.calls.length,1);
 let urls=[];globalThis.mailFixture=async(plugin,url)=>{urls.push(url);if(url.startsWith('/messages?'))return {messages:[{id:'M1'},{id:'M2'},{id:'M3'}]};return {id:url.split('/')[2].split('?')[0],payload:{headers:[{name:'Subject',value:'Objet de test'}],mimeType:'text/plain',body:{data:Buffer.from('Corps de test français.').toString('base64url')}}};};
 const latest=s.mailTools.find(tool=>tool.name==='gmail.latest_messages');const mails=await latest.execute({limit:3},new AbortController().signal);assert.equal(mails.messages.length,3);assert(mails.messages.every(message=>message.body==='Corps de test français.'));assert.equal(urls.length,4);assert.equal(s.latestMailIntent('Analyse mes 3 derniers mails',['gmail']).arguments.limit,3);assert.equal(s.latestMailIntent('Envoie un message à mon dernier mail',['gmail']),undefined);
 await s.clearConversationContext('test');assert.equal((await s.conversationContextReport(base)).compactions,0);
 console.log('Context contracts: PASS — model window, estimates, exact commands, atomic compaction/cancel, scoped/temporary storage, oversized history batching, valid bounded JSON, planner repair and 3 attested mail bodies.');
}finally{await rm(dir,{recursive:true,force:true});}
