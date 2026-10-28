import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fixtures, fixtureById, pilotIds } from './fixtures/definitions.mjs';
import { materializeFixture } from './fixtures/materialize.mjs';
import { validateFixture, VALIDATOR_VERSION } from './validators/private-v2.mjs';
import { adapters, agentIds } from './adapters/index.mjs';
import { createSampler } from './telemetry/sampler.mjs';
import { doctor } from './doctor.mjs';
import { hashTree, sha256, writeJsonAtomic } from './lib/io.mjs';
import { writeReports } from './reports/generate.mjs';
import { createCortexSnapshot, loadSnapshotModules } from '../solar-bench/runner.mjs';

const root = resolve(new URL('../..', import.meta.url).pathname);
const defaultOutput = resolve('scripts/solar-bench-v3/output');
const defaultCortexRoot = resolve(root, 'experiments/cortex-architecture-research/snapshots/v5-corrected');
const statusFrom = ({ execution, validation, baseline }) => {
  const text = `${execution.process?.stderr ?? ''} ${execution.process?.stdout ?? ''}`;
  if (validation.checks.find(x => x.id === 'evaluation-integrity')?.status === 'failed') return ['EVALUATION_TAMPERING', 'Modification d’un fichier ou d’une commande d’évaluation détectée.'];
  if (execution.process?.externallyAborted) return ['INFRASTRUCTURE_ERROR', 'Interruption de sécurité ou utilisateur.'];
  if (execution.process?.code !== 0 && /provider\.transport|ECONNRESET|socket connection was closed/i.test(text)) return ['INFRASTRUCTURE_ERROR', 'Transport local Ollama interrompu (provider.transport / ECONNRESET).'];
  if (execution.process?.code !== 0 && /sandbox|operation not permitted|permission denied|configuration error|unknown option|EEXIST/i.test(text)) return ['INFRASTRUCTURE_ERROR', 'Erreur d’isolation, de permission ou de configuration de l’agent.'];
  if (/context length|context window|too many tokens/i.test(text)) return ['CONTEXT_INSUFFICIENT', 'Fenêtre de contexte insuffisante.'];
  if (/tool.*not supported|does not support tools|invalid tool/i.test(text)) return ['AGENT_MODEL_INCOMPATIBLE', 'Appel d’outils incompatible avec le modèle.'];
  if (validation.checks.some(x => x.status === 'unavailable')) return ['VALIDATION_UNAVAILABLE', 'Oracle indisponible.'];
  if (validation.passed) return ['PASS', execution.process?.timedOut ? 'Solution valide à l’état final malgré expiration du processus.' : undefined];
  if (execution.process?.timedOut) return ['TIMEOUT', 'Délai maximal atteint avant satisfaction des critères.'];
  const regression = baseline?.checks?.filter(x => x.status === 'passed').some(x => validation.checks.find(y => y.id === x.id)?.status === 'failed');
  if (regression) return ['REGRESSION', 'Un contrôle initialement valide a régressé.'];
  if (!execution.changedFiles?.length && execution.requiresWrite !== false) return ['STAGNATION', 'Aucune modification observable alors que la tâche exigeait une écriture.'];
  return ['FUNCTIONAL_FAIL', validation.checks.filter(x => x.status !== 'passed').map(x => x.output).join('; ').slice(0, 800)];
};

function orderFor(index) { return Array.from({ length: agentIds.length }, (_, offset) => agentIds[(index + offset) % agentIds.length]); }

