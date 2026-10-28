import { access, mkdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { MODEL, OLLAMA_BASE } from './config/profiles.mjs';

const exec = promisify(execFile);
const paths = {
  aider: resolve('scripts/solar-bench-v3/.tools/bin/aider'),
  opencode: resolve('scripts/solar-bench-v3/.tools/opencode/node_modules/.bin/opencode'),
  ollama: '/usr/local/bin/ollama',
};

async function executable(name, args, env = {}) {
  const path = paths[name];
  try {
    await access(path);
    const { stdout, stderr } = await exec(path, args, { timeout: 15_000, env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env } });
    const bytes = await readFile(path);
    return { available: true, path, version: `${stdout}${stderr}`.trim().split('\n')[0], sha256: createHash('sha256').update(bytes).digest('hex') };
  } catch (error) { return { available: false, path, error: error.message }; }
}

export async function doctor({ model = MODEL } = {}) {
  const stateRoot = '/private/tmp/solar-bench-v3-doctor';
  await Promise.all(['data', 'cache', 'config'].map(name => mkdir(`${stateRoot}/${name}`, { recursive: true })));
  const tools = {
    aider: await executable('aider', ['--version'], { HOME: stateRoot }),
    opencode: await executable('opencode', ['--version'], { HOME: stateRoot, XDG_DATA_HOME: `${stateRoot}/data`, XDG_CACHE_HOME: `${stateRoot}/cache`, XDG_CONFIG_HOME: `${stateRoot}/config` }),
    ollama: await executable('ollama', ['--version']),
  };
  let ollama = { reachable: false, baseUrl: OLLAMA_BASE, model, error: 'Serveur non interrogé.' };
  try {
    const [versionResponse, tagsResponse, showResponse] = await Promise.all([
      fetch(`${OLLAMA_BASE}/api/version`, { signal: AbortSignal.timeout(2500) }),
      fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2500) }),
      fetch(`${OLLAMA_BASE}/api/show`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }), signal: AbortSignal.timeout(5000) }),
    ]);
    const version = versionResponse.ok ? await versionResponse.json() : {};
    const tags = tagsResponse.ok ? await tagsResponse.json() : {};
    const show = showResponse.ok ? await showResponse.json() : {};
    const installed = tags.models?.find(item => item.name === model || item.model === model);
    ollama = { reachable: versionResponse.ok && tagsResponse.ok, baseUrl: OLLAMA_BASE, serverVersion: version.version, model, installed: Boolean(installed), digest: installed?.digest, size: installed?.size, quantization: installed?.details?.quantization_level ?? show.details?.quantization_level, family: installed?.details?.family ?? show.details?.family, parameters: show.parameters, capabilities: show.capabilities ?? [], templateSha256: show.template ? createHash('sha256').update(show.template).digest('hex') : undefined };
  } catch (error) { ollama.error = error.message; }
  return { at: new Date().toISOString(), node: process.version, platform: `${process.platform}-${process.arch}`, memoryBytes: (await import('node:os')).totalmem(), tools, ollama, ready: tools.aider.available && tools.opencode.available && tools.ollama.available && ollama.reachable && ollama.installed };
}
