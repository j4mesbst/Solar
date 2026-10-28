import { writeFiles } from '../fixtures/materialize.mjs';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runProcess } from '../lib/process.mjs';
import { collectWorkspace, publicFiles } from './common.mjs';
import { protectedCortexChanges } from './cortex-guard.mjs';
import { OLLAMA_BASE } from '../config/profiles.mjs';

export const cortexAdapter = {
  id: 'cortex',
  async run(context) {
    const { fixture, workspace, profile, model, signal, snapshotModules, ollama, evaluation } = context;
    if (!snapshotModules) throw new Error('Snapshot Cortex absent.');
    const memory = new Map(); let generations = 0; const startedAt = Date.now();
    const project = { id: fixture.id, name: fixture.title, files: publicFiles(fixture), readFile: async path => fixture.files[path] ?? '' };
    const backend = snapshotModules.createCortexBackend({
      provider: { id: 'solar-bench-v3', name: 'Ollama local', protocol: 'ollama', baseUrl: OLLAMA_BASE, enabled: true, secretRef: 'local', connectionState: 'connected' },
      vault: { get: async () => null, set: async () => {}, delete: async () => {} }, conversationId: `v3-${fixture.id}`, modelId: model,
      contextWindow: profile.contextWindow, tools: ollama.capabilities?.includes('tools'), vision: false, onVisible: () => {},
    });
    const runtime = new snapshotModules.CortexRuntime();
    const output = await runtime.run({ conversationId: `v3-${fixture.id}`, prompt: fixture.prompt, modelId: model, project, mode: 'ultra', allowChanges: true, signal, generationTimeoutMs: Math.min(120_000, profile.timeoutMs) }, {
      persistence: { save: async task => memory.set(task.id, structuredClone(task)), load: async id => memory.get(id) },
      generate: async (call, childSignal) => { generations++; return backend({ ...call, maxOutputTokens: Math.min(profile.maxOutputTokens, call.maxOutputTokens ?? profile.maxOutputTokens) }, childSignal); },
      verify: async changes => {
        const protectedFiles=protectedCortexChanges(changes,fixture);
        if(protectedFiles.length)return [{type:'tests',status:'failed',success:false,category:'functional',origin:'independent',validatorId:'bench-protected-files',validatorVersion:'2',output:`Fichiers protégés par le benchmark : ${protectedFiles.join(', ')}. Ne modifie ni les tests ni les journaux immuables. Reprends uniquement les sources applicatives.`}];
        // CRITICAL: candidates are speculative. Running checks must never write
        // into the agent's actual workspace; failed/reverted attempts previously
        // survived as files and could contaminate both later checks and scores.
        const sandbox = await mkdtemp(join(tmpdir(), 'solar-cortex-v3-verify-'));
        try {
          const staged = join(sandbox, 'workspace');
          await cp(workspace, staged, { recursive: true, dereference: false });
          await writeFiles(staged, Object.fromEntries(changes.map(change => [change.path, change.after])));
          const result = await runProcess(process.execPath, [evaluation.publicRunner], { cwd: staged, timeoutMs: 45_000, signal });
          if(result.externallyAborted)signal.throwIfAborted();
          if(result.timedOut)return [{type:'tests',status:'unavailable',success:false,category:'functional',origin:'independent',validatorId:'v3-public',validatorVersion:'2',output:'Exécution du test public interrompue après 45 secondes; aucun verdict fonctionnel.'}];
          return [{ type: 'tests', status: result.code === 0 ? 'passed' : 'failed', success: result.code === 0, output: result.code === 0 ? 'Tests publics immuables réussis.' : result.stderr || result.stdout, category: 'functional', validatorId: 'v3-public', validatorVersion: '2' }];
        } finally {
          await rm(sandbox, { recursive: true, force: true });
        }
      },
      supportsVision: false,
    });
    const forbiddenFinal=protectedCortexChanges(output.changes??[],fixture);
    if(forbiddenFinal.length){
      // Never commit a test-modifying proposal, even if an uncooperative
      // model/runtime ignores the verifier result. Report an ordinary failed
      // attempt, not a passing or modified workspace.
      return { adapter:'cortex', process:{code:1,durationMs:Date.now()-startedAt,timedOut:false,stdout:'',stderr:`Fichiers protégés refusés : ${forbiddenFinal.join(', ')}`}, generations, repairs:output.task?.repairs, taskPhase:'failed', ...(await collectWorkspace(workspace)), native:{model,filesInitiallyVisible:publicFiles(fixture),cortexVersion:snapshotModules.CORTEX_VERSION} };
    }
    await writeFiles(workspace, Object.fromEntries((output.changes ?? []).map(change => [change.path, change.after])));
    const telemetry = output.task?.telemetry ?? {};
    return { adapter: 'cortex', process: { code: output.task?.phase === 'completed' ? 0 : 1, durationMs: Date.now() - startedAt, timedOut: false, stdout: '', stderr: (output.task?.issues ?? []).join('; ') }, usage: { inputTokens: telemetry.promptTokenSamples ? telemetry.promptTokens : undefined, outputTokens: telemetry.outputTokenSamples ? telemetry.outputTokens : undefined, provenance: telemetry.outputTokenSamples ? 'directly-reported' : 'unavailable' }, generations, repairs: output.task?.repairs, taskPhase: output.task?.phase, ...(await collectWorkspace(workspace)), native: { model, filesInitiallyVisible: publicFiles(fixture), cortexVersion: snapshotModules.CORTEX_VERSION } };
  },
};
