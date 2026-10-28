# Rapport de compatibilité

## Environnement mesuré

- Mac Apple Silicon, 16 Gio de mémoire unifiée.
- Ollama 0.40.1 ; `ornith-1.5:9b` ; digest `e5df7dcdd8a263994df62d610317e07be0d6af23f96fcbd8543273058fce575e` ; Q4_K_M ; famille qwen35.
- Capacités annoncées : tools, thinking, completion, vision.
- Aucun modèle téléchargé et aucun fournisseur cloud utilisé.

## Résultats réels

| Agent | Connexion Ornith | Lecture/édition/test | Verdict de compatibilité |
|---|---|---|---|
| Aider 0.86.2 | confirmée, `ollama_chat/ornith-1.5:9b` | PASS sur Diagnosis-to-Fix en 36,8 s ; `src/cache.ts` corrigé ; tests publics et privés réussis ; 2,4k tokens entrée / 525 sortie rapportés | compatible |
| OpenCode 2.1.2 | confirmée, `ollama/ornith-1.5:9b` | à 8K, a lu, testé et corrigé `src/cache.ts`, puis a créé un fichier de vérification ; échec de compaction avant fin | incompatible à 8K ; 16K requis à revalider |
| Cortex 5.0.0 | backend et snapshot chargés ; tests déterministes PASS | aucune inférence comparable 16K terminée dans cette session | non mesuré, pas un échec |

OpenCode a d'abord provoqué un chargement effectif de 262 144 tokens (`llama-server -c 262144`, ~8,3 Gio RSS) malgré `limit.context: 8192`. L'essai a été interrompu et le modèle déchargé. Une requête minimale a confirmé que `options.num_ctx` est ignoré par l'API OpenAI-compatible. Une instance Ollama dédiée avec `OLLAMA_CONTEXT_LENGTH=8192` a ensuite chargé exactement `context_length: 8192` (~6,3 Gio), mais OpenCode a atteint sa compaction. STRICT a donc été relevé à 16K. La tentative d'ouvrir le serveur 16K a été bloquée par la limite d'approbation de l'environnement Codex ; aucun résultat 16K n'est inventé.

Les deux essais OpenCode interrompus par les anciens seuils de sécurité sont des diagnostics d'infrastructure, exclus de toute comparaison de capacité.
