import { mkdir, readFile, readdir, writeFile, cp, stat, realpath, symlink } from 'node:fs/promises';
import { homedir, hostname, platform, arch } from 'node:os';
import { join, relative, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { fixtures, REGISTRY_VERSION, selectFixtures } from './registry.mjs';
import { validateFixture } from './validators.mjs';
import { latestRun, makeReport, writeJson } from './report.mjs';
import { SOLAR_ROOT, render } from './webkit.mjs';
import { createProgressStore } from './progress-store.mjs';
import { cacheKey, FastFailureDetector, gitChangedFiles, loadPassedCache, selectSmartFixtures, sourceDigest } from './smart.mjs';
import {validateAdvancedFixture} from './advanced-validator.mjs';

const exec = promisify(execFile);
export const RUNNER_VERSION = '2.0.0-advanced';
export const OLLAMA = 'http://127.0.0.1:11434';
export const defaultResultsRoot = join(homedir(), 'Library', 'Application Support', 'Solar', 'benchmarks');
const now = () => new Date().toISOString();
const sha = input => createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16);

async function hashTree(root) {
  const files=[];
  async function walk(dir) {
    for (const entry of await readdir(dir,{withFileTypes:true})) {
      const path=join(dir,entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push([relative(root,path).split(sep).join('/'),createHash('sha256').update(await readFile(path)).digest('hex')]);
    }
  }
  await walk(root); files.sort((a,b)=>a[0].localeCompare(b[0]));
  return { files, sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex') };
}

export async function createCortexSnapshot(root, destination, dependencyRoot = root) {
  const sourceRoot=join(root,'src');
  const snapshotRoot=destination ?? join(await import('node:fs/promises').then(fs=>fs.mkdtemp(join('/tmp/','solar-bench-cortex-'))),'snapshot');
  await mkdir(snapshotRoot,{recursive:true});
  await cp(sourceRoot,join(snapshotRoot,'src'),{recursive:true});
  for (const file of ['package.json','tsconfig.json']) {
    try { await cp(join(root,file),join(snapshotRoot,file)); }
    catch { if (dependencyRoot !== root) try { await cp(join(dependencyRoot,file),join(snapshotRoot,file)); } catch {} }
  }
  try { await symlink(join(dependencyRoot,'node_modules'),join(snapshotRoot,'node_modules'),'dir'); } catch {}
  const tree=await hashTree(join(snapshotRoot,'src'));
  const source=await git(root);
  let dirty=''; try { dirty=(await exec('/usr/bin/git',['status','--porcelain','--untracked-files=all'],{cwd:root})).stdout.trim(); } catch {}
  return { root:snapshotRoot, sourceRoot:join(snapshotRoot,'src'), sha256:tree.sha256, files:tree.files.length, components:tree.files.filter(([name])=>/cortex|agent|services\//.test(name)).reduce((out,[name,hash])=>(out[name]=hash,out),{}), branch:source.branch, commit:source.commit, dirty:Boolean(dirty), dirtyFiles:dirty?dirty.split('\n'):[] };
}

export async function loadSnapshotModules(snapshot) {
  const root=snapshot.sourceRoot; const snapshotReal=await realpath(snapshot.root);
  const imports={
    runtime:join(root,'lib/cortex/runtime.ts'), types:join(root,'lib/cortex/types.ts'),
    backend:join(root,'services/cortexBackend.ts'), actions:join(root,'lib/agent/actions.ts')
  };
  for (const [name,path] of Object.entries(imports)) {
    const resolved=await import.meta.resolve(pathToFileURL(path).href);
    if (!fileURLToPath(resolved).startsWith(`${snapshotReal}/`)) throw Error(`SOLAR_BENCH_SNAPSHOT: ${name} résolu hors snapshot : ${resolved}`);
  }
  const [runtime,types,backend,actions]=await Promise.all(Object.values(imports).map(path=>import(pathToFileURL(path).href)));
  return { CortexRuntime:runtime.CortexRuntime, CORTEX_MODEL:types.CORTEX_MODEL, CORTEX_VERSION:types.CORTEX_VERSION, createCortexBackend:backend.createCortexBackend, ...actions };
}

export async function git(root) {
  const read = async args => (await exec('/usr/bin/git', args, { cwd: root, timeout: 4000 })).stdout.trim();
  try { return { commit: await read(['rev-parse','HEAD']), branch: await read(['branch','--show-current']) }; } catch { return { commit: 'inconnu', branch: 'inconnu' }; }
}
export async function cortexContract(root, version) {
  const identity = await git(root);
  return { version, contractVersion:1, runtime: 'CortexRuntime', capabilities: ['run','cancel','checkpoints','telemetry','visual-render','atomic-actions','shared-evidence','cegis'], ...identity };
}
export async function ollama(model) {
  let response;
  try { response = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(1500) }); } catch (error) { throw Error(`Ollama indisponible sur ${OLLAMA} : ${error.message}`); }
  if (!response.ok) throw Error(`Ollama a répondu HTTP ${response.status}.`);
  const tags = await response.json();
  const installed = tags.models?.find(item => item.name === model || item.model === model);
  if (!installed) throw Error(`Modèle requis absent : ${model}. Installe-le explicitement avec : ollama pull ${model}`);
  const version = await fetch(`${OLLAMA}/api/version`, { signal: AbortSignal.timeout(1500) }).then(r => r.ok ? r.json() : undefined).catch(() => undefined);
  const details = await fetch(`${OLLAMA}/api/show`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model}), signal:AbortSignal.timeout(3000) }).then(r => r.ok ? r.json() : undefined).catch(() => undefined);
  return { model, identity: installed.digest ?? installed.modified_at ?? model, installed, version: version?.version, details, capabilities: details?.capabilities ?? [] };
}
function projectFor(fixture) { return { id:fixture.id, name:fixture.id, files:Object.keys(fixture.files), readFile:async path => fixture.files[path] ?? '' }; }
function classify(error, signal) {
  if (signal?.aborted) return 'cancelled'; const text = error?.message ?? String(error);
  if (/timeout|délai|timed out/i.test(text)) return 'timeout'; if (/stagnation|boucle/i.test(text)) return 'stagnation';
  if (/Ollama|ENOENT|swift|vite|infrastructure|EACCES/i.test(text)) return 'infrastructure-error'; return 'failed';
}
async function nativeRun(fixture, backend, signal, referenceImage, modules) {
  const project = projectFor(fixture); const response = await backend({ system:'Produis seulement des actions JSON selon le schéma fourni. Tu peux lire et modifier uniquement les fichiers fournis. N’exécute aucun shell.', prompt:`${fixture.prompt}\n\nFichiers initiaux :\n${JSON.stringify(fixture.files)}`, schema:modules.cortexActionSchema, maxOutputTokens:1800,images:referenceImage?[referenceImage]:undefined }, signal);
  const parsed = modules.parseAgentResponse(response.toolCalls?.length ? JSON.stringify(response.toolCalls[0].arguments) : response.text);
  const staged = new Map(); for (const action of parsed.actions) {
    // A native baseline has the same proposed-change format but does not
    // execute model-requested checks or renders; independent validators do it.
    if (['runCheck','renderPreview','inspectRender','inspectUI','inspectMotion','finish'].includes(action.type)) continue;
    const issue = modules.validateAction(action, project, staged, true); if (issue) throw Error(issue); await modules.stageAction(action, project, staged, signal);
  }
  return { changes:[...staged.values()], task:{ phase:'completed', repairs:0, telemetry:{ outputTokens:response.metrics?.tokens ?? response.tokens, promptTokens:response.metrics?.promptTokens, inferenceMs:response.metrics?.totalMs, checkpoints:0 }, issues:[] }, generations:1 };
}
async function cortexRun(fixture, backend, signal, supportsVision, model, root, features, checkpoint,referenceImage,detector,onFastFailure, modules) {
  const memory = new Map(); let generations = 0;
  const runtime = new modules.CortexRuntime();
  const output = await runtime.run({ conversationId:`bench-${fixture.id}`, prompt:fixture.prompt, modelId:model, project:projectFor(fixture), mode:'ultra', allowChanges:true, signal, features, referenceImage, generationTimeoutMs:120_000 }, {
    persistence:{save:async task=>{memory.set(task.id, structuredClone(task));await checkpoint?.(task);const failure=detector?.observe(task);if(failure)onFastFailure?.(failure);},load:async id=>memory.get(id)},
    generate:async (call, childSignal) => { generations++; return backend(call,childSignal); },
    verify:async (changes, childSignal) => fixture.preset==='advanced'?(await validateAdvancedFixture(fixture,changes,{signal:childSignal,root,referenceImage})).checks:validateFixture(fixture, changes, { signal:childSignal, root, render,referenceImage }), render, supportsVision,
  });
  return { changes:output.changes, task:output.task, generations };
}
function finalize(run) {
  run.finishedAt = now(); run.summary = { total:run.results.length, passed:run.results.filter(r=>r.status==='passed'||r.status==='CACHED').length, cached:run.results.filter(r=>r.status==='CACHED').length, executed:run.results.filter(r=>r.status!=='CACHED').length, durationMs:Date.parse(run.finishedAt)-Date.parse(run.startedAt),tokens:sumMeasured(run.results,'tokens'),generations:sumMeasured(run.results,'generations'),repairs:sumMeasured(run.results,'repairs') };
  run.diagnostics = run.results.filter(r=>r.status!=='passed'&&r.status!=='CACHED').map(r=>`${r.fixtureId}/${r.variant} : ${r.reason ?? r.status}`).slice(0,12);
  run.recommendations = run.diagnostics.some(d=>/webkit|render/i.test(d)) ? ['Vérifier la disponibilité du rendu WebKit local avant de comparer la fidélité visuelle.'] : run.diagnostics.length ? ['Traiter les premiers diagnostics ci-dessus avant d’élargir la campagne.'] : ['Aucune recommandation déterministe : examiner les rapports détaillés avant toute conclusion de qualité.'];
  return run;
}
export async function run(options, { root=SOLAR_ROOT, resultsRoot=defaultResultsRoot, resume, onProgress } = {}) {
  if(options.smart&&!options.selectedIds){const choice=selectSmartFixtures(await gitChangedFiles(root));options={...options,selectedIds:choice.fixtures.map(f=>f.id),selectionMode:choice.mode,selectionReason:choice.reason};}
  const selected = selectFixtures(options); const variants = options.variant === 'both' ? ['native','cortex'] : [options.variant ?? 'cortex'];
  if(variants.some(item=>!['native','cortex'].includes(item)))throw Error('Variante inconnue.');
  const runtimeRoot=options.runtimeRoot?await realpath(options.runtimeRoot):root;
  const snapshot = await createCortexSnapshot(runtimeRoot);
  const modules = await loadSnapshotModules(snapshot);
  const model = options.model ?? modules.CORTEX_MODEL; const connection = await ollama(model); const cortex = {...await cortexContract(runtimeRoot,modules.CORTEX_VERSION), snapshot}; const source=await sourceDigest(runtimeRoot);
  const configuration = { runner:RUNNER_VERSION, registry:REGISTRY_VERSION, source, snapshot, fixtures:selected.map(f=>({id:f.id,version:f.version,validator:f.validatorVersion,digest:sha(f)})), inference:{contextWindow:8192,maxOutputTokens:2200}, model, modelIdentity:connection.identity, modelContext:connection.installed?.details?.parameters ?? connection.details, cortexCommit:cortex.commit, options:{...options,timeoutMs:options.timeoutMs ?? 600_000} };
  const comparisonKey=sha({registry:REGISTRY_VERSION,fixtures:configuration.fixtures,inference:configuration.inference,model,modelIdentity:connection.identity,modelParameters:connection.details?.parameters,ollamaVersion:connection.version,machine:`${platform()} ${arch()} · ${hostname()}`,timeoutMs:configuration.options.timeoutMs,features:configuration.options.features??{},variant:configuration.options.variant,preset:configuration.options.preset});
  if(resume&&resume.cacheKey!==sha(configuration))throw Error('Campagne incompatible avec le commit, les fixtures, le modèle ou la configuration actuels. Lance une nouvelle campagne.');
  const run = resume ?? { id:`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`, startedAt:now(), model, ollama:connection, cortex, snapshot, machine:`${platform()} ${arch()} · ${hostname()}`, options:configuration.options, cacheKey:sha(configuration),comparisonKey, results:[], diagnostics:[], recommendations:[] };
  const dir = join(resultsRoot, run.id); const statePath = join(dir, 'BENCHMARK_RESULTS.json'); await mkdir(dir,{recursive:true});
  const reuse=options.preset!=='full'&&options.cache!==false&&Boolean(connection.installed.digest&&connection.version);
  const resultKeys=new Map(selected.flatMap(fixture=>variants.map(variant=>[`${fixture.id}/${variant}`,cacheKey({fixture,variant,source,modelIdentity:connection.identity,ollamaVersion:connection.version,model,options,runnerVersion:RUNNER_VERSION,registryVersion:REGISTRY_VERSION})])));
  const cached=reuse?await loadPassedCache(resultsRoot,new Set(resultKeys.values())):new Map();
  const livePath = join(resultsRoot, 'live-progress.json');
  const publish=createProgressStore([livePath,join(dir,'progress.json')],{runId:run.id,pid:process.pid},onProgress);
  const done = new Set(run.results.map(result=>`${result.fixtureId}/${result.variant}`));
  const keys = selected.flatMap(fixture => variants.map(variant => `${fixture.id}/${variant}`));
  const total = keys.length; let completed = keys.filter(key => done.has(key)).length;
  const counters = () => ({ passed:run.results.filter(result=>keys.includes(`${result.fixtureId}/${result.variant}`) && ['passed','CACHED'].includes(result.status)).length, failed:run.results.filter(result=>keys.includes(`${result.fixtureId}/${result.variant}`) && !['passed','CACHED'].includes(result.status)).length, cached:run.results.filter(result=>keys.includes(`${result.fixtureId}/${result.variant}`) && result.status==='CACHED').length, executed:run.results.filter(result=>keys.includes(`${result.fixtureId}/${result.variant}`) && result.status!=='CACHED').length });
  publish({ type:'init', model, fixtureCount:selected.length, total, completed, mode:options.selectionMode??options.preset, reason:options.selectionReason, ...counters() });
  let userInterrupted=false;
  benchmark: for (const fixture of selected) for (const variant of variants) {
    const key = `${fixture.id}/${variant}`; if (done.has(key)) continue;
    const cacheEntry=cached.get(resultKeys.get(key));
    if(cacheEntry){const result={...cacheEntry.result,status:'CACHED',durationMs:0,originalDurationMs:cacheEntry.result.durationMs,cachedFrom:cacheEntry.runId};run.results.push(result);completed++;finalize(run);publish({type:'complete',result,total,completed,...counters()});await writeJson(statePath,run);await writeJson(join(resultsRoot,'latest.json'),{id:run.id,path:statePath,cacheKey:run.cacheKey,summary:run.summary});continue;}
    let timedOut=false;const started = Date.now(); const controller = new AbortController(); const timer = setTimeout(()=>{timedOut=true;controller.abort();}, options.timeoutMs ?? 600_000);
    const detector=new FastFailureDetector();let fastFailure;
    const interrupt=()=>{userInterrupted=true;controller.abort();};process.once('SIGINT',interrupt);
    publish({ type:'start', index:completed + 1, total, fixtureId:fixture.id, variant, ...counters() });
    let peakRunnerRssBytes=process.memoryUsage().rss;
    const ticker = setInterval(() => {peakRunnerRssBytes=Math.max(peakRunnerRssBytes,process.memoryUsage().rss);publish({ type:'tick', fixtureId:fixture.id, variant, elapsedMs:Date.now()-started });}, 1000);
    let result;
    try {
      if (snapshot.sha256 !== run.snapshot.sha256) throw Error('SOLAR_BENCH_SNAPSHOT: empreinte différente de celle du début de campagne.');
      const backend = modules.createCortexBackend({ provider:{id:'solar-bench',name:'Ollama local',protocol:'ollama',baseUrl:OLLAMA,enabled:true,secretRef:'local',connectionState:'connected'}, vault:{get:async()=>null,set:async()=>{},delete:async()=>{}},conversationId:`bench-${run.id}`,modelId:model,contextWindow:8192,tools:connection.capabilities.includes('tools'),vision:connection.capabilities.includes('vision'),onVisible:()=>{} });
      const reference=fixture.referenceAsset?await loadAdvancedReference(fixture.referenceAsset):fixture.referenceHtml?(await render(fixture.referenceHtml,[0],controller.signal)).frames[0]?.image:undefined;
      const execution = variant === 'cortex' ? await cortexRun(fixture, backend, controller.signal, connection.capabilities.includes('vision'), model, root, options.features,task=>writeJson(join(dir,`${fixture.id}-${variant}-checkpoint.json`),task),reference,detector,failure=>{fastFailure=failure;controller.abort();},modules) : await nativeRun(fixture, backend, controller.signal,connection.capabilities.includes('vision')?reference:undefined,modules);
      if(fastFailure)throw Error(fastFailure.message);
      const evidenceDir=join(dir,'evidence',`${fixture.id}-${variant}`);
      const validation = fixture.preset==='advanced'?await validateAdvancedFixture(fixture,execution.changes,{signal:controller.signal,root,referenceImage:reference,evidenceDir}):{checks:await validateFixture(fixture, execution.changes, { signal:controller.signal, root, render,referenceImage:reference })};
      const checks=validation.checks;
      clearTimeout(timer);
      const passed = execution.changes.length > 0 && checks.length > 0 && checks.every(check=>check.status==='passed') && (variant !== 'cortex' || execution.task.phase === 'completed');
      const telemetry = execution.task.telemetry ?? {};
      const loadedModelBytes=await fetch(`${OLLAMA}/api/ps`,{signal:AbortSignal.timeout(1500)}).then(r=>r.ok?r.json():undefined).then(value=>value?.models?.find(m=>m.name===model||m.model===model)?.size_vram).catch(()=>undefined);
      const reason=passed?undefined:(execution.task.issues ?? []).join('; ') || checks.filter(c=>c.status!=='passed').map(c=>c.output).join('; ');
      const status=timedOut?'timeout':userInterrupted?'cancelled':passed?'passed':checks.some(c=>c.status==='unavailable')?'infrastructure-error':/absence de progrès|stagnation|sans progrès/i.test(reason??'')?'stagnation':'failed';
      for(const check of checks)delete check.renderReport;
      result = { fixtureId:fixture.id, domain:fixture.domain, variant, status, durationMs:Date.now()-started, generations:execution.generations ?? execution.task.generations, repairs:execution.task.repairs, checkpoints:telemetry.checkpoints,attempts:execution.task.attempts,evidence:execution.task.evidence,evidenceDir:fixture.preset==='advanced'?evidenceDir:undefined,tokens:variant==='native'||telemetry.outputTokenSamples?telemetry.outputTokens:undefined, promptTokens:variant==='native'||telemetry.promptTokenSamples?telemetry.promptTokens:undefined,tokenSamples:telemetry.outputTokenSamples,peakRunnerRssBytes,loadedModelBytes, firstArtifactMs:telemetry.firstArtifactMs, firstVerificationMs:telemetry.firstVerificationMs, phaseMs:telemetry.phaseMs, checks, changedFiles:execution.changes.map(change=>change.path), quality:validation.score?.quality,scoring:validation.score, reason };
    } catch (error) { result = { fixtureId:fixture.id, domain:fixture.domain, variant, status:timedOut?'timeout':fastFailure?.status??classify(error,controller.signal), durationMs:Date.now()-started, checks:[], reason:fastFailure?.message??error?.message ?? String(error) }; }
    finally { clearTimeout(timer); clearInterval(ticker);process.removeListener('SIGINT',interrupt); result.resultCacheKey=resultKeys.get(key); run.results.push(result); completed++; finalize(run); publish({ type:'complete', result, total, completed, ...counters() }); await writeJson(statePath,run); await writeJson(join(resultsRoot,'latest.json'),{id:run.id,path:statePath,cacheKey:run.cacheKey,summary:run.summary}); }
    if(userInterrupted)break benchmark;
  }
  finalize(run); const previous = await previousComparable(resultsRoot,run); const report = makeReport(run, previous); const reportPath=join(dir,'BENCHMARK_REPORT.md'); await writeFile(reportPath,report); await writeJson(statePath,run); await writeJson(join(resultsRoot,'latest.json'),{id:run.id,path:statePath,cacheKey:run.cacheKey,summary:run.summary}); publish({type:'summary',total,reportPath,durationMs:run.summary.durationMs,...counters()}); await publish.flush(); return {run,dir,reportPath,resultsPath:statePath};
}
async function previousComparable(root, run) { try { const entries = (await readdir(root,{withFileTypes:true})).filter(e=>e.isDirectory()&&e.name!==run.id).map(e=>e.name).sort().reverse(); for(const id of entries){const value=JSON.parse(await readFile(join(root,id,'BENCHMARK_RESULTS.json'),'utf8'));const advanced=run.options?.preset==='advanced';if(advanced&&run.comparisonKey&&value.comparisonKey===run.comparisonKey&&value.snapshot?.sha256!==run.snapshot?.sha256)return value;if(!advanced&&value.cacheKey===run.cacheKey)return value;} } catch {} return undefined; }
export async function loadComparable(run,root=defaultResultsRoot){return previousComparable(root,run);}
export async function loadLatest(root=defaultResultsRoot) { const pointer=await latestRun(root); if(!pointer)throw Error('Aucune campagne Solar Bench disponible.'); return {pointer,run:JSON.parse(await readFile(pointer.path,'utf8'))}; }
const sumMeasured=(results,key)=>{const values=results.map(item=>item[key]).filter(Number.isFinite);return values.length?values.reduce((a,b)=>a+b,0):undefined;};
async function loadAdvancedReference(name){const path=fileURLToPath(new URL(`./assets/advanced/${name}`,import.meta.url));const bytes=await readFile(path);const mime=name.endsWith('.png')?'image/png':'image/jpeg';return `data:${mime};base64,${bytes.toString('base64')}`;}
