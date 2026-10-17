import assert from 'node:assert/strict';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { availableSymbols } from '../src/lib/cortex/semantic.ts';

const signal=new AbortController().signal;
const generated=actions=>({text:JSON.stringify({actions}),stopReason:'stop'});

// Exact regression from ui-description: an HTML-only project has no semantic
// symbols, so an opaque readSymbol id must never be offered to the model.
const htmlSource='<!doctype html><html><body></body></html>';
const htmlProject={id:'no-symbols',name:'No symbols',files:['index.html'],readFile:async()=>htmlSource};
assert.deepEqual(await availableSymbols(htmlProject,[],['index.html'],signal),[]);
let htmlCalls=0,htmlChecks=0;
const htmlResult=await new CortexRuntime().run({conversationId:'no-symbols',prompt:'Corrige index.html en ajoutant une langue et un titre Solar.',modelId:'mock-local',modelFacts:{endpoint:'mock://local',modelId:'mock-local',contextWindow:8192},project:htmlProject,mode:'fast',allowChanges:true,signal,limits:{maxAgentSteps:4}}, {
  persistence:{save:async()=>{},load:async()=>undefined},
  generate:async call=>{
    htmlCalls++;
    if(!call.schema)return {text:'```html index.html\n<!doctype html><html lang="fr"><body></body></html>\n```',stopReason:'stop'};
    assert.deepEqual(call.context.state.availableSymbols,[]);
    const schema=JSON.stringify(call.schema);
    const actionNames=call.schema.properties.actions.items.oneOf.map(item=>item.properties.type.enum[0]);
    assert(!schema.includes('readSymbol'),'readSymbol must be absent when no usable id exists');
    assert(!schema.includes('searchSymbol'),'searchSymbol must be absent when the selected sources cannot expose symbols');
    assert(schema.includes('patchFile'),'file editing fallback must remain available');
    if(htmlCalls===2){
      assert(actionNames.includes('readFile'),'the current file may be read once when the model needs it');
      return generated([{type:'readFile',path:'index.html'}]);
    }
    assert(!actionNames.includes('readFile'),'an exact full-file read must not be offered again for the same hash');
    return generated([{type:'patchFile',path:'index.html',oldText:'<html lang="fr">',newText:'<html lang="fr"><head><title>Solar</title></head>'}]);
  },
  verify:async changes=>{
    htmlChecks++;
    const value=changes[0]?.after??htmlSource;
    return [{type:'tests',origin:'independent',status:value.includes('<title>Solar</title>')?'passed':'failed',success:value.includes('<title>Solar</title>'),output:value.includes('<title>Solar</title>')?'Document valide.':'Titre manquant.'}];
  },
  render:async()=>({supported:true,width:800,height:600,errors:[],frames:[{timestamp:0,image:'',overflow:0,elements:[]}],interactions:[]}),
});
assert.equal(htmlResult.task.phase,'completed',JSON.stringify({issues:htmlResult.task.issues,events:htmlResult.task.events}));
assert.equal(htmlCalls,3);
assert.equal(htmlChecks,2);

// When a current source really exposes a symbol, the context and JSON schema
// must publish the same exact, hash-bound identifier and readSymbol may use it.
const tsSource='export function value() { return 0; }\n';
const tsProject={id:'with-symbol',name:'With symbol',files:['src/value.ts'],readFile:async()=>tsSource};
const discovered=await availableSymbols(tsProject,[],['src/value.ts'],signal);
assert.equal(discovered.length,1);
let symbolCalls=0;
const symbolResult=await new CortexRuntime().run({conversationId:'with-symbol',prompt:'Modifie src/value.ts pour que value retourne 1.',modelId:'mock-local',modelFacts:{endpoint:'mock://local',modelId:'mock-local',contextWindow:8192},project:tsProject,mode:'fast',allowChanges:true,signal,limits:{maxAgentSteps:4}}, {
  persistence:{save:async()=>{},load:async()=>undefined},
  generate:async call=>{
    symbolCalls++;
    const visible=call.context.state.availableSymbols;
    assert(visible.some(symbol=>symbol.id===discovered[0].id));
    const readSchema=call.schema.properties.actions.items.oneOf.find(item=>item.properties.type.enum[0]==='readSymbol');
    assert(readSchema,'readSymbol should be offered with a usable current id');
    assert.deepEqual(readSchema.properties.symbolId.enum,[discovered[0].id]);
    return symbolCalls===1
      ?generated([{type:'readSymbol',symbolId:discovered[0].id}])
      :generated([{type:'patchFile',path:'src/value.ts',oldText:'return 0',newText:'return 1'}]);
  },
  verify:async changes=>[{type:'tests',origin:'independent',status:changes[0]?.after.includes('return 1')?'passed':'failed',success:Boolean(changes[0]?.after.includes('return 1')),output:'Valeur vérifiée.'}],
});
assert.equal(symbolResult.task.phase,'completed',JSON.stringify({issues:symbolResult.task.issues,events:symbolResult.task.events}));
assert.equal(symbolCalls,2);
console.log('Cortex readSymbol contract: unavailable tools removed, exact current ids exposed, file fallback and verified continuation — PASS');
