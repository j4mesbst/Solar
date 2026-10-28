import { spawn } from 'node:child_process';
import { realpath, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { redact } from './io.mjs';

export function sanitizedEnv(extra = {}) {
  const keep = ['PATH', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM', 'SHELL', 'USER'];
  const env = Object.fromEntries(keep.filter(key => process.env[key]).map(key => [key, process.env[key]]));
  return { ...env, NO_COLOR: '1', CI: '1', ...extra };
}

export async function runProcess(command, args, { cwd, env = {}, timeoutMs = 60_000, signal, stdin, onSpawn, maxLogBytes = 2_000_000 } = {}) {
  const startedAt = Date.now();
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd, env: sanitizedEnv(env), stdio: ['pipe', 'pipe', 'pipe'], detached: false });
    onSpawn?.(child);
    let stdout = '', stderr = '', timedOut = false, externallyAborted = false;
    const append = (current, chunk) => (current + chunk).slice(-maxLogBytes);
    child.stdout.on('data', value => { stdout = append(stdout, value.toString()); });
    child.stderr.on('data', value => { stderr = append(stderr, value.toString()); });
    if (stdin) child.stdin.end(stdin); else child.stdin.end();
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 3000).unref(); }, timeoutMs);
    const abort = () => { externallyAborted = true; child.kill('SIGTERM'); };
    signal?.addEventListener('abort', abort, { once: true });
    child.on('error', error => { stderr = append(stderr, error.stack ?? error.message); });
    child.on('close', (code, terminationSignal) => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      resolve({ code, signal: terminationSignal, stdout: redact(stdout), stderr: redact(stderr), timedOut, externallyAborted, durationMs: Date.now() - startedAt, pid: child.pid });
    });
  });
}

export async function writeSandboxProfile(path, workspace, writableState, readOnlyEvaluation) {
  workspace = await realpath(workspace);
  writableState = await realpath(writableState);
  const quote = value => String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const ancestors = value => {
    const paths = [];
    for (let current = dirname(value); current !== '/'; current = dirname(current)) paths.push(current);
    return paths;
  };
  const metadataAncestors = [...new Set([...ancestors(workspace), ...ancestors(writableState)])]
    .map(value => `(literal "${quote(value)}")`).join(' ');
  const tools = await realpath(new URL('../.tools', import.meta.url).pathname);
  const evaluation = readOnlyEvaluation ? await realpath(readOnlyEvaluation) : undefined;
  const evaluationRead = evaluation ? `(subpath "${quote(evaluation)}")` : '';
  const profile = `(version 1)\n(deny default)\n(import "system.sb")\n(allow process*)\n(allow sysctl-read)\n(allow mach-lookup)\n(allow network-outbound (remote ip "localhost:*"))\n(allow network-inbound (local ip "localhost:*"))\n(allow file-read-metadata ${metadataAncestors})\n(allow file-read* (subpath "${quote(workspace)}") (subpath "${quote(writableState)}") ${evaluationRead} (subpath "${quote(tools)}") (subpath "/System") (subpath "/usr") (subpath "/bin") (subpath "/sbin") (subpath "/Library") (subpath "/Applications/Ollama.app") (subpath "/private/tmp"))\n(allow file-write* (subpath "${quote(workspace)}") (subpath "${quote(writableState)}"))\n`;
  await writeFile(path, profile);
  return path;
}

export function sandboxed(profilePath, command, args) {
  return { command: '/usr/bin/sandbox-exec', args: ['-f', profilePath, command, ...args] };
}
