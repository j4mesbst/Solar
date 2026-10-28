// Fixed fixtures; real local inference only. Never download weights or substitute a model.
import { readFile,writeFile,mkdtemp,mkdir,rm,symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CortexRuntime } from '../src/lib/cortex/runtime.ts';
import { CORTEX_MODEL } from '../src/lib/cortex/types.ts';
import { createCortexBackend } from '../src/services/cortexBackend.ts';
import { cortexActionSchema as agentActionSchema,parseAgentResponse,validateAction,stageAction } from '../src/lib/agent/actions.ts';
import { verifyCode,assessRender,temporalSampleTimes } from '../src/lib/cortex/verification.ts';
import { prepareContext } from '../src/lib/cortex/context.ts';
import { analyzeIntent } from '../src/lib/agent/intent.ts';
const exec=promisify(execFile);
const base='http://127.0.0.1:11434';
const tasks=[
  {id:'swift-debug',prompt:'Corrige la compilation dans Value.swift sans changer le résultat attendu : double(3) doit valoir 6.',files:{'Value.swift':'func double(_ x: Int) -> Int { return x * "2" }\n'},kind:'swift'},
  {id:'feature',prompt:'Ajoute clamp(value,min,max) dans src/value.cjs. Retourne la borne si la valeur est hors intervalle.',files:{'src/value.cjs':'module.exports={};\n'},test:"const a=require('node:assert/strict'),{clamp}=require('./src/value.cjs');a.equal(clamp(-1,0,5),0);a.equal(clamp(8,0,5),5);a.equal(clamp(3,0,5),3);"},
  {id:'refactor',prompt:'Refactorise sumPositive dans src/value.cjs avec filter/reduce en conservant son comportement, y compris pour un tableau vide.',files:{'src/value.cjs':'exports.sumPositive = xs => {let total=0;for(const x of xs){if(x>0)total+=x;}return total;};'},test:"const a=require('node:assert/strict'),{sumPositive}=require('./src/value.cjs');a.equal(sumPositive([]),0);a.equal(sumPositive([-2,1,3]),4);"},
  {id:'ui-description',prompt:'Crée une interface HTML autonome dans index.html avec un menu latéral, une chatbox et trois boutons. Style minimaliste clair, responsive, aucun réseau externe.',files:{'index.html':'<!doctype html><html><body></body></html>'},kind:'visual'},
  {id:'ui-reference',prompt:'Reproduis dans index.html la référence visuelle fournie : fond clair, barre latérale grise de 240px et chatbox arrondie en bas. HTML autonome.',files:{'index.html':'<!doctype html><html><body></body></html>'},kind:'visual',reference:true},
  {id:'motion-simple',prompt:'Ajoute une animation CSS d’apparition du bouton dans index.html : opacity 0 à 1 et translateY 16px à 0 en 400ms. Garde un fallback prefers-reduced-motion.',files:{'index.html':'<!doctype html><html><body><button data-cortex>Questionnaire</button></body></html>'},kind:'temporal'},
  {id:'motion-complex',prompt:'Crée dans index.html une animation d’apparition de trois options de questionnaire, cascade de 40ms, opacity et translateY, fin en moins de 700ms. HTML autonome, fallback prefers-reduced-motion.',files:{'index.html':'<!doctype html><html><body><main></main></body></html>'},kind:'temporal'},
  {id:'motion-reference',prompt:'Anime le bouton Questionnaire dans index.html : reproduis la référence finale fournie; entrée depuis Y+24px et opacity 0, durée 650ms, easing cubic-bezier(.22,1,.36,1). Mouvement réduit immédiat.',files:{'index.html':'<!doctype html><html><body><button data-cortex>Questionnaire</button></body></html>'},kind:'temporal',reference:true},
  {id:'react-premium',prompt:'Crée une interface React de chatbot moderne et compilable dans src/App.jsx : sidebar, conversation, messages, champ de saisie, responsive, style minimaliste professionnel et animation CSS d’apparition des messages. Préserve le point d’entrée existant.',files:{'package.json':'{"private":true,"type":"module","scripts":{"build":"vite build"},"dependencies":{"@vitejs/plugin-react":"latest","vite":"latest","react":"latest","react-dom":"latest"},"devDependencies":{}}','index.html':'<div id="root"></div><script type="module" src="/src/main.jsx"></script>','src/main.jsx':'import React from "react";import{createRoot}from"react-dom/client";import App from"./App.jsx";createRoot(document.getElementById("root")).render(<App/>);','src/App.jsx':'export default function App(){return <main>Chat</main>}'},kind:'react'},
];
const selectedTasks = process.env.SOLAR_BENCHMARK_TASKS ? new Set(process.env.SOLAR_BENCHMARK_TASKS.split(',').map(value=>value.trim()).filter(Boolean)) : undefined;
const selectedVariants = process.env.SOLAR_BENCHMARK_VARIANTS ? new Set(process.env.SOLAR_BENCHMARK_VARIANTS.split(',').map(value=>value.trim()).filter(Boolean)) : undefined;
const result={model:CORTEX_MODEL,benchmark:'solar-cortex-v3-comparative',at:new Date().toISOString(),measurements:[],limitations:['Le score pixel ne mesure pas la qualité esthétique.','Les animations JavaScript arbitraires ne sont pas virtualisées.','La mémoire rapportée est le RSS du runner llama-server et la taille chargée signalée par Ollama ; ce n’est pas la mémoire totale de macOS.','Cette exécution compare Ornith brut à Cortex V3. La comparaison V2 exige le binaire V2 figé et n’est jamais inférée à partir de mesures V3.']};
let capabilities=[];
try{
  const response=await fetch(base+'/api/show',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:CORTEX_MODEL}),signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw Error(`Ornith 1.5 9B non installé ou indisponible (HTTP ${response.status}).`);
  capabilities=(await response.json()).capabilities??[];
}catch(error){result.status='not-run';const detail=error instanceof Error?error.message:String(error);result.reason=`Ollama indisponible sur ${base} : ${detail}`;}

