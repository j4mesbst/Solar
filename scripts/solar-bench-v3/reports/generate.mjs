import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeJsonAtomic } from '../lib/io.mjs';

const measured = (value, suffix = '') => Number.isFinite(value) ? `${Math.round(value * 10) / 10}${suffix}` : 'non mesuré';
const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

function summary(results, agent) {
  const rows = results.filter(row => row.agent === agent);
  const sum = key => { const values = rows.map(x => x[key]).filter(Number.isFinite); return values.length ? values.reduce((a, b) => a + b, 0) : undefined; };
  const max = key => { const values = rows.map(x => x[key]).filter(Number.isFinite); return values.length ? Math.max(...values) : undefined; };
  return { agent, runs: rows.length, passed: rows.filter(x => x.status === 'PASS').length, regressions: rows.filter(x => x.status === 'REGRESSION').length, durationMs: sum('durationMs'), inputTokens: sum('inputTokens'), outputTokens: sum('outputTokens'), peakAgentRssBytes: max('peakAgentRssBytes'), peakOllamaVramBytes: max('peakOllamaVramBytes') };
}

export function markdown(campaign) {
  const agents = [...new Set(campaign.results.map(x => x.agent))];
  const aggregate = agents.map(agent => summary(campaign.results, agent));
  const winner = aggregate.length ? [...aggregate].sort((a, b) => b.passed - a.passed || (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity))[0] : undefined;
  const general = aggregate.map(x => `| ${x.agent} | ${x.passed}/${x.runs} | ${measured(x.durationMs, ' ms')} | ${measured(x.inputTokens)} / ${measured(x.outputTokens)} | ${x.regressions} | ${measured(x.peakAgentRssBytes ? x.peakAgentRssBytes / 1024 ** 2 : undefined, ' MiB')} |`).join('\n');
  const details = campaign.results.map(x => `| ${x.fixtureId} | ${x.agent} | ${x.repetition} | ${x.status} | ${measured(x.durationMs, ' ms')} | ${x.changedFiles?.join(', ') || '—'} | ${x.reason ?? '—'} |`).join('\n');
  return `# Solar Bench V3 — ${campaign.kind}\n\n## Résumé\n\n- Campagne : \`${campaign.id}\`\n- Profil : **${campaign.profile.name}** ; modèle : \`${campaign.model}\` ; digest : \`${campaign.ollama?.digest ?? 'non mesuré'}\`\n- Snapshot Cortex : \`${campaign.cortexSnapshot?.sha256 ?? 'non créé'}\` (${campaign.cortexSnapshot?.version ?? 'version inconnue'})\n- Essais enregistrés : ${campaign.results.length}/${campaign.expectedRuns}\n- Plus grand nombre de réussites observé : ${winner ? `${winner.agent} (${winner.passed})` : 'aucun résultat'}\n- État : ${campaign.completed ? 'terminé' : 'incomplet / interrompu'}\n\n## Comparaison générale\n\n| Agent | Réussites | Temps | Tokens entrée / sortie | Régressions | RAM agent max |\n|---|---:|---:|---:|---:|---:|\n${general || '| — | — | — | — | — | — |'}\n\n## Résultats par exercice\n\n| Exercice | Agent | Répétition | Résultat | Durée | Fichiers modifiés | Cause |\n|---|---|---:|---|---:|---|---|\n${details || '| — | — | — | NON RÉALISÉ | — | — | — |'}\n\n## Méthodologie et limites\n\n- PASS exige les tests publics et l'oracle privé indépendant ; compiler sans satisfaire le comportement ne suffit pas.\n- Les statuts d'infrastructure, d'incompatibilité et de validation indisponible ne sont pas comptés comme des échecs intellectuels.\n- Les tokens absents restent « non mesuré » ; aucune valeur n'est remplacée par zéro.\n- Les trois agents sont exécutés séquentiellement avec le même serveur Ollama. Les harnais gardent leurs outils natifs.\n- Cette campagne ${campaign.kind === 'full' ? 'est la campagne complète' : "n'est pas la campagne complète de 108 essais"}.\n`;
}

export async function writeReports(campaign, directory) {
  await mkdir(directory, { recursive: true });
  const jsonPath = join(directory, 'SOLAR_BENCH_V3_RESULTS.json');
  const csvPath = join(directory, 'SOLAR_BENCH_V3_RESULTS.csv');
  const markdownPath = join(directory, 'SOLAR_BENCH_V3_REPORT.md');
  const headers = ['campaignId','fixtureId','agent','repetition','profile','status','durationMs','inputTokens','outputTokens','peakAgentRssBytes','peakOllamaVramBytes','changedFiles','reason'];
  const rows = campaign.results.map(x => [campaign.id,x.fixtureId,x.agent,x.repetition,campaign.profile.name,x.status,x.durationMs,x.inputTokens,x.outputTokens,x.peakAgentRssBytes,x.peakOllamaVramBytes,x.changedFiles?.join(';'),x.reason].map(csv).join(','));
  await writeJsonAtomic(jsonPath, campaign);
  await writeFile(csvPath, `${headers.join(',')}\n${rows.join('\n')}\n`);
  await writeFile(markdownPath, markdown(campaign));
  return { jsonPath, csvPath, markdownPath };
}

export async function loadCampaign(path) { return JSON.parse(await readFile(path, 'utf8')); }
