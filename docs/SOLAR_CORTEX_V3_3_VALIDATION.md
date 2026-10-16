# Validation Cortex V3.3 — 15 octobre 2026

Aucune commande `solar-bench run`, campagne ni ablation LLM exécutée pendant le développement. Les programmes techniques sont écrits à la main ; ils ne sont pas présentés comme des résultats Ornith.

| Phase | État | Vérifications |
|---|---|---|
| 0 — Audit | Terminé | Runtime V3.2, Ollama, outils, vérificateurs natifs, WebKit, checkpoints et Bench lus. Causes du dossier courant et du mauvais type de contrôle Swift identifiées. |
| 1 — Fondations | Implémenté et connecté | Schémas, outils atomiques, empreintes périmées, refus des chemins/champs inattendus, récupération de préfixes complets. |
| 2 — Code | AST et CEGIS connectés ; couverture LSP partielle | Régression rejetée, tests protégés, meilleur candidat restauré, CommonJS, huit validateurs JS indépendants, vraie compilation/assertions Swift sur programmes correct et incorrect. SourceKit-LSP réel sur copie. Tree-sitter et LSP Rust/TS non ajoutés. |
| 3 — Visuel | Rendu connecté ; comparaison détaillée partielle | Sept captures WebKit réelles, clic, scale/opacité/flou, viewport 390px, mouvement réduit émulé. Vite compilé et rendu avec assets ; clic React modifiant le DOM vérifié. Erreur de vision complémentaire gérée. Pas de note esthétique ni de segmentation générale. |
| 4 — Stratégie/recherche | Implémenté et connecté | Routage léger, évolution sur métrique fournie, candidat moins bon rejeté, meilleur conservé et options de désactivation. Gain avec Ornith non mesuré. |
| 5 — Intégration | Contrôles techniques passés | Anciens contrats, découverte de 25 exercices, snapshots atomiques du moniteur, TypeScript/Vite et tests Rust. Aucun DMG installé ; fenêtre native Solar non parcourue dans cette passe. |

## Vérifications reproductibles sans LLM

```bash
node --experimental-strip-types scripts/cortex-v3-3.test.mjs
node --experimental-strip-types scripts/cortex-contract.test.mjs
node --experimental-strip-types scripts/agent-contract.test.mjs
node --experimental-strip-types scripts/solar-bench.test.mjs
node --experimental-strip-types scripts/solar-bench-technical.test.mjs
node --experimental-strip-types scripts/cortex-v3-3-native.test.mjs
node --experimental-strip-types scripts/cortex-render.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml --lib --offline
npm run build
```

Les huit tests Rust couvrent isolation/conflit, annulation, build/test/réparation sur copie, refus de scripts modifiés, navigation Swift et aperçu WebKit. Les tests du runtime emploient un générateur simulé ; compilateurs, assertions Node/Swift et captures des tests techniques sont réels.

Les résultats V3.2 restent historiques. Aucun gain chiffré de vitesse, tokens/réussite, mémoire totale, qualité visuelle ou taux de réussite Ornith n’est revendiqué pour V3.3. Les versions différentes de validateurs ne sont pas directement comparables.

Une absence de LSP produit un enrichissement indisponible. Un échec Swift ne devient plus une erreur d’infrastructure parce que le journal mentionne le SDK. Les erreurs WebKit, interactions non déclenchées et animations statiques restent des contrôles échoués.
