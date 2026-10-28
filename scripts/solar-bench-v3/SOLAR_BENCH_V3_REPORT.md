# Solar Bench V3 — campagne complète

**NON RÉALISÉE.** La campagne complète de 108 essais n'a pas été déclenchée pendant la préparation, conformément au protocole. Aucun vainqueur, taux de réussite, graphique ou chiffre de campagne n'est inventé.

Commande séparée, après validation du pilote 16K :

```bash
OLLAMA_HOST=127.0.0.1:11435 OLLAMA_CONTEXT_LENGTH=16384 OLLAMA_NO_CLOUD=true ollama serve
SOLAR_BENCH_OLLAMA_BASE=http://127.0.0.1:11435 npm run bench:v3:full -- --confirm-full
```

Les fichiers `SOLAR_BENCH_V3_RESULTS.json`, `.csv` et le rapport Markdown seront générés depuis les essais réellement enregistrés. Les graphiques ne seront produits qu'à partir de ces données.
