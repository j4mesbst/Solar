import assert from 'node:assert/strict';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { recoverStandaloneHtml } from '../src/lib/cortex/structured.ts';
import { sourceHash } from '../src/lib/cortex/semantic.ts';

const signal=new AbortController().signal;
const initial='<!doctype html><html><body></body></html>';
const complete='<!doctype html><html><body><aside>Menu</aside><main><input aria-label="message"><button>Un</button><button>Deux</button><button>Trois</button></main></body></html>';
const project={id:'first-artifact',name:'first-artifact',files:['index.html'],readFile:async()=>initial};
const request={conversationId:'first-artifact',prompt:'Crée une interface HTML autonome dans index.html avec un menu latéral, une chatbox et trois boutons.',modelId:'mock-local',modelFacts:{endpoint:'mock://local',modelId:'mock-local',contextWindow:8192},project,mode:'fast',allowChanges:true,signal};
const services={persistence:{save:async()=>{},load:async()=>undefined},render:async()=>({supported:true,width:800,height:600,errors:[],frames:[{timestamp:0,image:'',overflow:0,elements:[]}],interactions:[]})};

const prefix='```html index.html\n<!doctype html><html><body><aside>Menu</aside><main><input aria-label="message"><button>Un</button>';
const suffix='<button>Deux</button><button>Trois</button></main></body></html>\n```';
assert.deepEqual(JSON.parse(recoverStandaloneHtml(prefix,suffix,['index.html'])).actions[0],{type:'replaceFile',path:'index.html',content:complete});
assert.equal(recoverStandaloneHtml(prefix,'<button>Deux',['index.html']),undefined);
assert.equal(recoverStandaloneHtml(prefix,complete,['index.html']),undefined,'a restarted standalone document must not replace the retained prefix');

// A length-limited first document is retained, continued once, validated as a
// complete document and only then converted into a file mutation.
let calls=0,checks=0;
const continued=await new CortexRuntime().run({...request,limits:{maxAgentSteps:4}},{...services,
  generate:async call=>{
    calls++;
    if(calls===1){assert.equal(call.schema,undefined);assert.equal(call.maxOutputTokens,1100);assert.match(call.system,/maximum 2600 caractères/i);return {text:prefix,stopReason:'length'};}
    assert.equal(call.schema,undefined,'the standalone continuation must not switch to the generic action schema');
    assert.match(call.context.next,/Continue uniquement le document HTML commencé/);
    return {text:suffix,stopReason:'stop'};
  },
  verify:async changes=>{checks++;assert.equal(changes[0]?.after,complete);return [{type:'tests',origin:'independent',status:'passed',success:true,output:'Document indépendant vérifié.'}];},
});
assert.equal(continued.task.phase,'completed',JSON.stringify(continued.task.issues));
assert.equal(calls,2);assert.equal(checks,1);assert.equal(continued.task.pendingStandaloneHtml,undefined);

// The short baseline is independently checked before an evidence-driven
// improvement. User requirements remain in context for the second mutation.
const baseline='<!doctype html><html><body><aside>Menu</aside><main><input aria-label="message"><button>Un</button><button>Deux</button><button>Trois</button></main></body></html>';
const refined='<!doctype html><html><body><aside aria-label="Navigation">Menu</aside><main><input aria-label="message"><button>Un</button><button>Deux</button><button>Trois</button></main></body></html>';
let progressiveCalls=0,progressiveChecks=0;
const progressive=await new CortexRuntime().run({...request,conversationId:'progressive-artifact',limits:{maxAgentSteps:4}},{...services,
  generate:async call=>{
    progressiveCalls++;
    if(progressiveCalls===1)return {text:`\`\`\`html index.html\n${baseline}\n\`\`\``,stopReason:'stop'};
    assert.match(call.prompt,/menu latéral/i);
    return {text:JSON.stringify({actions:[{type:'replaceRange',path:'index.html',start:1,end:1,content:refined,sourceHash:sourceHash(baseline)}]}),stopReason:'stop'};
  },
  verify:async changes=>{
    progressiveChecks++;
    return progressiveChecks===1
      ? [{type:'render',origin:'independent',status:'failed',success:false,output:'Navigation sans label accessible.'}]
      : [{type:'render',origin:'independent',status:'passed',success:true,output:'Navigation et contrôles vérifiés.'}];
  },
});
assert.equal(progressive.task.phase,'completed',JSON.stringify(progressive.task.issues));
assert.equal(progressiveCalls,2);assert.equal(progressiveChecks,2);assert.equal(progressive.changes[0]?.after,refined);

