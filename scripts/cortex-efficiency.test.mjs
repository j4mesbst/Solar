import assert from 'node:assert/strict';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { prepareContext } from '../src/lib/cortex/context.ts';
import { analyzeIntent } from '../src/lib/agent/intent.ts';
import { sourceHash } from '../src/lib/cortex/semantic.ts';
import { compactPromptFiles, cortexTurnPrompt } from '../src/lib/cortex/prompt.ts';

const signal=new AbortController().signal;
const sources=new Map([['a.ts','export const a = 0;'],['b.ts','export const b = 0;']]);
const project={id:'transactions',name:'transactions',files:[...sources.keys()],readFile:async path=>sources.get(path)??''};
const persistence={save:async()=>{},load:async()=>undefined};
const request={conversationId:'transactions',prompt:'Modifie a.ts et b.ts pour avoir la valeur 1.',modelId:'arbitrary-local-model',project,mode:'fast',allowChanges:true,signal,limits:{maxAgentSteps:3}};
const pass=async()=>[{type:'build',status:'passed',success:true,output:'ok'}];
let calls=0,checks=0;
const atomic=await new CortexRuntime().run(request,{persistence,generate:async call=>{
  calls++;
  if(calls===2){
    assert(!call.prompt.includes('export const a = 1;'),'the failed multi-file turn must roll back a.ts');
    assert.match(call.prompt,/export const a = 0;/);
  }
  return {text:JSON.stringify({actions:calls===1?[
    {type:'patchFile',path:'a.ts',oldText:'= 0',newText:'= 1'},
    {type:'patchFile',path:'b.ts',oldText:'absent',newText:'= 1'},
  ]:[
    {type:'patchFile',path:'a.ts',oldText:'= 0',newText:'= 1'},
    {type:'replaceRange',path:'b.ts',start:1,end:1,content:'export const b = 1;',sourceHash:sourceHash(sources.get('b.ts'))},
  ]}),stopReason:'stop'};
},verify:async()=>{checks++;return pass();}});
assert.equal(atomic.task.phase,'completed',JSON.stringify(atomic.task.issues));
assert.equal(checks,1);assert.equal(atomic.changes.length,2);
assert.equal(atomic.task.telemetry.rolledBackTransactions,1);
assert.equal(sources.get('a.ts'),'export const a = 0;');

// A successful verifier cannot authorize a stale proposal when another
// process changed the base file during that very verification.
let live='export const a = 0;',proposals=0;
const drift=await new CortexRuntime().run({...request,project:{...project,files:['a.ts'],readFile:async()=>live}},{persistence,
  generate:async()=>({text:JSON.stringify({actions:[{type:'patchFile',path:'a.ts',oldText:'= 0',newText:'= 1'}]}),stopReason:'stop'}),
  verify:async()=>{live='export const a = 42;';return pass();},onProposal:async()=>{proposals++;},
});
assert.equal(drift.task.phase,'paused');assert.equal(proposals,0);assert.match(drift.task.issues[0],/changé sur disque/);
assert.equal(live,'export const a = 42;');

// Syntax failure must suppress every expensive verifier/render path.
let renders=0,executions=0;
const syntax=await new CortexRuntime().run({...request,prompt:'Crée une interface HTML animée.',project:{...project,files:['index.html'],readFile:async()=>'<html></html>'},limits:{maxAgentSteps:1}},{persistence,
 generate:async()=>({text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:'<html><body><script>const broken = ;</script></body></html>'}]}),stopReason:'stop'}),
 verify:async()=>{executions++;return pass();},render:async()=>{renders++;throw Error('must not render invalid JS');},
});
assert.equal(syntax.task.phase,'paused');assert.equal(renders,0);assert.equal(executions,0);assert.equal(syntax.task.telemetry.syntaxGates,1);

// A temporary verifier outage retries the verifier itself, preserving the
// proposal and avoiding a second generation of exactly the same valid edit.
let verifierCalls=0,generations=0;
const recovered=await new CortexRuntime().run(request,{persistence,generate:async()=>{generations++;return{text:JSON.stringify({actions:[{type:'patchFile',path:'a.ts',oldText:'= 0',newText:'= 1'}]}),stopReason:'stop'};},
 verify:async()=>{if(++verifierCalls===1)throw Error('temporary verifier unavailable');return pass();},
});
assert.equal(recovered.task.phase,'completed');assert.equal(generations,1);assert.equal(verifierCalls,2);assert.equal(recovered.task.rejectedActions,undefined);

const many={id:'focused-context',name:'focused-context',files:['README.md',...Array.from({length:40},(_,i)=>`src/component-${i}.ts`),'src/failed.ts'],readFile:async path=>`export const ${path.endsWith('failed.ts')?'broken':'value'} = 0;`};
const context=await prepareContext(analyzeIntent('Corrige le composant de cette application.'),many,8192,2,signal,[],true,['src/failed.ts']);
assert.equal(context.files[0].path,'src/failed.ts');
assert(context.architectureSummary.includes('src/failed.ts'));
const largePrompt=cortexTurnPrompt('Corrige le handler sans changer le design.',{
  ...context,files:[{path:'src/failed.ts',content:'export const x = 0;\n'.repeat(300),score:100}],
},{plan:[],issues:['Le clic laisse le contenu inchangé.'],changes:[],next:'Réparer le handler.'})+'\nSOURCE ACTUELLE CERTIFIÉE src/failed.ts #abc\n1: source courante';
const compact=compactPromptFiles(largePrompt,1200);
assert(compact.length<=1200);assert.match(compact,/Corrige le handler sans changer le design/);
assert.match(compact,/clic laisse le contenu inchangé/);assert.match(compact,/SOURCE ACTUELLE CERTIFIÉE src\/failed.ts #abc/);
assert.match(compact,/Source omise/);assert(!compact.includes('export const x'));
assert.throws(()=>compactPromptFiles('Objectif indispensable '.repeat(300),500),/CORTEX_CONTEXT/);
console.log('cortex-efficiency: atomic multi-file rollback, concurrent-source guard, syntax gating, verifier recovery and focused context — ok');
