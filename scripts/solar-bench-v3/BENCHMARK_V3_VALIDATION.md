# Validation de Solar Bench V3

## Réussites déterministes

- `contracts.test.mjs` : fixtures, profils, adaptateurs, sandbox, rapports honnêtes — PASS.
- `bench:v3:fixtures` : 12/12 états initiaux rejetés ; 12/12 solutions de référence acceptées — PASS.
- Cortex V5 déterministe — PASS.
- Cortex V5 runtime simulé — PASS.
- Laboratoire Cortex A/B : 19/19 tests — PASS, sans Ollama.
- Snapshot chargé : Cortex 5.0.0, 161 fichiers, SHA‑256 `031874df84fc8415ca27a0bad5235ba4dc5743d638c0366a6c23db368a62e592`.

Le commit de base est `815263722e8e1ca4ea4476ba54d3b927b0a9e1e2`, branche `codex/cortex-v4.1-stabilization`. Le snapshot inclut des modifications locales non commitées : il est donc identifié par son empreinte complète, jamais décrit comme le contenu pur du commit. Les tests rendent ce V5 utilisable pour V3, sans prétendre que ses performances LLM sont déjà validées.

## Garde full et reprise

`bench:v3:full` sans `--confirm-full` lève une erreur avant doctor/inférence. L'état est atomique, chaque clé `fixture/agent/répétition` est unique et ignorée à la reprise. La configuration et le snapshot doivent conserver la même empreinte.

## Limites matérielles observées

L'API OpenAI-compatible Ollama peut charger le contexte natif 262K si le serveur n'est pas borné. La commande de reproduction impose donc un serveur dédié 16K. La validation 16K finale et le pilote comparatif restent à exécuter, car l'autorisation de démarrer ce serveur a atteint la limite d'usage de l'environnement après les diagnostics 8K.
