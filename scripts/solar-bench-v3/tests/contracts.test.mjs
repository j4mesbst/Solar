import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fixtures, pilotIds } from '../fixtures/definitions.mjs';
import { adapters, agentIds } from '../adapters/index.mjs';
import { profile } from '../config/profiles.mjs';
import { materializeFixture, writeFiles } from '../fixtures/materialize.mjs';
import { validateFixture, VALIDATOR_VERSION } from '../validators/private-v2.mjs';
import { hashTree, redact } from '../lib/io.mjs';
import { writeSandboxProfile } from '../lib/process.mjs';
import { markdown } from '../reports/generate.mjs';

assert.equal(fixtures.length, 12);
assert.deepEqual(pilotIds, ['01-broken-react', '02-multifile-refactor', '06-diagnosis-to-fix', '10-long-context']);
assert.deepEqual(agentIds, ['cortex', 'aider', 'opencode']);
for (const adapter of Object.values(adapters)) assert.equal(typeof adapter.run, 'function');
assert.equal(profile('strict').contextWindow, 16384);
assert.throws(() => profile('cloud'));
assert.equal(new Set(fixtures.map(x => x.id)).size, 12);
assert(fixtures.every(x => x.prompt && x.publicCommand === 'npm test' && Object.keys(x.solution).length));

const base = await mkdtemp(join(tmpdir(), 'solar-bench-v3-contract-'));
try {
  const fixture = fixtures[5], workspace = join(base, 'workspace'), state = join(base, 'state');
  await mkdir(state, { recursive: true });
  const initial = await materializeFixture(fixture, workspace);
  await assert.rejects(readFile(join(workspace, 'public-test.mjs'), 'utf8'));
  assert.equal(VALIDATOR_VERSION, 2);
  assert.equal((await validateFixture(fixture, workspace, { evaluation: initial.evaluation })).passed, false);
  await writeFiles(workspace, fixture.solution);
  assert.equal((await validateFixture(fixture, workspace, { evaluation: initial.evaluation })).passed, true);
  await writeFiles(workspace, { 'test-private.mjs': 'process.exit(0)\n' });
  const tampered = await validateFixture(fixture, workspace, { evaluation: initial.evaluation });
  assert.equal(tampered.passed, false);
  assert.equal(tampered.checks.find(item => item.id === 'evaluation-integrity').status, 'failed');
  assert.notEqual((await hashTree(workspace, { ignore: [/^\.git\//] })).sha256, initial.sha256);
  const sandbox = join(state, 'sandbox.sb'); await writeSandboxProfile(sandbox, workspace, state, join(base, 'workspace-evaluation'));
  const text = await readFile(sandbox, 'utf8');
  assert.match(text, /deny default/); assert.match(text, /localhost/); assert.doesNotMatch(text, /allow file-read\*\)\n/);
  assert.doesNotMatch(text, /allow file-write\*[^\n]*\/private\/tmp/);
  assert.equal(redact(`${process.env.HOME}/x sk-secretsecretsecret`).includes(process.env.HOME), false);
  const report = markdown({ id:'x', kind:'pilot', profile:profile('STRICT'), model:'ornith-1.5:9b', expectedRuns:1, completed:false, results:[] });
  assert.match(report, /NON RÉALISÉ/); assert.match(report, /n'est pas la campagne complète/);
} finally { await rm(base, { recursive:true, force:true }); }

console.log('Solar Bench V3 contracts: fixtures, adapters, isolation, validators, profiles and honest reporting — PASS');
