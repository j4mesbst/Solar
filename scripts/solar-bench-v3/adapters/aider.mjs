import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { runProcess, sandboxed, writeSandboxProfile } from '../lib/process.mjs';
import { collectWorkspace, parseUsage, publicFiles } from './common.mjs';
import { OLLAMA_BASE } from '../config/profiles.mjs';

export const aiderModelSettings = (model, profile) => `- name: ollama_chat/${model}\n  edit_format: whole\n  use_repo_map: true\n  examples_as_sys_msg: false\n  extra_params:\n    num_ctx: ${profile.contextWindow}\n    temperature: ${profile.temperature}\n    num_predict: ${profile.maxOutputTokens}\n`;

export const aiderAdapter = {
  id: 'aider',
  async run(context) {
    const { fixture, workspace, profile, model, stateDir, signal, onSpawn, evaluation } = context;
    await Promise.all([mkdir(join(stateDir, 'home'), { recursive: true }), mkdir(join(stateDir, 'tmp'), { recursive: true })]);
    const promptPath = join(stateDir, 'prompt.txt');
    const modelSettings = join(stateDir, 'model-settings.yml');
    const metadata = join(stateDir, 'model-metadata.json');
    const envFile = join(stateDir, 'empty.env');
    const sandboxProfile = join(stateDir, 'sandbox.sb');
    await writeFile(promptPath, `${fixture.prompt}\n\nTravaille uniquement dans ce dépôt isolé. Applique directement les modifications, puis utilise npm test comme preuve publique. Ne publie et ne partage rien.\n`);
    await writeFile(envFile, '');
    await writeFile(modelSettings, aiderModelSettings(model, profile));
    await writeFile(metadata, JSON.stringify({ [`ollama_chat/${model}`]: { max_input_tokens: profile.contextWindow, max_output_tokens: profile.maxOutputTokens, input_cost_per_token: 0, output_cost_per_token: 0 } }, null, 2));
    await writeSandboxProfile(sandboxProfile, workspace, stateDir, dirname(evaluation.publicRunner));
    const binary = resolve('scripts/solar-bench-v3/.tools/bin/aider');
    const args = [
      '--model', `ollama_chat/${model}`, '--weak-model', `ollama_chat/${model}`,
      '--message-file', promptPath, '--yes-always', '--no-auto-commits', '--no-dirty-commits',
      '--no-stream', '--no-pretty', '--analytics-disable', '--no-check-update', '--no-cache-prompts',
      '--no-restore-chat-history', '--no-show-model-warnings', '--no-suggest-shell-commands', '--no-gitignore', '--no-detect-urls', '--no-notifications', '--no-browser', '--no-fancy-input', '--disable-playwright',
      '--model-settings-file', modelSettings, '--model-metadata-file', metadata, '--env-file', envFile,
      '--input-history-file', join(stateDir, 'input.history'), '--chat-history-file', join(stateDir, 'chat.history.md'),
      '--llm-history-file', join(stateDir, 'llm.history.md'), '--test-cmd', 'npm test', '--auto-test',
      ...publicFiles(fixture),
    ];
    const wrapped = sandboxed(sandboxProfile, binary, args);
    const result = await runProcess(wrapped.command, wrapped.args, {
      cwd: workspace, signal, timeoutMs: profile.timeoutMs, onSpawn,
      env: { HOME: join(stateDir, 'home'), TMPDIR: join(stateDir, 'tmp'), SHELL: '/bin/sh', BROWSER: '/usr/bin/false', OLLAMA_API_BASE: OLLAMA_BASE, AIDER_ANALYTICS_DISABLE: 'true', AIDER_NOTIFICATIONS: 'false' },
    });
    return { adapter: 'aider', process: result, usage: parseUsage(`${result.stdout}\n${result.stderr}`), ...(await collectWorkspace(workspace)), native: { model: `ollama_chat/${model}`, filesInitiallyVisible: publicFiles(fixture), commandFlags: args.filter(value => value.startsWith('--')) } };
  },
};