// A malformed continuation is never staged or verified. Its temporary prefix
// is discarded safely instead of applying a partial page.
let failedCalls=0,failedChecks=0;
const incomplete=await new CortexRuntime().run({...request,conversationId:'bad-continuation',limits:{maxAgentSteps:2}},{...services,
  generate:async()=>({text:++failedCalls===1?prefix:'<button>Deux',stopReason:failedCalls===1?'length':'stop'}),
  verify:async()=>{failedChecks++;return [];},
});
assert.equal(incomplete.changes.length,0);assert.equal(failedChecks,0);assert.equal(incomplete.task.pendingStandaloneHtml,undefined);assert.notEqual(incomplete.task.phase,'completed');

// Once the first artifact route fails, the follow-up schema offers mutations
// and reads but never visual inspection of the unchanged document.
let fallbackCalls=0,fallbackChecks=0;
const fallback=await new CortexRuntime().run({...request,conversationId:'no-empty-inspection',limits:{maxAgentSteps:3}},{...services,
  generate:async call=>{
    fallbackCalls++;
    if(fallbackCalls===1){assert.equal(call.schema,undefined);return {text:'HTML incomplet',stopReason:'stop'};}
    const actions=call.schema.properties.actions.items.oneOf.map(item=>item.properties.type.enum[0]);
    assert(!actions.includes('inspectUI'));assert(!actions.includes('inspectMotion'));assert(!actions.includes('renderPreview'));assert(!actions.includes('inspectRender'));
    assert(actions.includes('replaceFile'));
    return {text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:complete}]}),stopReason:'stop'};
  },
  verify:async changes=>{fallbackChecks++;assert.equal(changes[0]?.after,complete);return [{type:'tests',origin:'independent',status:'passed',success:true,output:'Création vérifiée.'}];},
});
assert.equal(fallback.task.phase,'completed',JSON.stringify(fallback.task.issues));
assert.equal(fallbackCalls,2);assert.equal(fallbackChecks,1);

// A stale textual patch is rejected once. The recovery schema is then narrowed
// to a range replacement with the live path and hash, so it cannot repeat the
// unsafe patch or replace the entire file.
let conflictCalls=0,conflictChecks=0;
const conflict=await new CortexRuntime().run({...request,conversationId:'conflict-recovery',limits:{maxAgentSteps:4}},{...services,
  generate:async call=>{
    conflictCalls++;
    if(conflictCalls===1)return {text:'HTML incomplet',stopReason:'stop'};
    if(conflictCalls===2)return {text:JSON.stringify({actions:[{type:'patchFile',path:'index.html',oldText:'<body>ancien</body>',newText:'<body>nouveau</body>'}]}),stopReason:'stop'};
    const actions=call.schema.properties.actions.items.oneOf;
    const names=actions.map(item=>item.properties.type.enum[0]);
    assert.deepEqual(names.sort(),['readFileRange','replaceRange']);
    const range=actions.find(item=>item.properties.type.enum[0]==='replaceRange');
    assert.deepEqual(range.properties.path.enum,['index.html']);
    assert.deepEqual(range.properties.sourceHash.enum,[sourceHash(initial)]);
    return {text:JSON.stringify({actions:[{type:'replaceRange',path:'index.html',start:1,end:1,content:complete,sourceHash:sourceHash(initial)}]}),stopReason:'stop'};
  },
  verify:async changes=>{conflictChecks++;assert.equal(changes[0]?.after,complete);return [{type:'tests',origin:'independent',status:'passed',success:true,output:'Réparation atomique vérifiée.'}];},
});
assert.equal(conflict.task.phase,'completed',JSON.stringify(conflict.task.issues));
assert.equal(conflictCalls,3);assert.equal(conflictChecks,1);
console.log('Cortex First Working Artifact: safe HTML continuation, incomplete discard, mutation-first recovery and independent verification — PASS');