async function render(html,times,signal,reference){
  const dir=await mkdtemp(join(tmpdir(),'solar-cortex-bench-render-'));
  try{const input=join(dir,'input.json');await writeFile(input,JSON.stringify({html,times,reference}));await exec('/usr/bin/swift',[new URL('../src-tauri/src/cortex-render.swift',import.meta.url).pathname,input],{timeout:60000,signal});return JSON.parse(await readFile(join(dir,'report.json'),'utf8'));}finally{await rm(dir,{recursive:true,force:true});}
}
async function verifyChanges(changes,fixture,signal){
  const dir=await mkdtemp(join(tmpdir(),'solar-cortex-bench-code-'));
  try{
    const files={...fixture.files,...Object.fromEntries(changes.map(c=>[c.path,c.after]))};
    for(const[path,content]of Object.entries(files)){const target=join(dir,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,content);}
    if(fixture.kind==='swift'){await exec('/usr/bin/xcrun',['swiftc','-typecheck',join(dir,'Value.swift')],{timeout:60000,signal});return[{type:'build',status:'passed',success:true,output:'swiftc -typecheck'}];}
    if(fixture.kind==='react'){
      await symlink(join(process.cwd(),'node_modules'),join(dir,'node_modules'),'dir');
      await exec(join(process.cwd(),'node_modules/.bin/vite'),['build'],{cwd:dir,timeout:120000,signal});
      return[{type:'build',status:'passed',success:true,output:'Vite React build réussi dans le projet temporaire'}];
    }
    if(fixture.test){await writeFile(join(dir,'check.cjs'),fixture.test);await exec(process.execPath,[join(dir,'check.cjs')],{cwd:dir,timeout:10000,signal});return[{type:'tests',status:'passed',success:true,output:'Assertions Node exécutées'}];}
    return[{type:'structure',status:'passed',success:true,output:'HTML autonome, sans compilation'}];
  }catch(error){signal.throwIfAborted();return[{type:fixture.kind==='swift'?'build':'tests',status:'failed',success:false,output:String(error.stderr??error.message).slice(0,2500)}];}finally{await rm(dir,{recursive:true,force:true});}
}
async function ollamaMemory(){
  const [{stdout},{models=[]}]=await Promise.all([
    exec('/bin/ps',['-axo','rss=,command='],{timeout:3000}).catch(()=>({stdout:''})),
    fetch(base+'/api/ps',{signal:AbortSignal.timeout(3000)}).then(response=>response.ok?response.json():{models:[]}).catch(()=>({models:[]})),
  ]);
  const runnerRssBytes=stdout.split('\n').reduce((total,line)=>{
    const match=line.trim().match(/^(\d+)\s+(.+)$/);return match&&/llama-server|ollama runner/i.test(match[2])?total+Number(match[1])*1024:total;
  },0);
  return {runnerRssBytes,loadedBytes:models.reduce((total,model)=>total+Number(model.size_vram??model.size??0),0),contextLength:models[0]?.context_length};
}
if(!result.reason){
  result.status='completed';
  const repetitions = Number(process.env.SOLAR_BENCHMARK_REPETITIONS ?? 0);
  const selectedFixtures = tasks.filter(task=>!selectedTasks||selectedTasks.has(task.id));
  const rounds = [...selectedFixtures.map(task=>({task, round:0}))];
  for (const id of ['feature','ui-description']) {
    const task = selectedFixtures.find(value=>value.id===id);
    if (task) for (let round=1; round<=Math.min(1, repetitions); round++) rounds.push({task, round});
  }
  for(const {task:fixture, round} of rounds){
    const project={id:fixture.id,name:fixture.id,files:Object.keys(fixture.files),readFile:async path=>fixture.files[path]??''};
    const reference=fixture.reference?(await render('<html><body style="margin:0;background:#fafafa;font-family:system-ui"><aside style="position:absolute;inset:0 auto 0 0;width:240px;background:#eee"></aside><button style="position:absolute;bottom:40px;left:300px;border-radius:24px;padding:18px 32px">Questionnaire</button></body></html>',[0],new AbortController().signal)).frames[0].image:undefined;
    for(const variant of ['raw','cortex'].filter(variant=>!selectedVariants||selectedVariants.has(variant))){
      // A benchmark must report a timeout, not silently consume an unlimited
      // amount of local compute. These fixtures are deliberately small.
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),Number(process.env.SOLAR_BENCHMARK_TIMEOUT_MS ?? 360_000));const started=Date.now();
      const backend=createCortexBackend({provider:{id:'bench',name:'Ollama',protocol:'ollama',baseUrl:base,enabled:true,secretRef:'none',connectionState:'connected'},vault:{get:async()=>null,set:async()=>{},delete:async()=>{}},conversationId:fixture.id,modelId:CORTEX_MODEL,contextWindow:8192,tools:capabilities.includes('tools'),vision:capabilities.includes('vision'),onVisible:()=>{}});
      let generations=0;const metrics=[];let peakRunnerRssBytes=0,peakLoadedBytes=0,contextLength;
      const sample=async()=>{const memory=await ollamaMemory();peakRunnerRssBytes=Math.max(peakRunnerRssBytes,memory.runnerRssBytes);peakLoadedBytes=Math.max(peakLoadedBytes,memory.loadedBytes);contextLength=memory.contextLength??contextLength;};
      await sample();const memoryTimer=setInterval(()=>void sample(),500);
      const generate=async(call,signal)=>{generations++;const response=await backend({...call,maxOutputTokens:Math.min(call.maxOutputTokens??2200,2200)},signal);if(response.metrics)metrics.push(response.metrics);return response;};
      try{
        let changes,checks,taskPhase,taskIssues,taskTelemetry,taskRepairs;
        if(variant==='raw'){
          const response=await generate({system:'Produis les actions JSON du schéma pour satisfaire la demande. Aucun shell. Les fichiers sont fournis ci-dessous.',prompt:fixture.prompt+'\n'+JSON.stringify(fixture.files),schema:agentActionSchema,maxOutputTokens:900,images:reference&&capabilities.includes('vision')?[reference]:undefined},controller.signal);
          const parsed=parseAgentResponse(response.toolCalls?.length?JSON.stringify(response.toolCalls[0].arguments):response.text);const staged=new Map();for(const action of parsed.actions){if(["runCheck","renderPreview","inspectRender"].includes(action.type))continue;const issue=validateAction(action,project,staged,true);if(issue)throw Error(issue);await stageAction(action,project,staged,controller.signal);}changes=[...staged.values()];
          const context=await prepareContext(analyzeIntent(fixture.prompt),project,8192,5,controller.signal);checks=await verifyCode(changes,context,project,analyzeIntent(fixture.prompt),[],controller.signal);checks.push(...await verifyChanges(changes,fixture,controller.signal));
          if(fixture.kind==='visual'||fixture.kind==='temporal'){const html=changes.find(c=>c.path==='index.html');if(html)checks.push(...assessRender(await render(html.after,fixture.kind==='temporal'?temporalSampleTimes(fixture.prompt):[0],controller.signal,reference),fixture.kind==='temporal',fixture.prompt));}
        }else{const memory=new Map();const output=await new CortexRuntime().run({conversationId:fixture.id,prompt:fixture.prompt,modelId:CORTEX_MODEL,project,mode:'ultra',allowChanges:true,signal:controller.signal,referenceImage:reference},{persistence:{save:async task=>memory.set(task.id,structuredClone(task)),load:async id=>memory.get(id)},generate,verify:(c,s)=>verifyChanges(c,fixture,s),render,supportsVision:capabilities.includes('vision')});changes=output.changes;checks=output.checks;taskPhase=output.task.phase;taskIssues=output.task.issues;taskTelemetry=output.task.telemetry;taskRepairs=output.task.repairs;}
        await sample();result.measurements.push({task:fixture.id,variant,round,passed:changes.length>0&&checks.length>0&&checks.every(c=>c.status==='passed')&&(variant!=="cortex"||taskPhase==="completed"),milliseconds:Date.now()-started,generations,metrics,peakRunnerRssBytes,peakLoadedBytes,contextLength,taskPhase,taskIssues,taskTelemetry,repairs:taskRepairs,changedFiles:changes.map(change=>change.path),checks:checks.map(c=>({type:c.type,status:c.status,output:c.output}))});
      }catch(error){await sample();result.measurements.push({task:fixture.id,variant,round,passed:false,milliseconds:Date.now()-started,generations,metrics,peakRunnerRssBytes,peakLoadedBytes,contextLength,error:error.message});}finally{clearTimeout(timeout);clearInterval(memoryTimer);console.log(`${fixture.id}/${variant}${round?`/repeat-${round}`:''} terminé (${Date.now()-started}ms)`);}
    }
  }
}
const outputPath=process.env.SOLAR_BENCHMARK_OUTPUT ?? new URL('../output/cortex/benchmark.json',import.meta.url).pathname;
await mkdir(dirname(outputPath),{recursive:true});await writeFile(outputPath,JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,reason:result.reason,measurements:result.measurements.length}));
