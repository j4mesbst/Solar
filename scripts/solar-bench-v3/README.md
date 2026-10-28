# Solar Bench V3

Benchmark indépendant de Cortex, Aider et OpenCode avec le même modèle Ollama local. V3 reste séparé de Solar Bench V2, ne modifie pas Cortex et n'exécute jamais la campagne complète sans confirmation explicite.

Par défaut, l'adaptateur Cortex utilise le snapshot expérimental **V5 B corrigé** dans `experiments/cortex-architecture-research/snapshots/v5-corrected` (SHA-256 `b2c691f8dadac8d8e4cacf6a565496cec35361cb900211dd00b009ad0a5a2f99`). Ses sources restent isolées ; seules les dépendances installées du dépôt sont raccordées au snapshot d'exécution. `--cortex-root <dossier>` permet toujours de choisir explicitement un autre moteur.

## Commandes

```bash
npm run bench:v3:doctor
npm run bench:v3:fixtures
npm run bench:v3:pilot
npm run bench:v3:report -- --input scripts/solar-bench-v3/output/<ID>/campaign-state.json
npm run bench:v3:full -- --confirm-full
```

Options : `--agents cortex,aider,opencode`, `--fixture 01-broken-react`, `--repetitions 3`, `--profile STRICT|PRACTICAL`, `--model ornith-1.5:9b`, `--output <dossier>`, `--resume <ID>`, `--cortex-root <dossier>`. La configuration effective est imprimée avant tout essai.

La campagne complète représente 108 essais (`12 × 3 × 3`). Sans `--confirm-full`, `bench:v3:full` s'arrête avant toute inférence. Chaque essai utilise un dépôt temporaire neuf ; les oracles privés ne sont jamais copiés dans ce dépôt. L'ordre des agents tourne entre les tâches. Les états et rapports JSON/CSV/Markdown sont écrits atomiquement après chaque essai.

## Serveur Ollama borné

OpenCode 2.1.2 ne transmet pas `num_ctx` à l'API OpenAI-compatible Ollama : le champ `limit.context` sert à la gestion interne d'OpenCode. Utiliser une instance dédiée, sans cloud, pour imposer le contexte commun :

```bash
OLLAMA_HOST=127.0.0.1:11435 OLLAMA_CONTEXT_LENGTH=16384 OLLAMA_NO_CLOUD=true ollama serve
SOLAR_BENCH_OLLAMA_BASE=http://127.0.0.1:11435 npm run bench:v3:pilot
```

Le profil STRICT est fixé à 16K après observation d'une compaction OpenCode à 8K. PRACTICAL est aussi borné à 16K sur ce Mac 16 Go ; augmenter davantage requiert une nouvelle validation matérielle. Ne téléchargez pas de modèle : le doctor doit confirmer le digest `e5df7dcd…` déjà présent.

## Structure

- `adapters/` : contrat commun et harnais natifs.
- `fixtures/definitions.mjs` : prompts et dépôts publics fixes ; solutions seulement utilisées par la validation de conception.
- `validators/private.mjs` : oracles non copiés aux candidats.
- `telemetry/` : RAM processus, mémoire Ollama, swap, contexte effectif.
- `reports/` : génération depuis les seules données enregistrées.
- `tests/` : contrats déterministes.

Les valeurs absentes restent `undefined`/« non mesuré ». Un problème d'infrastructure ou de compatibilité n'est pas converti en échec fonctionnel.
