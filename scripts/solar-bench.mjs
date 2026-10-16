#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { defaultResultsRoot, loadLatest, ollama, run } from './solar-bench/runner.mjs';
import { fixtures, planned } from './solar-bench/registry.mjs';
import { makeReport } from './solar-bench/report.mjs';
import { createTerminalProgress } from './solar-bench/progress.mjs';
import { QUICK_IDS, REGRESSION_IDS } from './solar-bench/smart.mjs';
const exec=promisify(execFile); const args=process.argv.slice(2); let command=args.shift() ?? 'help';
const value=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]}; const flag=name=>args.includes(name);
function ablations(){const known={'visual-solver':'visualSolver',cegis:'cegis',evolution:'evolution',semantic:'semantic','atomic-actions':'atomicActions',adaptive:'adaptive'};const result={};for(const name of (value('--disable','')??'').split(',').filter(Boolean)){if(!known[name])throw Error(`Ablation inconnue : ${name}`);result[known[name]]=false;}return result;}
const usage=()=>console.log(`Solar Bench\n\nsolar-bench run --smart [--variant native|cortex|both] [--model ornith-1.5:9b]\nsolar-bench run --preset quick|regression|smoke|medium|full\nsolar-bench run --domain code|refactoring|ui|visual|animations\nsolar-bench run --fixture swift-debug\nsolar-bench monitor [--run <run-id>]\nsolar-bench resume --latest | status | history | compare --latest | report --latest [--open|--reveal]\n\nSmart sélectionne selon Git; seuls les 25 exercices de full constituent une validation officielle.`);
try {
  if(command==='help'||command==='--help'){usage();process.exit(0);}
  if(command==='smoke'){await import('./solar-bench-smoke.mjs');process.exit(0);}
  if(command==='quick'||command==='regression'){const preset=command;args.unshift('--preset',preset);command='run';}
  if(command==='status'){const {pointer,run:state}=await loadLatest();console.log(JSON.stringify({id:pointer.id,summary:state.summary,finishedAt:state.finishedAt,results:state.results.map(r=>({fixture:r.fixtureId,variant:r.variant,status:r.status}))},null,2));process.exit(0);}
  if(command==='history'){const {readdir}=await import('node:fs/promises'); const list=(await readdir(defaultResultsRoot,{withFileTypes:true}).catch(()=>[])).filter(e=>e.isDirectory()).map(e=>e.name).sort().reverse();console.log(list.join('\n')||'Aucune campagne.');process.exit(0);}
  if(command==='report'){const {pointer}=await loadLatest();const report=join(dirname(pointer.path),'BENCHMARK_REPORT.md');if(!existsSync(report))throw Error('Rapport introuvable.');if(flag('--open'))await exec('/usr/bin/open',[report]);else if(flag('--reveal'))await exec('/usr/bin/open',['-R',report]);else console.log(report);process.exit(0);}
  if(command==='compare'){const {run:state}=await loadLatest();console.log(makeReport(state,undefined));process.exit(0);}
  if(command==='monitor'){await import('./solar-bench/monitor.mjs'); await new Promise(() => {});}
  if(command==='resume'){if(!flag('--latest'))throw Error('Utilise : solar-bench resume --latest');const {run:state}=await loadLatest();await run(state.options,{resume:state,onProgress:createTerminalProgress()});process.exit(0);}
  if(command==='doctor'){const connection=await ollama(value('--model','ornith-1.5:9b'));console.log(JSON.stringify({ollama:connection,fixtures:fixtures.length,planned:planned.length},null,2));process.exit(0);}
  if(command==='run'){const preset=value('--preset','smoke');if(flag('--smart')&&(flag('--preset')||flag('--domain')||flag('--fixture')))throw Error('--smart ne se combine pas avec --preset, --domain ou --fixture.');const options={smart:flag('--smart'),preset,domain:value('--domain'),fixture:value('--fixture'),model:value('--model','ornith-1.5:9b'),variant:value('--variant','cortex'),timeoutMs:Number(value('--timeout-ms','600000')),features:ablations(),cache:!flag('--no-cache')};if(!Number.isFinite(options.timeoutMs)||options.timeoutMs<=0)throw Error('Délai de fixture invalide.');if(!options.smart&&['quick','regression'].includes(preset))options.selectedIds=preset==='quick'?QUICK_IDS:REGRESSION_IDS;await run(options,{onProgress:createTerminalProgress()});process.exit(0);}
  throw Error(`Commande inconnue : ${command}`);
} catch(error) { console.error(`Solar Bench : ${error.message ?? error}`); process.exitCode=1; }
