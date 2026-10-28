import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { runProcess, sandboxed, writeSandboxProfile } from '../lib/process.mjs';
import { collectWorkspace, parseUsage, publicFiles } from './common.mjs';
import { OLLAMA_BASE } from '../config/profiles.mjs';

export const opencodeConfig = (model, profile) => ({
  $schema: 'https://opencode.ai/config.json', autoupdate: false, share: 'disabled', model: `ollama/${model}`,
  providers: { ollama: { package: '@opencode/ai/providers/openai-compatible', name: 'Ollama Local', settings: { baseURL: `${OLLAMA_BASE}/v1` }, models: { [model]: { name: 'Ornith 1.5 9B', limit: { context: profile.contextWindow, output: profile.maxOutputTokens }, settings: { temperature: profile.temperature } } } } },
  permission: { external_directory: 'deny', webfetch: 'deny', websearch: 'deny' },
});

export function opencodeDiagnostics(text) {
  const events = String(text).split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const errors = events.filter(event => event.type === 'error').map(event => event.error).filter(Boolean);
  return {
    stepStarts: events.filter(event => event.type === 'step_start').length,
    stepFinishes: events.filter(event => event.part?.type === 'step-finish').length,
    toolUses: events.filter(event => event.type === 'tool_use').length,
    errors,
    lastError: errors.at(-1),
  };
}

export const opencodeAdapter = {
  id: 'opencode',
  async run(context) {
    const { fixture, workspace, profile, model, stateDir, signal, onSpawn, evaluation } = context;
    const data = join(stateDir, 'data'), cache = join(stateDir, 'cache'), configHome = join(stateDir, 'config-home'), temp = join(stateDir, 'tmp');
    await Promise.all([mkdir(data, { recursive: true }), mkdir(cache, { recursive: true }), mkdir(configHome, { recursive: true }), mkdir(temp, { recursive: true })]);
    const config = join(stateDir, 'opencode.json');
    const sandboxProfile = join(stateDir, 'sandbox.sb');
    await writeFile(config, JSON.stringify(opencodeConfig(model, profile), null, 2));
    await writeSandboxProfile(sandboxProfile, workspace, stateDir, dirname(evaluation.publicRunner));
    const binary = resolve('scripts/solar-bench-v3/.tools/opencode/node_modules/.bin/opencode');
    const prompt = `${fixture.prompt}\n\nTravaille uniquement dans ce dépôt isolé. Lis les sources publiques nécessaires, exécute npm test, corrige les fichiers et termine seulement avec des preuves. Ne publie et ne partage rien.`;
    const args = ['run', '--standalone', '--auto', '--model', `ollama/${model}`, '--agent', 'build', '--format', 'json', '--title', `Solar Bench ${fixture.id}`, prompt];
    const wrapped = sandboxed(sandboxProfile, binary, args);
    const result = await runProcess(wrapped.command, wrapped.args, {
      cwd: workspace, signal, timeoutMs: profile.timeoutMs, onSpawn,
      env: { HOME: join(stateDir, 'home'), TMPDIR: temp, XDG_DATA_HOME: data, XDG_CACHE_HOME: cache, XDG_CONFIG_HOME: configHome, OPENCODE_CONFIG: config, OPENCODE_DISABLE_AUTOUPDATE: 'true' },
    });
    return { adapter: 'opencode', process: result, usage: parseUsage(`${result.stdout}\n${result.stderr}`), ...(await collectWorkspace(workspace)), native: { model: `ollama/${model}`, filesInitiallyVisible: publicFiles(fixture), config, commandFlags: args.filter(value => value.startsWith('--')), diagnostics: opencodeDiagnostics(result.stdout) } };
  },
};
