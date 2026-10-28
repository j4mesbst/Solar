# Résultats du pilote

Le pilote comparatif officiel n'est **pas terminé** et aucun classement n'est publié.

Résultats réellement acquis pendant la phase de compatibilité :

| Agent | Tâche | Profil effectif | Résultat |
|---|---|---|---|
| Aider | 06 Diagnosis-to-Fix | 8K de compatibilité | PASS vérifié, 36,8 s, 2,4k/525 tokens rapportés, ~278 Mio RSS agent, ~5,37 Gio mémoire Ollama |
| OpenCode | 06 Diagnosis-to-Fix | 8K de compatibilité | modification fonctionnelle produite, mais session terminée par `compaction.failed`; classé incompatibilité 8K, pas PASS/FAIL |
| Cortex | — | 16K requis | non exécuté dans une campagne comparable |

Ces lignes ne constituent pas le pilote 4 tâches × 3 agents. Les deux répétitions supplémentaires n'ont pas été lancées puisque la première matrice n'était pas compatible. Relance exacte :

```bash
OLLAMA_HOST=127.0.0.1:11435 OLLAMA_CONTEXT_LENGTH=16384 OLLAMA_NO_CLOUD=true ollama serve
SOLAR_BENCH_OLLAMA_BASE=http://127.0.0.1:11435 npm run bench:v3:pilot
```

Si la première répétition ne contient aucune erreur d'infrastructure/compatibilité, le runner poursuit automatiquement les répétitions 2 et 3. Sinon il conserve les résultats et s'arrête.