export async function runCampaign(options = {}) {
  const kind = options.kind ?? 'pilot';
  if (kind === 'full' && options.confirmFull !== true) throw new Error('La campagne complète (108 essais) exige --confirm-full. Aucun essai lancé.');
  const selected = (options.fixtureIds ?? (kind === 'pilot' ? pilotIds : fixtures.map(x => x.id))).map(id => fixtureById(id));
  if (selected.some(x => !x)) throw new Error('Fixture inconnue dans la sélection.');
  const selectedAgents = options.agents ?? agentIds;
  const repetitions = options.repetitions ?? (kind === 'full' ? 3 : 3);
  const expectedRuns = selected.length * selectedAgents.length * repetitions;
  const health = await doctor({ model: options.model });
  if (!health.ollama.reachable || !health.ollama.installed) throw new Error(`Ollama/modèle indisponible : ${health.ollama.error ?? health.ollama.model}`);
  for (const agent of selectedAgents) if (!adapters[agent]) throw new Error(`Agent inconnu : ${agent}`);
  const id = options.resumeId ?? `${new Date().toISOString().replace(/[:.]/g, '-')}-${kind}-${randomUUID().slice(0, 8)}`;
  const directory = resolve(options.output ?? defaultOutput, id);
  const statePath = join(directory, 'campaign-state.json');
  await mkdir(directory, { recursive: true });
  const cortexRoot = resolve(options.cortexRoot ?? defaultCortexRoot);
  const configuration = { kind, agents: selectedAgents, fixtures: selected.map(x => ({ id: x.id, version: x.version })), validatorVersion: VALIDATOR_VERSION, repetitions, profile: options.profile, model: options.model, digest: health.ollama.digest, cortexRoot };
  const configurationHash = sha256(JSON.stringify(configuration));
  let campaign;
  try { campaign = JSON.parse(await readFile(statePath, 'utf8')); } catch {}
  if (campaign && campaign.configurationHash !== configurationHash) throw new Error('Reprise refusée : configuration, modèle, fixtures ou protocole différents.');
  const snapshotDir = join(directory, 'cortex-snapshot');
  const cortexSnapshot = campaign?.cortexSnapshot ?? await createCortexSnapshot(cortexRoot, snapshotDir, root);
  if (campaign && cortexSnapshot.sha256 !== campaign.cortexSnapshot.sha256) throw new Error('Reprise refusée : empreinte du snapshot Cortex différente.');
  const snapshotModules = await loadSnapshotModules(cortexSnapshot);
  cortexSnapshot.version = snapshotModules.CORTEX_VERSION;
  const protectedCortexRoot = resolve(cortexRoot, 'src');
  const protectedBefore = campaign?.protectedCortexRootSha256 ?? (await hashTree(protectedCortexRoot)).sha256;
  const productionCortexSha256 = campaign?.productionCortexSha256AtStart ?? campaign?.protectedCortexSha256 ?? (await hashTree(resolve('src/lib/cortex'))).sha256;
  campaign ??= { id, kind, startedAt: new Date().toISOString(), completed: false, expectedRuns, configurationHash, profile: options.profile, model: options.model, ollama: health.ollama, cortexSnapshot, protectedCortexRoot, protectedCortexRootSha256: protectedBefore, productionCortexSha256AtStart: productionCortexSha256, results: [] };
  campaign.protectedCortexRoot ??= protectedCortexRoot;
  campaign.protectedCortexRootSha256 ??= protectedBefore;
  campaign.productionCortexSha256AtStart ??= productionCortexSha256;
  const done = new Set(campaign.results.map(x => `${x.fixtureId}/${x.agent}/${x.repetition}`));
  let sequence = 0;
  campaignLoop: for (let repetition = 1; repetition <= repetitions; repetition++) {
    for (const fixture of selected) {
      const order = orderFor(sequence++).filter(agent => selectedAgents.includes(agent));
      for (const agent of order) {
        const key = `${fixture.id}/${agent}/${repetition}`;
        if (done.has(key)) continue;
        const temporary = await mkdtemp(join(tmpdir(), `solar-bench-v3-${fixture.id}-${agent}-`));
        const workspace = join(temporary, 'workspace'), stateDir = join(temporary, 'state');
        let result;
        try {
          const initialTree = await materializeFixture(fixture, workspace, { dependencyRoot: root, evaluationRoot: join(temporary, 'evaluation') });
          const evaluation = initialTree.evaluation;
          const baseline = await validateFixture(fixture, workspace, { evaluation });
          const controller = new AbortController(); let pid = agent === 'cortex' ? process.pid : undefined; let unsafe;
          const sampler = createSampler({ pid: () => pid, model: options.model, limits: options.profile.resource, onUnsafe: reason => { unsafe = reason; controller.abort(); } });
          await sampler.start();
          const started = Date.now();
          const execution = await adapters[agent].run({ fixture, workspace, profile: options.profile, model: options.model, stateDir, evaluation, signal: controller.signal, onSpawn: child => { pid = child.pid; }, snapshotModules, ollama: health.ollama });
          execution.requiresWrite = fixture.requiresWrite !== false;
          const telemetry = await sampler.stop();
          const validation = await validateFixture(fixture, workspace, { evaluation });
          const [status, reason] = statusFrom({ execution, validation, baseline });
          result = { fixtureId: fixture.id, fixtureVersion: fixture.version, validatorVersion: validation.validatorVersion, agent, repetition, order, status: unsafe ? 'INFRASTRUCTURE_ERROR' : status, reason: unsafe ? `Protection ressource : ${unsafe}.` : reason, termination: execution.process?.timedOut ? (validation.passed ? 'timeout-after-pass' : 'timeout') : execution.process?.externallyAborted ? 'aborted' : 'native-exit', durationMs: Date.now() - started, initialTreeSha256: initialTree.sha256, finalTreeSha256: execution.finalTree.sha256, changedFiles: execution.changedFiles, checks: validation.checks, baselineChecks: baseline.checks, inputTokens: execution.usage?.inputTokens, cachedInputTokens: execution.usage?.cachedInputTokens, reasoningTokens: execution.usage?.reasoningTokens, outputTokens: execution.usage?.outputTokens, tokenProvenance: execution.usage?.provenance, generations: execution.generations, repairs: execution.repairs, processExitCode: execution.process?.code, processStdout: execution.process?.stdout?.slice(-4000), processStderr: execution.process?.stderr?.slice(-4000), taskPhase: execution.taskPhase, memoryScope: agent === 'cortex' ? 'runner-process (borne supérieure)' : 'agent-process-tree', ...telemetry, native: execution.native };
        } catch (error) {
          result = { fixtureId: fixture.id, agent, repetition, order, status: 'INFRASTRUCTURE_ERROR', reason: error.message, durationMs: undefined };
        } finally { await rm(temporary, { recursive: true, force: true }); }
        campaign.results.push(result); done.add(key); campaign.updatedAt = new Date().toISOString();
        if ((await hashTree(protectedCortexRoot)).sha256 !== protectedBefore) throw new Error('Protection déclenchée : la source Cortex sélectionnée a changé pendant la campagne.');
        await writeJsonAtomic(statePath, campaign); await writeReports(campaign, directory);
      }
    }
    if (kind === 'pilot' && repetition === 1 && campaign.results.some(x => x.repetition === 1 && ['INFRASTRUCTURE_ERROR', 'AGENT_MODEL_INCOMPATIBLE'].includes(x.status))) {
      campaign.stoppedAfterCompatibilityStage = true; break campaignLoop;
    }
  }
  campaign.completed = campaign.results.length === expectedRuns;
  campaign.finishedAt = new Date().toISOString();
  campaign.protectedCortexRootSha256After = (await hashTree(protectedCortexRoot)).sha256;
  campaign.cortexRootUnchanged = campaign.protectedCortexRootSha256After === protectedBefore;
  campaign.protectedCortexSha256After = (await hashTree(resolve('src/lib/cortex'))).sha256;
  campaign.productionCortexUnchanged = campaign.protectedCortexSha256After === productionCortexSha256;
  await writeJsonAtomic(statePath, campaign);
  const reportPaths = await writeReports(campaign, directory);
  return { campaign, directory, statePath, ...reportPaths };
}
