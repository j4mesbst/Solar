#!/usr/bin/env node
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { doctor } from './doctor.mjs';
import { profile, MODEL } from './config/profiles.mjs';
import { validateAll } from './validators/validate-all.mjs';
import { runCampaign } from './runner.mjs';
import { loadCampaign, writeReports } from './reports/generate.mjs';

const [command = 'help', ...argv] = process.argv.slice(2);
const value = (flag, fallback) => { const index = argv.indexOf(flag); return index >= 0 ? argv[index + 1] : fallback; };
const list = (flag, fallback) => String(value(flag, fallback)).split(',').filter(Boolean);
const has = flag => argv.includes(flag);
const model = value('--model', MODEL);
const selectedProfile = profile(value('--profile', 'STRICT'));

function effective(extra = {}) {
  const config = { command, model, profile: selectedProfile, ...extra };
  console.log(`Configuration effective :\n${JSON.stringify(config, null, 2)}`);
  return config;
}

if (command === 'doctor') {
  effective(); console.log(JSON.stringify(await doctor({ model }), null, 2));
} else if (command === 'fixtures') {
  effective(); const result = await validateAll(); console.log(JSON.stringify(result, null, 2)); if (!result.passed) process.exitCode = 1;
} else if (command === 'pilot' || command === 'full') {
  const options = effective({ kind: command, agents: list('--agents', 'cortex,aider,opencode'), fixtureIds: has('--fixture') ? list('--fixture', '') : undefined, repetitions: Number(value('--repetitions', command === 'full' ? 3 : 3)), output: value('--output', resolve('scripts/solar-bench-v3/output')), resumeId: value('--resume', undefined), cortexRoot: value('--cortex-root', resolve('experiments/cortex-architecture-research/snapshots/v5-corrected')), confirmFull: has('--confirm-full') });
  const result = await runCampaign({ ...options, model, profile: selectedProfile }); console.log(JSON.stringify({ directory: result.directory, report: result.markdownPath, completed: result.campaign.completed, results: result.campaign.results.length }, null, 2));
} else if (command === 'report') {
  const input = value('--input', undefined); if (!input) throw new Error('report exige --input <campaign-state.json>.');
  effective({ input }); const campaign = await loadCampaign(resolve(input)); console.log(await writeReports(campaign, resolve(input, '..')));
} else {
  console.log('Solar Bench V3\n  doctor\n  fixtures\n  pilot [--agents ...] [--fixture ...] [--repetitions N] [--profile STRICT|PRACTICAL] [--resume ID]\n  full --confirm-full [mêmes options]\n  report --input campaign-state.json');
}
