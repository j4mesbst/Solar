import assert from 'node:assert/strict';
import { protectedCortexChanges } from '../adapters/cortex-guard.mjs';
const changes=(...paths)=>paths.map(path=>({path,after:'x'}));
assert.deepEqual(protectedCortexChanges(changes('src/cache.ts','test-cache.test.ts','src/cache.test.ts','public-test.mjs','src/__tests__/x.ts'),{id:'06-diagnosis-to-fix'}),['test-cache.test.ts','src/cache.test.ts','public-test.mjs','src/__tests__/x.ts']);
assert.deepEqual(protectedCortexChanges(changes('src/core.ts','docs/README.md'),{id:'06-diagnosis-to-fix'}),[]);
assert.deepEqual(protectedCortexChanges(changes('logs/server.log'),{id:'07-large-context'}),['logs/server.log']);
assert.deepEqual(protectedCortexChanges(changes('logs/server.log'),{id:'06-diagnosis-to-fix'}),[]);
console.log('Cortex benchmark guard: immutable tests and task logs — PASS');
