import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';import {tmpdir} from 'node:os';import{pathToFileURL}from'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'solar-jit-contract-'));
const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
const signal=()=>new AbortController().signal;
let checks=0;const test=async(name,fn)=>{await fn();checks++;console.log(`PASS ${name}`);};
try{
 const compiled=await build({stdin:{contents:`export * from './src/lib/cortex/workflow.ts';export * from './src/lib/cortex/tool-runtime.ts';export * from './src/services/toolRegistry.ts';export * from './src/services/missionEvidence.ts';export * from './src/services/solarAgentStore.ts';export * from './src/services/agentNotebook.ts';export {compileKnownTask} from './src/services/compiledTasks.ts';export {taskRequirements,missionAllowsTool} from './src/services/agentToolPolicy.ts';export {currentAccountScope} from './src/services/accountScope.ts';export {draftTools} from './src/services/draftTools.ts';export {mailTools} from './src/services/mailTools.ts';export {integrationTools} from './src/services/integrationTools.ts';export {productivityTools} from './src/services/productivityTools.ts';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,define:{'import.meta.env':'{}'},plugins:[{name:'isolated-service-boundary',setup(b){
  b.onLoad({filter:/[/\\]integrationApi\.ts$/},()=>({loader:'ts',contents:'export async function integrationRequest(...args){return globalThis.fixture(...args)};export const integrationFetch=()=>{throw Error("Unexpected HTTP")};'}));
  b.onLoad({filter:/[/\\]solarConnect\.ts$/},()=>({loader:'ts',contents:'export const connectionToken=async()=>"TEST_ONLY";'}));
  b.onLoad({filter:/[/\\]pluginAccounts\.ts$/},()=>({loader:'ts',contents:'export async function savedConnection(){return globalThis.connection};'}));
 }}]});const file=path.join(dir,'tests.mjs');await writeFile(file,compiled.outputFiles[0].text);const s=await import(pathToFileURL(file));
 const read=(name='fixture.read')=>({name,description:'Fictitious read',risk:'read',pluginId:'fixture',externalEffects:false,parallelSafe:true,permissions:['fixture.read'],parameters:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}});
 const list={...read('fixture.list'),parameters:{type:'object',properties:{},additionalProperties:false}};
 const tools=[list,read()];const node=(id,args={id})=>({id,tool:'fixture.read',arguments:args});
 await test('Known GitHub query compiles despite “n’a pas été mis à jour”; reading a draft never forces creation',async()=>{
  const gh=[{...read('github.repository_activity'),parameters:{type:'object',properties:{repository:{type:'string'}},required:['repository']}},{...read('github.profile_activity'),parameters:{type:'object',properties:{},additionalProperties:false}}];
  assert.equal(s.compileKnownTask('Vérifie depuis quand mon repo GitHub demo/solar n’a pas été mis à jour et combien de contributions sur mon profil GitHub.',['github'],gh).nodes.length,2);
  assert.equal(s.compileKnownTask('Ne consulte pas mon profil GitHub. Vérifie mon repo demo/solar et son activité.',['github'],gh),undefined);
  assert(!s.taskRequirements('Lis mon brouillon Gmail',['gmail'],[{...read('gmail.create_draft'),pluginId:'gmail'}]).some(r=>r.id==='gmail-draft'));
 });
 await test('JIT2 literal Slack / assigned Linear intents use schema-validated reads; ambiguity stays adaptive',async()=>{
  const slack={...read('slack.search_messages'),pluginId:'slack',parameters:{type:'object',properties:{query:{type:'string',minLength:1,maxLength:500}},required:['query'],additionalProperties:false}};
  const linear={...read('linear.list_issues'),pluginId:'linear',parameters:{type:'object',properties:{cursor:{type:'string'}},additionalProperties:false}};
  for(const query of ['Orion','Apollo lancement','from:me after:2026-10-01'])assert.equal(s.compileKnownTask(`Cherche ${query} dans Slack. Résume les décisions.`,['slack'],[slack]).nodes[0].arguments.query,query);
  assert(s.compileKnownTask('Liste mes tickets Linear. Classe par priorité.',['linear'],[linear]));
  for(const prompt of ['Ne cherche pas Orion dans Slack.','Si utile cherche Orion dans Slack.','Cherche Orion dans Slack et publie un résumé.','Cherche un sujet dans Slack selon mon dernier mail'])assert.equal(s.compileKnownTask(prompt,['slack'],[slack]),undefined);
  for(const prompt of ['Liste les tickets Linear de Paul.','Liste mes tickets Linear et supprime les doublons.'])assert.equal(s.compileKnownTask(prompt,['linear'],[linear]),undefined);
  assert.equal(s.compileKnownTask('Liste mes tickets Linear.',['linear'],[]),undefined);
  assert.equal(s.compileKnownTask('Cherche Orion dans Slack.',['slack','gmail'],[slack]),undefined);
  assert.equal(s.compileKnownTask('Cherche Orion dans Slack.',['slack'],[{...slack,risk:'publish'}]),undefined);
 });
 await test('Production Linear assigned read validates pages, exposes cursor and never reads a different user',async()=>{
  const def=s.integrationTools.find(t=>t.name==='linear.list_issues');let after;
  globalThis.fixture=async(service,path,input)=>{assert.equal(service,'linear');assert.equal(path,'/graphql');assert(input.body.query.includes('viewer { assignedIssues'));assert(input.body.query.includes('priorityLabel dueDate'));after=input.body.variables.after;return{data:{viewer:{assignedIssues:{nodes:[{identifier:'LIN-1',priority:1,dueDate:'2026-11-01'}],pageInfo:{hasNextPage:true,endCursor:'page-2'}}}}};};
  const page=await def.execute({},signal());assert.equal(after,null);assert.equal(page.nextCursor,'page-2');assert.equal(page.partial,true);await def.execute({cursor:'page-2'},signal());assert.equal(after,'page-2');
  globalThis.fixture=async()=>({data:{viewer:{assignedIssues:{nodes:[],pageInfo:{hasNextPage:true}}}}});await assert.rejects(def.execute({},signal()),/vérifiable/);
 });
 await test('Gmail body reads are bounded to 3, keep order and await failed siblings before returning',async()=>{
  const def=s.mailTools.find(t=>t.name==='gmail.latest_messages');let active=0,peak=0,done=0,fail=false;const requested=[];
  globalThis.fixture=async(_service,path)=>{if(path.startsWith('/messages?'))return{messages:Array.from({length:6},(_,i)=>({id:`m${i}`}))};requested.push(path);const id=path.match(/m(\d)/)[1];peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,Number(id)%2?8:15));active--;done++;if(fail&&id==='0')throw Error('read failed');return{id:`m${id}`,payload:{mimeType:'text/plain',body:{data:Buffer.from(`Body ${id}`).toString('base64url')}}};};
  const page=await def.execute({limit:6},signal());assert.equal(peak,3);assert.deepEqual(page.messages.map(m=>m.id),['m0','m1','m2','m3','m4','m5']);assert.equal(done,6);
  fail=true;done=0;requested.length=0;await assert.rejects(def.execute({limit:6},signal()),/read failed/);assert.equal(active,0);assert.equal(done,3);assert.equal(requested.length,3,'no second batch after failure');
  const cancelled=new AbortController();cancelled.abort();requested.length=0;await assert.rejects(def.execute({limit:6},cancelled.signal));assert.equal(requested.length,0);
 });
 await test('External prompt injection cannot expose sends on read/draft-only missions; explicit sends still work',async()=>{
  const publish={...read('gmail.send'),risk:'publish',externalEffects:true,permissions:['gmail.write']};
  assert(!s.missionAllowsTool('Analyse mes 3 derniers mails Gmail.',publish));
  assert(!s.missionAllowsTool('Prépare un brouillon pour envoyer plus tard.',publish));
  assert(!s.missionAllowsTool('Rédige un brouillon sans envoyer.',publish));
  assert(s.missionAllowsTool('Envoie ce message à demo@example.invalid.',publish));
  assert(s.missionAllowsTool('Peux-tu envoyer ce message ?',publish));
  assert(!s.missionAllowsTool('N’envoie pas ce message.',publish));
  assert(s.missionAllowsTool('Rédige un brouillon Gmail.',{...publish,name:'gmail.create_draft',risk:'write'}));
 });
 await test('DAG references + bounded foreach consume 20 complete mail bodies, no model call',async()=>{
  const data=Array.from({length:20},(_,i)=>({id:`m${i}`,body:i%5===0?'Urgent: échéance aujourd’hui.':'Information sans action.'}));
  const flow=s.compileWorkflow({version:1,nodes:[{id:'inbox',tool:list.name,arguments:{}},{id:'bodies',tool:'fixture.read',arguments:{},each:{from:'inbox',path:['messages'],argument:'id',field:['id'],limit:20}}]},tools);let calls=0;
  const result=await s.executeWorkflow(flow,tools,async(name,args)=>{calls++;return name===list.name?{messages:data.map(({id})=>({id}))}:data.find(m=>m.id===args.id);},signal());assert.equal(calls,21);assert.equal(result.results.bodies.filter(m=>m.body.startsWith('Urgent')).length,4);assert.equal(result.results.bodies.length,20);
 });
 await test('Static invalid arguments / unknown tools / writes / cycles / prototype paths dispatch nothing',async()=>{
  const badFlows=[{version:1,nodes:[node('x',{})]},{version:1,nodes:[{...node('x'),tool:'missing'}]},{version:1,nodes:[{...node('x'),tool:'fixture.write'}]},{version:1,nodes:[{...node('a'),dependsOn:['b']},{...node('b'),dependsOn:['a']}]},{version:1,nodes:[{...node('x'),arguments:{id:{$result:{from:'y',path:['constructor']}}}},node('y')]}];
  for(const flow of badFlows)assert.throws(()=>s.compileWorkflow(flow,[...tools,{...read('fixture.write'),risk:'write',externalEffects:true}]));
 });
 await test('Dynamic ID paths validate before dispatch; foreach overflow never silently truncates',async()=>{
  const flow=s.compileWorkflow({version:1,nodes:[{id:'a',tool:list.name,arguments:{}},{...node('b'),arguments:{id:{$result:{from:'a',path:['id']}}}}]},tools);let calls=0;await assert.rejects(s.executeWorkflow(flow,tools,async()=>{calls++;return{id:12};},signal()),/incompatible/);assert.equal(calls,1);
  const many=s.compileWorkflow({version:1,nodes:[{id:'a',tool:list.name,arguments:{}},{...node('b',{}),each:{from:'a',path:[],argument:'id',field:['id'],limit:1}}]},tools);calls=0;await assert.rejects(s.executeWorkflow(many,tools,async()=>{calls++;return[{id:'a'},{id:'b'}]},signal()),/limite explicite/);assert.equal(calls,1);
 });
 await test('Owned independent reads parallelize with max 3; unsafe reads remain serial',async()=>{
  const flow=s.compileWorkflow({version:1,nodes:Array.from({length:7},(_,i)=>node(`x${i}`))},tools);let active=0,peak=0;
  const run=async()=>{peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,8));active--;return{id:'ok'}};
  await s.executeWorkflow(flow,tools,run,signal(),99);assert.equal(peak,3);peak=0;await s.executeWorkflow(flow,tools.map(t=>({...t,parallelSafe:false})),run,signal(),3);assert.equal(peak,1);
 });
 await test('Sibling failure awaits siblings; dependent calls never execute; cancellation stops graph',async()=>{
  const flow=s.compileWorkflow({version:1,nodes:[node('a'),node('b'),{...node('c'),dependsOn:['a','b']}]},tools);let siblingDone=false,dependent=false;
  await assert.rejects(s.executeWorkflow(flow,tools,async(_name,args)=>{if(args.id==='a')throw Error('503');if(args.id==='b'){await new Promise(r=>setTimeout(r,20));siblingDone=true;}else dependent=true;return{}},signal()),/503/);assert(siblingDone);assert(!dependent);
  const stop=new AbortController();stop.abort();await assert.rejects(s.executeWorkflow(flow,tools,async()=>assert.fail('called after abort'),stop.signal));
 });
 await test('Compiled calls share duplicate reads; model budget permits final allowed call actions',async()=>{
  let models=0,reads=0;const response=text=>({text,stopReason:'stop',metrics:{promptTokens:10,tokens:5}});
  const result=await s.runCortexTools({prompt:'Read',tools,signal:signal(),concurrency:3,budget:{maxModelCalls:2,maxToolCalls:1}}, {generate:async()=>response(++models===1?JSON.stringify({workflow:{version:1,nodes:[node('a',{id:'same'}),node('b',{id:'same'})]}}):'Lu.'),execute:async()=>{reads++;await new Promise(r=>setTimeout(r,4));return{id:'same'}}});assert.equal(reads,1);assert.equal(models,2);assert.equal(result.telemetry.toolCalls,1);assert.equal(result.telemetry.reusedReads,1);assert.equal(result.telemetry.inputTokens,20);
 });
 await test('Read workflow checkpoints resume without a planner LLM call and keep sources intact',async()=>{
  let snapshot,callsSnapshot,models=0,reads=0;
  await assert.rejects(s.runCortexTools({prompt:'Read graph',tools,signal:signal()}, {generate:async()=>({text:JSON.stringify({workflow:{version:1,nodes:[node('a'),{...node('b'),dependsOn:['a']}]}})}),onState:state=>snapshot=structuredClone(state),onStep:(_p,_d,calls)=>callsSnapshot=structuredClone(calls),execute:async(_name,args)=>{if(args.id==='b')throw Error('HTTP 503');return{id:'a',full:'source'};}}),/503/);
  assert(snapshot.workflow);const resumed=await s.runCortexTools({prompt:'Read graph',tools,workflow:snapshot.workflow,calls:callsSnapshot,signal:signal()}, {generate:async()=>{models++;return{text:'Terminé.'}},execute:async(_name,args)=>{reads++;assert.equal(args.id,'b');return{id:'b'}}});assert.equal(models,1);assert.equal(reads,1);assert.equal(resumed.telemetry.workflow,undefined);assert.equal(resumed.calls.length,2);
 });
 await test('Exhausted budgets stop before side effects, including resumed reads',async()=>{
  let runs=0;await assert.rejects(s.runCortexTools({prompt:'Read',tools,signal:signal(),budget:{maxToolCalls:0}}, {generate:async()=>({text:'{"tool":"fixture.read","arguments":{"id":"a"}}'}),execute:async()=>runs++}),/Budget/);assert.equal(runs,0);
  await assert.rejects(s.runCortexTools({prompt:'Resume',tools,signal:signal(),budget:{maxToolCalls:0},calls:[{tool:'fixture.read',arguments:{id:'a'},result:'[not retained]'}]}, {generate:async()=>assert.fail(),execute:async()=>runs++}),/Budget/);assert.equal(runs,0);
 });
 const register=(definition)=>{const registry=new s.ToolRegistry();registry.register(definition);return new s.ToolExecutor(registry)};
 const full={account:'test',isCurrentAccount:()=>true,accessMode:'full'};
 await test('Only transient safe reads retry once; writes and postcondition failures never retry',async()=>{
  let n=0;const definition={...read(),execute:async()=>{if(++n===1)throw Error('Service indisponible (HTTP 503)');return{id:'ok'}}};await register(definition).run(definition.name,{id:'a'},new Set(),signal(),full);assert.equal(n,2);
  n=0;const write={...definition,name:'fixture.write',permissions:['fixture.write'],risk:'write',externalEffects:true};await assert.rejects(register(write).run(write.name,{id:'a'},new Set(),signal(),full),/503/);assert.equal(n,1);
  n=0;const verify={...definition,verify:async()=>{throw Error('postcondition failed')}};await assert.rejects(register(verify).run(verify.name,{id:'a'},new Set(),signal(),full),/postcondition/);assert.equal(n,2);
 });
 await test('Output schemas reject unconfirmed success; account changes invalidate results',async()=>{
  const definition={...read(),outputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']},execute:async()=>({id:9})};await assert.rejects(register(definition).run(definition.name,{id:'a'},new Set(),signal(),full),/contrat/);
  let account=true;definition.execute=async()=>{account=false;return{id:'ok'}};await assert.rejects(register(definition).run(definition.name,{id:'a'},new Set(),signal(),{...full,isCurrentAccount:()=>account}),/compte Solar/);
 });
 const draftArgs={to:'recipient@example.invalid',subject:'Réponse à Orion',body:'Bonjour,\nLe projet est confirmé.\nMerci.'};
 await test('Gmail draft stores exact MIME then reads back; no send; old scope/read-only do no writes',async()=>{
  globalThis.connection={scopes:['https://www.googleapis.com/auth/gmail.compose']};let posts=0,gets=0;globalThis.fixture=async(service,p,init)=>{assert.equal(service,'gmail');assert(!p.includes('send'));if(init.method==='POST'){posts++;assert.equal(p,'/drafts');const mime=Buffer.from(init.body.message.raw,'base64url').toString();assert(mime.includes(`To: ${draftArgs.to}\r\n`));assert(mime.includes(Buffer.from(draftArgs.body).toString('base64')));return{id:'draft1',message:{id:'msg1'}};}gets++;return{id:'draft1',message:{labelIds:['DRAFT'],payload:{mimeType:'text/plain',headers:[{name:'To',value:draftArgs.to},{name:'Subject',value:`=?UTF-8?B?${Buffer.from(draftArgs.subject).toString('base64')}?=`}],body:{data:Buffer.from(draftArgs.body).toString('base64url')}}}}};
  const def=s.draftTools.find(t=>t.name==='gmail.create_draft');const result=await register(def).run(def.name,draftArgs,new Set(),signal(),full);assert.equal(result.verification,'verified');assert.equal(result.sent,false);assert.equal(posts,1);assert.equal(gets,1);
  await assert.rejects(register(def).run(def.name,draftArgs,new Set(),signal(),{...full,accessMode:'read-only'}),/Lecture seule/);assert.equal(posts,1);
  connection.scopes=[];await assert.rejects(register(def).run(def.name,draftArgs,new Set(),signal(),full),/gmail.compose/);assert.equal(posts,1);
 });
 await test('Outlook draft uses text readback and standard mode approves exact content; failed verification is not success',async()=>{
  let posts=0,approval=0,wrong=false;globalThis.fixture=async(service,p,init)=>{assert.equal(service,'outlook');assert(!p.includes('send'));if(init.method==='POST'){posts++;assert.equal(init.body.body.content,draftArgs.body);return{id:'d1'}}assert.equal(init.preferText,true);return{id:'d1',isDraft:true,subject:wrong?'Changed':draftArgs.subject,toRecipients:[{emailAddress:{address:draftArgs.to}}],body:{contentType:'text',content:draftArgs.body}}};
  const def=s.draftTools.find(t=>t.name==='outlook.create_draft');const result=await register(def).run(def.name,draftArgs,new Set(),signal(),{...full,accessMode:'standard',approve:async req=>{approval++;assert.deepEqual(req.input,draftArgs);return true}});assert.equal(result.verification,'verified');assert.equal(posts,1);assert.equal(approval,1);
  wrong=true;const events=[];await assert.rejects(register(def).run(def.name,draftArgs,new Set(),signal(),{...full,onEvent:e=>events.push(e.status)}),/non confirmé/);assert.equal(posts,2);assert(!events.includes('completed'));assert(events.includes('failed'));
 });
 await test('Calendar persisted dates are independently verified; timezone-free input is rejected',async()=>{
  const args={title:'Orion',start:'2026-10-26T09:00:00+01:00',end:'2026-10-26T09:30:00+01:00'};let wrong=false,posts=0;globalThis.fixture=async(_service,_p,init)=>{if(init.method==='POST'){posts++;return{id:'event1'}}return{id:'event1',summary:'Orion',start:{dateTime:wrong?'2026-10-26T10:00:00+01:00':args.start},end:{dateTime:args.end}}};const def=s.productivityTools.find(t=>t.name==='google-calendar.create_event');const result=await register(def).run(def.name,args,new Set(),signal(),full);assert.equal(result.verification,'verified');wrong=true;await assert.rejects(register(def).run(def.name,args,new Set(),signal(),full),/relecture incohérente/);const before=posts;await assert.rejects(register(def).run(def.name,{...args,start:'2026-10-26T09:00:00'},new Set(),signal(),full),/fuseau|ISO/);assert.equal(posts,before);
 });
 await test('Google updates + Microsoft creates/updates verify persisted UTC instants; impossible dates never dispatch',async()=>{
  for(const name of ['google-calendar.update_event','ms-calendar.create_event','ms-calendar.update_event']){
   const args={id:'event1',title:'Orion',start:'2026-10-26T09:00:00+01:00',end:'2026-10-26T09:30:00+01:00'};if(name.endsWith('create_event'))delete args.id;
   let stored,writes=0;globalThis.fixture=async(_service,_path,init)=>{if(['POST','PATCH'].includes(init.method)){writes++;stored={id:'event1',...init.body};return stored;}return stored;};
   const def=s.productivityTools.find(t=>t.name===name);const result=await register(def).run(name,args,new Set(),signal(),full);assert.equal(result.verification,'verified');assert.equal(writes,1);
   await assert.rejects(register(def).run(name,{...args,start:'2026-02-30T09:00:00+01:00'},new Set(),signal(),full),/impossible/);assert.equal(writes,1);
  }
 });
 await test('Memory correction replaces prior preference; forgetting removes fact; secrets never become facts',async()=>{
  const input={messageId:'a',conversationId:'c',missionId:'m',text:'Je préfère les réponses courtes.'};let book=s.learnNotebook(undefined,input);book=s.learnNotebook(book,{...input,messageId:'b',text:'Correction: je préfère les réponses détaillées.'});assert.equal(book.facts.length,1);assert.equal(book.facts[0].messageId,'b');assert(!JSON.stringify(book).includes('courtes'));book=s.learnNotebook(book,{...input,text:'Je préfère les réponses en français.'});assert.equal(book.facts.length,2);assert(book.facts.some(f=>f.slot==='preference:language'));book=s.learnNotebook(book,{...input,text:'Oublie mes préférences.'});assert.equal(book.facts.length,0);book=s.learnNotebook(book,{...input,text:'Je préfère api key: sk-FAKE_SECRET_ONLY.'});assert.equal(book.facts.length,0);
 });
 await test('Source hashes ignore volatile timestamps; unchanged watch is silent; change notifies once; errors preserve baseline',async()=>{
  const calls=value=>[{tool:'github.repository_activity',arguments:{id:'a'},result:JSON.stringify({value,observedAt:crypto.randomUUID()}),externalEffects:false}];const a=await s.evidenceDigest(calls('a')),same=await s.evidenceDigest(calls('a')),b=await s.evidenceDigest(calls('b'));assert.equal(a,same);assert.notEqual(a,b);const profile=date=>[{tool:'github.profile_activity',arguments:{},result:JSON.stringify({observedAt:date,period:{from:date,to:date},contributions:{count:42}})}];assert.equal(await s.evidenceDigest(profile('day1')),await s.evidenceDigest(profile('day2')));const business=date=>[{tool:'other.read',arguments:{},result:JSON.stringify({requestedAt:date})}];assert.notEqual(await s.evidenceDigest(business('day1')),await s.evidenceDigest(business('day2')));
  let watch={notifyOn:'changes'};let result=s.watchOutcome(watch,{status:'completed',evidenceDigest:a});assert(!result.notify);watch={...watch,...result.update};result=s.watchOutcome(watch,{status:'completed',evidenceDigest:same});assert(!result.notify);result=s.watchOutcome(watch,{status:'completed',evidenceDigest:b});assert(result.notify);watch={...watch,...result.update};assert(!s.watchOutcome(watch,{status:'completed',evidenceDigest:b}).notify);const failed=s.watchOutcome(watch,{status:'partial',evidenceDigest:'bad'});assert(failed.notify);assert(!Object.hasOwn(failed.update,'lastEvidenceDigest'));assert(s.watchOutcome(watch,{status:'completed'}).error);
 });
 await test('Scheduled result finalization is atomic across duplicate runners',async()=>{
  await s.solarAgentStore.saveAgent({id:'atlas',ownerId:s.currentAccountScope(),name:'Atlas',enabled:true});const at=new Date().toISOString();await s.solarAgentStore.saveAutomation({id:'watch',agentId:'atlas',instruction:'Observe fixture',frequency:'daily',localTime:'09:00',timezone:'UTC',enabled:true,createdAt:at,updatedAt:at,nextRunAt:at,notifyOn:'changes',lastResult:'Mission m démarrée.'});const mission={id:'m',agentId:'atlas',status:'completed',evidenceDigest:'new',createdAt:at,updatedAt:at,events:[]};const results=await Promise.all([s.solarAgentStore.completeAutomationCheck('watch',mission),s.solarAgentStore.completeAutomationCheck('watch',mission)]);assert.equal(results.filter(r=>r).length,1);assert.equal((await s.solarAgentStore.snapshot()).automations[0].lastEvidenceDigest,'new');
 });
 console.log(`Solar JIT contracts: ${checks}/${checks} groups passed; isolated provider boundaries, no personal service data or writes.`);
}finally{await rm(dir,{recursive:true,force:true});}
