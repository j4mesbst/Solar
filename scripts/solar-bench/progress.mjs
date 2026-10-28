const ANSI = {
  reset: "\u001b[0m", dim: "\u001b[2m", bold: "\u001b[1m", cyan: "\u001b[36m",
  green: "\u001b[32m", red: "\u001b[31m", yellow: "\u001b[33m", gray: "\u001b[90m",
};

const nameFor = (id) => ({
  'swift-debug': 'Swift Debug', feature: 'JavaScript Feature', refactor: 'JavaScript Refactor',
  'refactor-multifile': 'Multi-file Refactor', 'ui-description': 'UI Description',
  'react-premium': 'React Premium UI', 'ui-reference': 'UI Reference', 'visual-layout': 'Visual Layout',
  'motion-simple': 'Motion Simple', 'motion-complex': 'Motion Complex', 'motion-reference': 'Motion Reference',
}[id] ?? id.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()));
const variantFor = (variant) => variant === 'native' ? 'Native' : 'Cortex';
const elapsed = (ms) => ms < 1000 ? '0s' : ms < 60_000 ? `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
const resultLabel = (status) => ({ passed:'PASS', CACHED:'CACHED', timeout:'TIMEOUT', cancelled:'INTERRUPTED', stagnation:'STAGNATION', 'infrastructure-error':'INFRASTRUCTURE' }[status] ?? 'FAIL');
const toneFor = (status) => status === 'passed' ? 'green' : status === 'CACHED' ? 'cyan' : status === 'timeout' || status === 'stagnation' ? 'yellow' : 'red';

/** A TTY-only observer. It receives runner events and never changes a run. */
export function createTerminalProgress({ write = (text) => process.stdout.write(text), isTTY = Boolean(process.stdout.isTTY), color = isTTY } = {}) {
  const paint = (tone, value) => color ? `${ANSI[tone]}${value}${ANSI.reset}` : value;
  const line = (text = '') => write(`${text}\n`);
  const clear = () => { if (isTTY) write('\r\u001b[2K'); };
  let active = false;

  return (event) => {
    if (event.type === 'init') {
      line(paint('bold', paint('cyan', '☀ SOLAR BENCH — V2')));
      line(paint('dim', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      line(`${paint('green', '✓')} Ollama connecté — ${event.model}`);
      line(`${paint('green', '✓')} ${event.fixtureCount} fixtures disponibles`);
      if(event.mode)line(`${paint('cyan','Sélection :')} ${event.mode}${event.reason ? ` — ${event.reason}` : ''}`);
      if(!['full','advanced'].includes(event.mode))line(paint('dim','Résultats partiels : aucun score global de preset complet.'));
      line(); line(paint('bold', '▶ BENCHMARK STARTED')); line();
      return;
    }
    if (event.type === 'start') {
      if (active) { clear(); line(); }
      active = true;
      line(paint('bold', `[${event.index}/${event.total}] ${nameFor(event.fixtureId)}`));
      const startLine=`  ${paint('cyan', '→')} ${variantFor(event.variant)} : ${paint('dim', 'Running... 0s')}`;
      if(isTTY)write(startLine);else line(startLine);
      return;
    }
    if (event.type === 'tick') {
      if (!active || !isTTY) return;
      clear(); write(`  ${paint('cyan', '→')} ${variantFor(event.variant)} : ${paint('dim', `Running... ${elapsed(event.elapsedMs)}`)}`);
      return;
    }
    if (event.type === 'complete') {
      clear(); active = false;
      const label = resultLabel(event.result.status);
      line(`  ${paint(toneFor(event.result.status), ['passed','CACHED'].includes(event.result.status) ? '✓' : '✕')} ${variantFor(event.result.variant)} : ${paint(toneFor(event.result.status), label)} — ${event.result.status==='CACHED' ? `réutilisé (${elapsed(event.result.originalDurationMs??0)} initialement)` : elapsed(event.result.durationMs)}`);
      line(paint('dim', `  Sélection : ${event.passed} réussite${event.passed === 1 ? '' : 's'} · ${event.failed} échec${event.failed === 1 ? '' : 's'} · ${event.cached??0} cache · ${event.completed}/${event.total}`));
      return;
    }
    if (event.type === 'summary') {
      if (active) { clear(); line(); active = false; }
      const width = 24;
      const filled = event.total ? Math.round(((event.completed ?? event.total) / event.total) * width) : 0;
      const bar = `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
      line(); line(paint('bold', '▶ BENCHMARK COMPLETE'));
      line(`${paint('cyan', `[${bar}]`)} ${event.passed}/${event.total} réussites dans la sélection · ${elapsed(event.durationMs)}`);
      line(`${event.executed??0} exécuté(s) · ${event.cached??0} CACHED · ${event.failed} échec(s)`);
      line(`${paint('green', 'Rapport Markdown :')} ${event.reportPath}`);
    }
  };
}

export { elapsed, resultLabel };
