import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createCortexSnapshot, loadSnapshotModules, defaultResultsRoot, git } from './solar-bench/runner.mjs';
import { writeJson } from './solar-bench/report.mjs';

const root = process.cwd();
const lock = join(defaultResultsRoot, '.solar-bench-smoke.lock');
const results = join(defaultResultsRoot, 'smoke');
await mkdir(defaultResultsRoot, { recursive: true });
try { await mkdir(lock); } catch { throw Error('Solar Bench smoke déjà en cours (verrou actif).'); }
const started = new Date().toISOString();
try {
  const snapshot = await createCortexSnapshot(root);
  const modules = await loadSnapshotModules(snapshot);
  const checks = [];
  const check = (id, fn) => { try { fn(); checks.push({ id, status:'passed' }); } catch (error) { checks.push({ id, status:'failed', error:String(error.message ?? error) }); } };
  check('runtime-export', () => assert.equal(typeof modules.CortexRuntime, 'function'));
  check('actions-schema', () => assert.equal(typeof modules.cortexActionSchema, 'object'));
  check('action-parser', () => assert.equal(modules.parseAgentResponse('{"actions":[]}').actions.length, 0));
  check('context-runtime', () => assert.equal(typeof modules.CortexRuntime.prototype.run, 'function'));
  check('snapshot-paths', () => assert.match(snapshot.sourceRoot, /solar-bench-cortex-/));
  check('permissions', () => { const issue=modules.validateAction({ type:'writeFile', path:'../escape', content:'x' }, { files:['src/a.ts'] }, new Map(), true); assert(issue); });
  check('snapshot-hash', () => assert.match(snapshot.sha256, /^[a-f0-9]{64}$/));
  const failed = checks.filter(item=>item.status==='failed');
  const report = { id:`smoke-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`, startedAt:started, finishedAt:new Date().toISOString(), profile:'smoke', snapshot, source:await git(root), checks, status:failed.length?'failed':'passed', ollama:'not-run' };
  await writeJson(join(results,`${report.id}.json`), report);
  console.log(`Solar Bench smoke: ${report.status.toUpperCase()} — ${checks.length-failed.length}/${checks.length} checks; snapshot ${snapshot.sha256}`);
  if (failed.length) process.exitCode=1;
} finally { await rm(lock,{recursive:true,force:true}); }
