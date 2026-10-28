import assert from 'node:assert/strict';
import { aiderModelSettings } from '../adapters/aider.mjs';
import { opencodeConfig, opencodeDiagnostics } from '../adapters/opencode.mjs';
import { parseUsage, publicFiles } from '../adapters/common.mjs';
import { fixtureById } from '../fixtures/definitions.mjs';
import { OLLAMA_BASE, profile } from '../config/profiles.mjs';

const strict = profile('STRICT');
const aider = aiderModelSettings('ornith-1.5:9b', strict);
assert.match(aider, /edit_format: whole/);
assert.match(aider, /num_ctx: 16384/);
assert.match(aider, /num_predict: 2200/);

const opencode = opencodeConfig('ornith-1.5:9b', strict);
assert.equal(opencode.model, 'ollama/ornith-1.5:9b');
assert.equal(opencode.providers.ollama.settings.baseURL, `${OLLAMA_BASE}/v1`);
assert.deepEqual(opencode.providers.ollama.models['ornith-1.5:9b'].limit, { context: 16384, output: 2200 });
assert.equal(opencode.share, 'disabled');
const diagnostics = opencodeDiagnostics(`${JSON.stringify({ type: 'step_start' })}\n${JSON.stringify({ type: 'error', error: { type: 'provider.transport', message: 'ECONNRESET' } })}`);
assert.equal(diagnostics.stepStarts, 1);
assert.equal(diagnostics.lastError.type, 'provider.transport');

const usage = parseUsage(JSON.stringify({ part: { type: 'step-finish', tokens: { input: 100, output: 20, reasoning: 5, cache: { read: 40 } } } }));
assert.deepEqual(usage, { inputTokens: 140, outputTokens: 25, cachedInputTokens: 40, reasoningTokens: 5, provenance: 'reported-json' });
assert(!publicFiles(fixtureById('06-diagnosis-to-fix')).includes('public-test.mjs'));

console.log('Solar Bench V3 adapters: configuration, isolation surface and token accounting — PASS');
