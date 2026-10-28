import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { hashTree } from '../lib/io.mjs';

const exec = promisify(execFile);

export async function changedFiles(workspace) {
  const { stdout } = await exec('/usr/bin/git', ['status', '--porcelain', '--untracked-files=all'], { cwd: workspace });
  return stdout.split('\n').filter(Boolean).map(line => line.slice(3)).filter(name => !name.startsWith('.solar-bench/') && !name.startsWith('.aider')).sort();
}

export async function collectWorkspace(workspace) {
  const changed = await changedFiles(workspace);
  return { changedFiles: changed, finalTree: await hashTree(workspace, { ignore: [/^\.git\//, /^node_modules\//, /^\.solar-bench\//, /^\.aider/] }) };
}

export function parseUsage(text) {
  const input = [...String(text).matchAll(/(?:prompt|input)[_\s-]*tokens?[^\d]*(\d+)/gi)].map(match => Number(match[1]));
  const output = [...String(text).matchAll(/(?:completion|output)[_\s-]*tokens?[^\d]*(\d+)/gi)].map(match => Number(match[1]));
  const aider = String(text).match(/Tokens:\s*([\d.]+)(k?)\s+sent,\s*([\d.]+)(k?)\s+received/i);
  const scaled = (value, suffix) => Math.round(Number(value) * (suffix.toLowerCase() === 'k' ? 1000 : 1));
  const jsonUsage = String(text).split('\n').flatMap(line => { try { const value = JSON.parse(line); return value.part?.type === 'step-finish' && value.part.tokens ? [value.part.tokens] : []; } catch { return []; } });
  const jsonInput = jsonUsage.reduce((sum, value) => sum + (Number(value.input) || 0) + (Number(value.cache?.read) || 0), 0);
  const jsonOutput = jsonUsage.reduce((sum, value) => sum + (Number(value.output) || 0) + (Number(value.reasoning) || 0), 0);
  const cachedInputTokens = jsonUsage.reduce((sum, value) => sum + (Number(value.cache?.read) || 0), 0);
  const reasoningTokens = jsonUsage.reduce((sum, value) => sum + (Number(value.reasoning) || 0), 0);
  return {
    inputTokens: jsonUsage.length ? jsonInput : input.length ? input.reduce((a, b) => a + b, 0) : aider ? scaled(aider[1], aider[2]) : undefined,
    outputTokens: jsonUsage.length ? jsonOutput : output.length ? output.reduce((a, b) => a + b, 0) : aider ? scaled(aider[3], aider[4]) : undefined,
    cachedInputTokens: jsonUsage.length ? cachedInputTokens : undefined,
    reasoningTokens: jsonUsage.length ? reasoningTokens : undefined,
    provenance: jsonUsage.length ? 'reported-json' : input.length || output.length ? 'reported-parsed' : aider ? 'reported-rounded' : 'unavailable',
  };
}

export function publicFiles(fixture) {
  return Object.keys(fixture.files).filter(name => name !== 'public-test.mjs' && (!name.startsWith('logs/') || fixture.id === '07-large-context')).sort();
}
