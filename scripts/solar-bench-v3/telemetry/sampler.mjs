import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OLLAMA_BASE } from '../config/profiles.mjs';

const exec = promisify(execFile);
const number = value => Number.isFinite(Number(value)) ? Number(value) : undefined;

async function systemSample() {
  const [vm, swap] = await Promise.all([
    exec('/usr/bin/vm_stat', []).then(x => x.stdout).catch(() => ''),
    exec('/usr/sbin/sysctl', ['-n', 'vm.swapusage']).then(x => x.stdout).catch(() => ''),
  ]);
  const page = number(vm.match(/page size of (\d+) bytes/)?.[1]);
  const pages = key => number(vm.match(new RegExp(`${key}:\\s+(\\d+)`))?.[1]);
  const freePages = [pages('Pages free'), pages('Pages inactive'), pages('Pages speculative')].filter(Number.isFinite).reduce((a, b) => a + b, 0);
  const swapUsedMb = number(swap.match(/used = ([\d.]+)M/)?.[1]);
  return {
    availableBytes: page ? freePages * page : undefined,
    swapUsedBytes: Number.isFinite(swapUsedMb) ? swapUsedMb * 1024 ** 2 : undefined,
  };
}

async function processRss(pid) {
  if (!pid) return undefined;
  return exec('/bin/ps', ['-axo', 'pid=,ppid=,rss=']).then(({ stdout }) => {
    const rows = stdout.trim().split('\n').map(line => line.trim().split(/\s+/).map(Number)).filter(row => row.length === 3);
    const selected = new Set([Number(pid)]); let changed = true;
    while (changed) { changed = false; for (const [child, parent] of rows) if (selected.has(parent) && !selected.has(child)) { selected.add(child); changed = true; } }
    const kb = rows.filter(([child]) => selected.has(child)).reduce((sum, row) => sum + (row[2] || 0), 0);
    return kb ? kb * 1024 : undefined;
  }).catch(() => undefined);
}

async function ollamaSample(model) {
  return fetch(`${OLLAMA_BASE}/api/ps`, { signal: AbortSignal.timeout(1200) }).then(async response => {
    if (!response.ok) return {};
    const body = await response.json();
    const loaded = body.models?.find(item => item.name === model || item.model === model);
    return { ollamaModelBytes: number(loaded?.size), ollamaVramBytes: number(loaded?.size_vram), effectiveContext: number(loaded?.context_length) };
  }).catch(() => ({}));
}

export function createSampler({ pid, model, intervalMs = 1000, onUnsafe, limits = {} }) {
  const samples = []; let timer; let initialSwap;
  const take = async () => {
    const [system, rss, ollama] = await Promise.all([systemSample(), processRss(pid?.()), ollamaSample(model)]);
    const sample = { at: new Date().toISOString(), ...system, agentRssBytes: rss, ...ollama };
    samples.push(sample);
    if (!Number.isFinite(initialSwap) && Number.isFinite(sample.swapUsedBytes)) initialSwap = sample.swapUsedBytes;
    if (Number.isFinite(sample.swapUsedBytes) && Number.isFinite(initialSwap) && Number.isFinite(limits.maxSwapGrowthBytes) && sample.swapUsedBytes - initialSwap > limits.maxSwapGrowthBytes) onUnsafe?.('swap-growth-limit', sample);
    if (Number.isFinite(sample.availableBytes) && sample.availableBytes < limits.minAvailableBytes) onUnsafe?.('memory-pressure', sample);
  };
  return {
    async start() { await take(); timer = setInterval(take, intervalMs); },
    async stop() { clearInterval(timer); await take(); return summarize(samples); },
    samples,
  };
}

function max(samples, key) { const values = samples.map(x => x[key]).filter(Number.isFinite); return values.length ? Math.max(...values) : undefined; }
function min(samples, key) { const values = samples.map(x => x[key]).filter(Number.isFinite); return values.length ? Math.min(...values) : undefined; }
export function summarize(samples) {
  return {
    samples: samples.length,
    peakAgentRssBytes: max(samples, 'agentRssBytes'),
    peakOllamaModelBytes: max(samples, 'ollamaModelBytes'),
    peakOllamaVramBytes: max(samples, 'ollamaVramBytes'),
    peakSwapUsedBytes: max(samples, 'swapUsedBytes'),
    swapGrowthBytes: samples.length && Number.isFinite(samples[0].swapUsedBytes) && Number.isFinite(samples.at(-1).swapUsedBytes) ? samples.at(-1).swapUsedBytes - samples[0].swapUsedBytes : undefined,
    minimumAvailableBytes: min(samples, 'availableBytes'),
    effectiveContext: max(samples, 'effectiveContext'),
    provenance: 'directly-measured',
  };
}
