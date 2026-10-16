import { readFile } from 'node:fs/promises';
import { defaultResultsRoot } from './runner.mjs';

const path = process.argv.includes('--run')
  ? `${defaultResultsRoot}/${process.argv[process.argv.indexOf('--run') + 1]}/progress.json`
  : `${defaultResultsRoot}/live-progress.json`;
const ansi = process.stdout.isTTY;
const paint = (code, text) => ansi ? `\u001b[${code}m${text}\u001b[0m` : text;
const clear = () => ansi && process.stdout.write('\u001b[2J\u001b[H');
const names = { 'swift-debug':'Swift Debug', feature:'JavaScript Feature', refactor:'JavaScript Refactor', 'ui-description':'UI Description', 'react-premium':'React Premium UI', 'ui-reference':'UI Reference', 'visual-layout':'Visual Layout', 'motion-simple':'Motion Simple', 'motion-complex':'Motion Complex', 'motion-reference':'Motion Reference' };
const label = status => ({passed:'PASS',failed:'FAIL',timeout:'TIMEOUT',cancelled:'INTERRUPTED',stagnation:'STAGNATION'}[status] ?? status?.toUpperCase() ?? '');
const age = ms => `${Math.max(0, Math.floor(ms / 1000))}s`;
const draw = event => {
  clear();
  if (!event) { console.log('☀ SOLAR BENCH MONITOR\n\nEn attente du démarrage d’un benchmark…\nFichier suivi :', path); return; }
  const total=event.total ?? 0, completed=event.completed ?? 0, passed=event.passed ?? 0, failed=event.failed ?? 0;
  const width=28, filled=total ? Math.round((completed / total) * width) : 0;
  console.log(paint('1;36','☀ SOLAR BENCH MONITOR'), paint('90',' — suivi en direct'));
  console.log('━'.repeat(44));
  console.log(`Progression : ${paint('36',`[${'█'.repeat(filled)}${'░'.repeat(width-filled)}]`)} ${completed}/${total}`);
  console.log(`Résultats   : ${paint('32',`${passed} PASS`)} · ${paint('31',`${failed} échec(s)`)}`);
  if (event.type === 'start' || event.type === 'tick') console.log(`\n▶ ${event.index ?? completed + 1}/${total} ${names[event.fixtureId] ?? event.fixtureId}\n  ${event.variant === 'native' ? 'Native' : 'Cortex'} · Running… ${age(event.elapsedMs ?? 0)}`);
  if (event.type === 'complete') console.log(`\n✓ ${names[event.result.fixtureId] ?? event.result.fixtureId}\n  ${event.result.variant === 'native' ? 'Native' : 'Cortex'} · ${paint(event.result.status === 'passed' ? '32' : '31', label(event.result.status))} · ${age(event.result.durationMs)}`);
  if (event.type === 'summary') console.log(`\n${paint('1;32','Benchmark terminé')}\nRapport : ${event.reportPath}`);
  console.log(paint('90','\nCtrl-C pour quitter le moniteur')); 
};
let last='';
const tick = async () => { try { const value=await readFile(path,'utf8'); if(value!==last){ last=value; draw(JSON.parse(value)); } } catch { if(last!=='waiting'){last='waiting';draw(undefined);} } };
await tick();
const timer=setInterval(tick, 500);
process.on('SIGINT',()=>{ clearInterval(timer); clear(); process.exit(0); });
