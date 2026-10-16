import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { relative, resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fixtures, domains } from './registry.mjs';

const exec = promisify(execFile);
const ids = {
  code:['swift-debug','feature','js-group-by','js-stable-sort','swift-safe-average'],
  refactoring:['refactor','refactor-multifile','refactor-cart','refactor-normalize','refactor-validation'],
  ui:['ui-description','react-premium','ui-tabs','ui-dialog','ui-chat-interaction'],
  visual:['ui-reference','visual-layout','visual-grid','visual-toolbar','visual-mobile-layout'],
  animations:['motion-simple','motion-complex','motion-reference','motion-interactive','motion-stagger'],
};
export const QUICK_IDS = ['swift-debug','feature','motion-simple'];
export const REGRESSION_IDS = ['swift-debug','feature','refactor','refactor-multifile','ui-description','ui-tabs','ui-reference','motion-simple'];
// Every path rule names the behavior its changes can affect. Unknown product code falls back to regression.
export const DEPENDENCY_MAP = [
  // Skill routing changes instructions for code, UI, visual and motion work.
  // Model catalog changes provider/model identity and therefore every domain.
  { paths:['src/services/skillEngine.ts','src/services/solarModels.ts'], domains },
  { paths:['src/lib/cortex/runtime.ts','src/lib/cortex/prompt.ts','src/lib/cortex/types.ts','src/services/cortexBackend.ts','src/services/ollama.ts'], domains },
  { paths:['src/lib/agent/','src/services/solarCodeStrategy.ts'], domains:['code','refactoring'] },
  { paths:['src/lib/cortex/visual-solver.ts','src/lib/cortex/visual-plan.ts','src/lib/cortex/verification.ts'], domains:['ui','visual','animations'] },
  { paths:['src/lib/cortex/semantic.ts','src/lib/cortex/structured.ts','src/lib/cortex/atomic.ts'], domains:['code','refactoring'] },
  { paths:['src/lib/cortex/evidence.ts','src/lib/cortex/learning.ts'], domains:['code','refactoring','ui','visual','animations'] },
  { paths:['src/components/','src/hooks/','src/solar-scene-integration.css'], domains:['ui','visual','animations'] },
  { paths:['scripts/solar-bench/validators.mjs','scripts/solar-bench/webkit.mjs'], domains:['ui','visual','animations','code','refactoring'] },
  { paths:['scripts/solar-bench/registry.mjs'], domains },
  { paths:['package.json','package-lock.json','src-tauri/'], domains },
];
const matches=(path, rule)=>rule.endsWith('/')?path.startsWith(rule):path===rule;
const irrelevantSystemFile=path=>/(?:^|\/)(?:\.DS_Store|Thumbs\.db)$/.test(path);
const selectedIds = names => fixtures.filter(f=>names.includes(f.id));
export function selectSmartFixtures(paths) {
  const changed = [...new Set(paths.map(path=>path.replaceAll('\\','/')).filter(path=>!irrelevantSystemFile(path)))];
  if(!changed.length) return {mode:'quick',reason:'aucun changement Git',fixtures:selectedIds(QUICK_IDS)};
  const affected = new Set(); const unknown=[];
  for(const path of changed){
    if(!/^(src\/|scripts\/solar-bench\/|src-tauri\/|package(?:-lock)?\.json$)/.test(path)) continue;
    const rules=DEPENDENCY_MAP.filter(rule=>rule.paths.some(item=>matches(path,item)));
    if(!rules.length)unknown.push(path);
    else for(const rule of rules)for(const domain of rule.domains)affected.add(domain);
  }
  if(unknown.length) return {mode:'regression',reason:`dépendance non cartographiée : ${unknown.join(', ')}`,fixtures:selectedIds(REGRESSION_IDS)};
  if(!affected.size)return {mode:'quick',reason:'changements sans effet cartographié sur Cortex',fixtures:selectedIds(QUICK_IDS)};
  if(affected.size===domains.length)return {mode:'regression',reason:'changement transversal',fixtures:selectedIds(REGRESSION_IDS)};
  const names=REGRESSION_IDS.filter(id=>affected.has(fixtures.find(f=>f.id===id).domain));
  return {mode:'targeted',reason:`domaines affectés : ${[...affected].join(', ')}`,fixtures:selectedIds(names)};
}
export async function gitChangedFiles(root) {
  const git = async args => (await exec('/usr/bin/git',args,{cwd:root,timeout:5000,maxBuffer:1024*1024})).stdout.split('\0').filter(Boolean);
  const current=await git(['status','--porcelain=v1','-z','--untracked-files=all']);
  const paths=[];
  for(let i=0;i<current.length;i++){
    const item=current[i]; paths.push(item.slice(3));
    if(item[0]==='R'||item[1]==='R'||item[0]==='C'||item[1]==='C')paths.push(current[++i]);
  }
  if(paths.length)return [...new Set(paths.filter(path=>!irrelevantSystemFile(path)))];
  try{return (await git(['diff','--name-only','-z','HEAD^','HEAD'])).filter(path=>!irrelevantSystemFile(path));}catch{return [];}
}
async function walk(root, path, output){
  let entries;try{entries=await readdir(join(root,path),{withFileTypes:true});}catch{return;}
  for(const entry of entries){const child=join(path,entry.name);if(irrelevantSystemFile(child))continue;if(entry.isDirectory())await walk(root,child,output);else if(entry.isFile())output.push(child);}
}
// Broad content hashing deliberately invalidates more often than necessary, including untracked source files.
export async function sourceDigest(root) {
  const paths=[];for(const dir of ['src','scripts/solar-bench','src-tauri/src'])await walk(root,dir,paths);
  paths.push('package.json','package-lock.json');paths.sort();const hash=createHash('sha256');
  for(const path of paths){try{hash.update(path);hash.update(await readFile(join(root,path)));}catch{hash.update(`${path}:missing`);}}
  return hash.digest('hex');
}
export function cacheKey({fixture,variant,source,modelIdentity,ollamaVersion,model,options,runnerVersion,registryVersion}) {
  const material={fixture,variant,source,modelIdentity,ollamaVersion,model,node:process.version,os:process.platform,arch:process.arch,runnerVersion,registryVersion,timeoutMs:options.timeoutMs,features:options.features??{},inference:{contextWindow:8192,maxOutputTokens:2200}};
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}
export async function loadPassedCache(resultsRoot, keys) {
  const found=new Map();let entries=[];try{entries=(await readdir(resultsRoot,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name).sort().reverse();}catch{return found;}
  for(const id of entries){if(found.size===keys.size)break;try{const state=JSON.parse(await readFile(join(resultsRoot,id,'BENCHMARK_RESULTS.json'),'utf8'));
    for(const result of state.results??[])if(result.status==='passed'&&result.resultCacheKey&&keys.has(result.resultCacheKey)&&!found.has(result.resultCacheKey))found.set(result.resultCacheKey,{result,runId:id});
  }catch{/* Corrupt or old reports are never cache entries. */}}
  return found;
}
export class FastFailureDetector {
  constructor({repeatLimit=3,emptyLimit=3}={}){this.repeatLimit=repeatLimit;this.emptyLimit=emptyLimit;this.last='';this.repeats=0;this.empty=0;this.lastGeneration=0;this.reason=undefined;}
  observe(task){
    if(this.reason)return this.reason;
    // Persistence may save the same state many times during one generation.
    // Count only completed model attempts, never wall-clock time or save frequency.
    if((task.generations??0)<=this.lastGeneration)return undefined;
    this.lastGeneration=task.generations;
    const candidates=task.candidates??[];const candidate=candidates[task.branch??0]??candidates.at(-1)??{};
    const changes=candidate.changes??[];const checks=candidate.checks??[];
    const signature=JSON.stringify({changes:changes.map(c=>[c.path,c.after]),checks:checks.map(c=>[c.type,c.status,c.output]),issues:candidate.issues??[],phase:task.phase});
    this.repeats=signature===this.last?this.repeats+1:1;this.last=signature;
    this.empty=changes.length||checks.length?0:this.empty+1;
    const issues=[...(candidate.issues??[]),...(task.issues??[])].join(' ');
    if(/(?:Ollama.*(?:HTTP 5\d\d|indisponible)|ENOENT|EACCES|WebKit.*indisponible|infrastructure)/i.test(issues)&&this.repeats>=2)this.reason={status:'infrastructure-error',message:'Erreur d’infrastructure répétée sans progrès.'};
    else if(this.empty>=this.emptyLimit&&this.repeats>=this.repeatLimit)this.reason={status:'stagnation',message:'Tentatives répétées sans modification effective.'};
    else if(this.repeats>=this.repeatLimit)this.reason={status:'stagnation',message:'État identique répété sans progrès observable.'};
    return this.reason;
  }
}
