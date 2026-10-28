import assert from 'node:assert/strict';
import vm from 'node:vm';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { classifyRepair } from '../src/lib/cortex/repair.ts';
import { verifyStagedChanges } from '../src/lib/agent/verification.ts';
import { sourceHash } from '../src/lib/cortex/semantic.ts';
import { recoverStandaloneHtml } from '../src/lib/cortex/structured.ts';
import { parseAgentResponse } from '../src/lib/agent/actions.ts';

const signal=new AbortController().signal;
const context={files:[],estimatedTokens:0,budget:8192};
const change=(path,after)=>({path,before:'',after});
const staticChecks=async changes=>verifyStagedChanges(changes,context,changes.map(item=>item.path),signal);
const circular=[change('src/index.cjs',"const { formatName } = require('./format.cjs');\nmodule.exports = { formatName };"),change('src/format.cjs',"const { formatName } = require('./index.cjs');\nmodule.exports = { formatName };")];
assert((await staticChecks(circular)).some(item=>!item.success&&/Import circulaire/.test(item.output)));
const absent=[change('src/index.cjs',"const { formatName } = require('./format.cjs');\nmodule.exports = { formatName };"),change('src/format.cjs','module.exports = {};')];
assert((await staticChecks(absent)).some(item=>!item.success&&/ne l'exporte pas/.test(item.output)));
const valid=[change('src/index.cjs',"const { formatName } = require('./format.cjs');\nmodule.exports = { formatName };"),change('src/format.cjs',"function formatName(first,last) { return `${first} ${last}`.trim(); }\nmodule.exports = { formatName };")];
assert(!(await staticChecks(valid)).some(item=>!item.success));
const esm=[change('src/main.ts',"import { formatName } from './format.ts';\nexport const name = formatName('Ada','Lovelace');"),change('src/format.ts','export const other = 1;')];
assert((await staticChecks(esm)).some(item=>!item.success&&/n'exporte pas/.test(item.output)));

const checks=(type,output,file,line)=>[{type,status:'failed',success:false,output,file,line}];
assert.equal(classifyRepair(checks('tests','TypeError: clamp is not a function','src/value.cjs'),[change('src/value.cjs','function clamp() {}\nmodule.exports = {};')])?.kind,'contract');
assert.match(classifyRepair(checks('tests',"check.cjs:1\na.equal(require('./src/index.cjs').formatName('Ada','Lovelace'),'Ada Lovelace');\nTypeError: require(...).formatName is not a function",'src/index.cjs'),valid)?.brief??'',/Appel indépendant échoué.*formatName\('Ada','Lovelace'\)/);
assert.equal(classifyRepair(checks('tests',"AssertionError: Expected values to be strictly equal:\n+ actual - expected\n+ 'ADA'\n- 'Ada Lovelace'",'src/index.cjs'),valid)?.kind,'contract');
const syntaxSource='<html><body>\n<script>\nconst x = 1;\nfunction go() {\n  ajouter<div class="msg">\n}\n</script>\n</body></html>';
const syntaxTarget=classifyRepair(checks('syntax','index.html:5:16 Missing semicolon','index.html',5),[change('index.html',syntaxSource)]);
assert.equal(syntaxTarget?.kind,'syntax');assert.match(syntaxTarget.brief,/5:16|5:/);assert.match(syntaxTarget.brief,/ajouter<div/);
const prefix='```html index.html\n<html><head><style>.button{width:100%;text-align:left;padding:10px}</style></head><body><script>const d=';
assert.equal(recoverStandaloneHtml(prefix,'100%;text-align:left;padding:10px}</style></head><body><script>const d=1;</script></body></html>\n```',['index.html']),undefined);
assert(recoverStandaloneHtml(prefix,'1;</script></body></html>\n```',['index.html']));

const persistence={save:async()=>{},load:async()=>undefined};
const makeProject=files=>({id:'phase-1-4',name:'phase-1-4',files:Object.keys(files),readFile:async path=>files[path]??''});
const base={conversationId:'phase-1-4',modelId:'test-local',mode:'fast',allowChanges:true,signal,limits:{maxAgentSteps:4}};
let featureCalls=0;
const feature=await new CortexRuntime().run({...base,prompt:'Ajoute clamp(value, min, max) dans src/value.cjs et exporte cette fonction.',project:makeProject({'src/value.cjs':'module.exports = {};'})},{persistence,
  generate:async call=>{
    featureCalls++;
    if(featureCalls===2){
      assert.match(call.context.next,/CONTRAT D.EXÉCUTION/);
      assert.match(JSON.stringify(call.context),/module\.exports = \{\}/);
      assert(!call.schema.properties.actions.items.oneOf.some(item=>item.properties.type.enum[0]==='runCheck'));
    }
    return {text:JSON.stringify({actions:featureCalls===1?[{type:'replaceFile',path:'src/value.cjs',content:'function clamp(value,min,max) { return Math.min(Math.max(value,min),max); }\nmodule.exports = {};'}]:[{type:'patchFile',path:'src/value.cjs',oldText:'module.exports = {};',newText:'module.exports = { clamp };'}]}),stopReason:'stop'};
  },
  verify:async changes=>[{type:'tests',status:/module\.exports\s*=\s*\{\s*clamp\s*\}/.test(changes[0].after)?'passed':'failed',success:/module\.exports\s*=\s*\{\s*clamp\s*\}/.test(changes[0].after),output:/module\.exports\s*=\s*\{\s*clamp\s*\}/.test(changes[0].after)?'ok':'TypeError: clamp is not a function',file:'src/value.cjs'}],
});
assert.equal(feature.task.phase,'completed',JSON.stringify(feature.task.issues));assert.equal(featureCalls,2);

const commonJsResult=changes=>{
  const sources=new Map(changes.map(item=>[item.path,item.after]));
  const cache=new Map();
  const load=path=>{
    if(cache.has(path))return cache.get(path).exports;
    const module={exports:{}};cache.set(path,module);
    const require=specifier=>load(`src/${specifier.replace(/^\.\//,'')}`);
    vm.runInNewContext(`(function(require,module,exports){${sources.get(path)}\n})`,{})(require,module,module.exports);
    return module.exports;
  };
  try{assert.equal(load('src/index.cjs').formatName('Ada','Lovelace'),'Ada Lovelace');return {type:'tests',status:'passed',success:true,output:'ok'};}
  catch(error){return {type:'tests',status:'failed',success:false,output:String(error),file:'src/index.cjs'};}
};
let refactorCalls=0;
const refactor=await new CortexRuntime().run({...base,prompt:'Déplace formatName(first, last) de src/index.cjs vers src/format.cjs et réexporte-la sans changer son résultat.',project:makeProject({'src/index.cjs':"exports.formatName = (first,last) => `${first} ${last}`.trim();",'src/format.cjs':'module.exports = {};'})},{persistence,
  generate:async call=>{
    refactorCalls++;
    if(refactorCalls===2){assert.match(call.context.next,/CONTRAT D.IMPORT/);assert.match(JSON.stringify(call.context),/module\.exports = \{ formatName \}/);assert(!call.schema.properties.actions.items.oneOf.some(item=>item.properties.type.enum[0]==='runCheck'));}
    if(refactorCalls===3){assert.match(call.context.next,/CONTRAT D.EXÉCUTION/);assert.match(JSON.stringify(call.context),/SOURCE ORIGINALE AVANT REFACTOR/);assert.match(JSON.stringify(call.context),/first,last/);assert(!call.schema.properties.actions.items.oneOf.some(item=>item.properties.type.enum[0]==='runCheck'));}
    return {text:JSON.stringify({actions:refactorCalls===1?[
      {type:'replaceFile',path:'src/index.cjs',content:"const { formatName } = require('./format.cjs');\nmodule.exports = { formatName };"},
      {type:'replaceFile',path:'src/format.cjs',content:"const { formatName } = require('./index.cjs');\nmodule.exports = { formatName };"},
    ]:refactorCalls===2?[
      {type:'replaceFile',path:'src/index.cjs',content:"const { formatName } = require('./format.cjs');\nmodule.exports = { formatName };"},
      {type:'replaceFile',path:'src/format.cjs',content:"function formatName(name) { return name; }\nmodule.exports = { formatName };"},
    ]:[
      {type:'replaceFile',path:'src/index.cjs',content:"const { formatName } = require('./format.cjs');\nmodule.exports = { formatName };"},
      {type:'replaceFile',path:'src/format.cjs',content:"function formatName(first,last) { return `${first} ${last}`.trim(); }\nmodule.exports = { formatName };"},
    ]}),stopReason:'stop'};
  },verify:async changes=>[commonJsResult(changes)],
});
assert.equal(refactor.task.phase,'completed',JSON.stringify(refactor.task.issues));assert.equal(refactorCalls,3);
let exportCalls=0;
const exportRepair=await new CortexRuntime().run({...base,conversationId:'phase-1-4-export-structure',prompt:'Déplace formatName(first,last) vers src/format.cjs et réexporte depuis src/index.cjs sans changer le résultat.',project:makeProject({'src/index.cjs':"exports.formatName = (first,last) => `${first} ${last}`.trim();",'src/format.cjs':'module.exports = {};'})},{persistence,
  generate:async call=>{
    exportCalls++;
    if(exportCalls===2){assert.match(call.context.next,/Export invalide/);assert.match(JSON.stringify(call.context),/SOURCE COURANTE src\/index.cjs/);assert.match(JSON.stringify(call.context),/SOURCE COURANTE src\/format.cjs/);assert(!call.schema.properties.actions.items.oneOf.some(item=>item.properties.type.enum[0]==='runCheck'));}
    return {text:JSON.stringify({actions:exportCalls===1?[
      {type:'replaceFile',path:'src/format.cjs',content:"const formatName=(first,last)=>`${first} ${last}`.trim(); module.exports={formatName};"},
      {type:'replaceFile',path:'src/index.cjs',content:'module.exports={formatName};'},
    ]:[{type:'replaceFile',path:'src/index.cjs',content:"const {formatName}=require('./format.cjs'); module.exports={formatName};"}]}),stopReason:'stop'};
  },verify:async changes=>[commonJsResult(changes)],
});
assert.equal(exportRepair.task.phase,'completed',JSON.stringify(exportRepair.task.issues));assert.equal(exportCalls,2);
let rollbackCalls=0;
const restored=await new CortexRuntime().run({...base,conversationId:'phase-1-4-rejected-import',prompt:'Déplace formatName(first,last) vers src/format.cjs et réexporte depuis src/index.cjs.',project:makeProject({'src/index.cjs':"exports.formatName = (first,last) => `${first} ${last}`.trim();",'src/format.cjs':'module.exports = {};'})},{persistence,
  generate:async call=>{
    rollbackCalls++;
    if(rollbackCalls===3){assert.match(JSON.stringify(call.context),/DERNIER ESSAI REJETÉ/);assert.match(JSON.stringify(call.context),/format\.cjs/);assert(!call.schema.properties.actions.items.oneOf.some(item=>item.properties.type.enum[0]==='inspectUI'));}
    return {text:JSON.stringify({actions:rollbackCalls===1?[
      {type:'replaceFile',path:'src/format.cjs',content:"module.exports={formatName:(first,last)=>`${first} ${last}`.trim()};"},
      {type:'replaceFile',path:'src/index.cjs',content:'module.exports={};'},
    ]:rollbackCalls===2?[
      {type:'replaceFile',path:'src/index.cjs',content:"const {formatName}=require('./format'); module.exports={formatName};"},
    ]:[
      {type:'replaceFile',path:'src/index.cjs',content:"const {formatName}=require('./format.cjs'); module.exports={formatName};"},
    ]}),stopReason:'stop'};
  },verify:async changes=>[commonJsResult(changes)],
});
assert.equal(restored.task.phase,'completed',JSON.stringify(restored.task.issues));assert.equal(rollbackCalls,3);

let uiCalls=0;
const bad='<html><body><script>\nfunction send() {\n  ajouter<div class="msg">\n}\n</script></body></html>';
const good=bad.replace('ajouter<div class="msg">','return document.createElement("div");');
const ui=await new CortexRuntime().run({...base,prompt:'Crée une interface HTML de chat fonctionnelle.',project:makeProject({'index.html':'<html></html>'})},{persistence,
  generate:async call=>{
    uiCalls++;
    if(uiCalls===2){assert.match(call.context.next,/Syntaxe invalide/);assert.match(JSON.stringify(call.context),/ajouter<div/);assert(!call.schema.properties.actions.items.oneOf.some(item=>item.properties.type.enum[0]==='runCheck'));}
    return {text:JSON.stringify({actions:uiCalls===1?[{type:'replaceFile',path:'index.html',content:bad}]:[{type:'replaceRange',path:'index.html',start:3,end:3,content:'  return document.createElement("div");',sourceHash:sourceHash(bad)}]}),stopReason:'stop'};
  },verify:async()=>[{type:'build',status:'passed',success:true,output:'ok'},{type:'visual',status:'passed',success:true,output:'Rendu indépendant observé.'}],
});
assert.equal(ui.task.phase,'completed',JSON.stringify(ui.task.issues));assert.equal(ui.changes[0].after,good);assert.equal(uiCalls,2);
let continuationCalls=0,continuationChecks=0;
const htmlPrefix='```html index.html\n<html><head><style>.chat{display:flex}</style></head><body><main><button>Envoyer</button><script>const x=';
const compactHtml='<html><head><style>body{margin:0}</style></head><body><aside>Menu</aside><main><input><button>Un</button><button>Deux</button><button>Trois</button></main></body></html>';
const retrySplit=compactHtml.indexOf('<button>Deux');
const restarted=await new CortexRuntime().run({...base,conversationId:'phase-1-4-standalone-restart',prompt:'Crée une interface HTML autonome dans index.html avec un menu latéral, une chatbox et trois boutons.',project:makeProject({'index.html':'<html></html>'})},{persistence,
  generate:async call=>{
    continuationCalls++;
    if(continuationCalls===1)return {text:htmlPrefix,stopReason:'length'};
    if(continuationCalls===2)return {text:'</style></head><body><main><button>Envoyer</button></main></body></html>\n```',stopReason:'stop'};
    if(continuationCalls===3){assert.equal(call.schema,undefined);assert.match(call.system,/maximum 1200 caractères/);return {text:`\`\`\`html index.html\n${compactHtml.slice(0,retrySplit)}`,stopReason:'length'};}
    assert.equal(call.schema,undefined);assert.match(call.context.next,/Continue uniquement le document HTML commencé/);
    return {text:`${compactHtml.slice(retrySplit)}\n\`\`\``,stopReason:'stop'};
  },
  render:async()=>({supported:true,width:800,height:600,errors:[],frames:[{timestamp:0,image:'',overflow:0,elements:[]}],interactions:[]}),
  verify:async changes=>{continuationChecks++;assert.equal(changes[0].after,compactHtml);return [{type:'visual',status:'passed',success:true,output:'Rendu indépendant.'}];},
});
assert.equal(restarted.task.phase,'completed',JSON.stringify(restarted.task.issues));assert.equal(continuationCalls,4);assert.equal(continuationChecks,1);
let fallbackTurns=0;
const compactFallback=await new CortexRuntime().run({...base,conversationId:'phase-1-4-compact-fallback',limits:{maxAgentSteps:7},prompt:'Crée une interface HTML autonome dans index.html avec un menu latéral, une chatbox et trois boutons.',project:makeProject({'index.html':'<html></html>'})},{persistence,
  generate:async call=>{
    fallbackTurns++;
    if(fallbackTurns===1||fallbackTurns===3)return {text:fallbackTurns===1?htmlPrefix:htmlPrefix.replace('display:flex','display:grid'),stopReason:'length'};
    if(fallbackTurns===2||fallbackTurns===4)return {text:'</style></head><body><main><button>Envoyer</button></main></body></html>\n```',stopReason:'stop'};
    assert.equal(call.schema.properties.actions.maxItems,1);
    assert(call.schema.properties.actions.items.oneOf.every(item=>item.properties.content.maxLength===2500));
    if(fallbackTurns===5)return {text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:'readRenderPreview'}]}),stopReason:'stop'};
    return {text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:compactHtml}]}),stopReason:'stop'};
  },verify:async changes=>{assert.equal(changes[0].after,compactHtml);return [{type:'visual',status:'passed',success:true,output:'Rendu indépendant.'}];},
});
assert.equal(compactFallback.task.phase,'completed',JSON.stringify(compactFallback.task.issues));assert.equal(fallbackTurns,6);
assert.throws(()=>parseAgentResponse(JSON.stringify({reasoning:'untrusted',actions:[]})),/Champ inattendu.*reasoning.*Champs autorisés/);
const still='<html><head><style>.btn{opacity:0}.btn.on{opacity:1;transition:opacity .4s}</style></head><body><button class="btn">Start</button></body></html>';
const moving=still.replace('</body>',"<script>document.querySelector('.btn').classList.add('on')</script></body>");
assert.match(classifyRepair(checks('temporal','Aucun changement visuel mesuré','index.html'),[change('index.html',still)])?.brief??'',/aucun script ou handler/);
const brokenKeyframes="<style>@keyframes reveal {to{opacity:1}}</style><button>Go</button><script>var key='reveal-'+n; var css='animation:' + key + ' 400ms';</script>";
assert.match(classifyRepair(checks('temporal','Aucun changement visuel mesuré','index.html'),[change('index.html',brokenKeyframes)])?.brief??'',/nom d'animation commençant par reveal-/);
const reducedFailure={...checks('temporal','Mouvement réduit émulé : mouvement encore observé','index.html')[0],validatorId:'bench:reduced-motion'};
const reducedTarget=classifyRepair([reducedFailure],[change('index.html',moving)]);
assert.equal(reducedTarget?.kind,'motion');
assert.match(reducedTarget?.brief??'',/prefers-reduced-motion/);
assert.match(reducedTarget?.brief??'',/Préserve l'animation normale/);
assert.doesNotMatch(reducedTarget?.brief??'',/déclencheur et le changement d'état/);
let motionCalls=0;
const motion=await new CortexRuntime().run({...base,conversationId:'phase-1-4-motion',prompt:'Crée une interface animée dans index.html avec un bouton visible après transition.',project:makeProject({'index.html':'<html></html>'})},{persistence,
  generate:async call=>{
    motionCalls++;
    if(motionCalls===2){assert.match(call.context.next,/aucun script ou handler/);assert.match(JSON.stringify(call.context),/SOURCE COURANTE MOUVEMENT/);assert(!call.schema.properties.actions.items.oneOf.some(item=>['runCheck','inspectUI','inspectMotion','readContext'].includes(item.properties.type.enum[0])));}
    return {text:JSON.stringify({actions:[{type:'replaceFile',path:'index.html',content:motionCalls===1?still:moving}]}),stopReason:'stop'};
  },verify:async changes=>[{type:'visual',status:'passed',success:true,output:'Rendu disponible.'},{type:'temporal',status:changes[0].after===moving?'passed':'failed',success:changes[0].after===moving,output:changes[0].after===moving?'Mouvement mesuré.':'Aucun changement visuel mesuré.'}],
});
assert.equal(motion.task.phase,'completed',JSON.stringify(motion.task.issues));assert.equal(motionCalls,2);
console.log('cortex-phase-1-4: CJS/ESM contracts, cycle, runtime export repair, syntax line and atomic HTML repair — ok');
