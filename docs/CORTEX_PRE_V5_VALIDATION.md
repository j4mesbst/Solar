# Stabilisation avant V5 — validation

16 octobre 2026. Tests déterministes et données synthétiques uniquement. **Aucune commande `solar-bench run`, aucune campagne de 25 fixtures, aucun mini-benchmark IA, aucune génération réelle.** Un mini-benchmark réel n’était pas nécessaire pour vérifier les corrections techniques de ce lot. `GET /api/version` a seulement constaté Ollama 0.40.1.

## Commandes exécutées et résultats

| Commande | Résultat |
| --- | --- |
| `npm run build` | Succès TypeScript et Vite, 5507 modules. Avertissement de chunks >500 kB conservé. Les temps de compilation ne mesurent pas la vitesse d’Ornith. |
| `cargo test --offline --lib` depuis `src-tauri` | 9 tests natifs réussis : chemins/liens, source guards, annulation, scripts protégés, undo, SourceKit, compilation/réparation et aperçu local. |
| `node --experimental-strip-types scripts/cortex-pre-v5.test.mjs` | PASS : contexte, récupération, réparations, panne d’outil, dépendance concurrente, reprise, mémoire, DAG et métriques simulées. |
| `node --experimental-strip-types scripts/cortex-pre-v5-webkit.test.mjs` | PASS dans WebKit réel : bundle React local, montage différé et changement d’état différé observés conditionnellement ; élément jamais créé réellement détecté comme structure manquante. |
| 14 suites antérieures, liste ci-dessous | Toutes réussies lors de la validation finale ; aucun verdict de fixture affaibli. |
| `SOLAR_UI_NODE_MODULES=/Users/James/Documents/Solar/node_modules SOLAR_UI_CHROMIUM='<Chromium déjà installé>' node scripts/ui-cortex.cjs` | PASS ; fournisseur intercepté et réponses simulées, aucune écriture utilisateur. Captures inspectées après exécution. |
| `git diff --check` | Aucun défaut de whitespace. |

Les 14 suites antérieures, exécutées en série avec `node --experimental-strip-types scripts/<nom>.test.mjs`, sont : `agent-contract`, `cortex-contract`, `cortex-efficiency`, `cortex-backend-efficiency`, `cortex-v4-1`, `cortex-v4-1-webkit`, `cortex-v4`, `cortex-patch-recovery`, `cortex-autonomous-repair`, `cortex-v3-3`, `cortex-v3-3-1`, `cortex-v3-3-1-regression`, `cortex-render`, `solar-bench-technical`. Au total : **16 suites déterministes, 9 tests Rust et un contrôle navigateur**, en plus du build. Les helpers WebKit/validateurs sont réutilisés avec des sources préparées ; il ne s’agit pas de génération par Ornith ni de score de campagne.

## Couverture des vingt cas demandés

| Cas | Preuve principale |
| --- | --- |
| 1. Contraintes entre messages | pre-v5 + V4.1 : citations utilisateur transmises, assistant non promu en exigence, reprise sans nouvelle copie des contraintes. |
| 2. Compactage sans perte d’obligation | pre-v5 : chaînes obligatoires présentes après réduction ; trop de contraintes distinctes → pause explicite. |
| 3. Extrait original récupéré | pre-v5 : sous-chaîne exacte, hash, indices, original manquant/altéré rejeté. |
| 4. Déduplication | pre-v5 : contenu source identique projeté une fois, paragraphes d’obligations exactement identiques dédupliqués. |
| 5. Information obsolète | pre-v5 : observation historique après changement de source ; mémoire refusée après changement d’identité. |
| 6. Source changée pendant tâche | pre-v5 + efficiency : dépendance concurrente pendant vérification et source modifiée par un tiers conservées ; pause. |
| 7. Vérification identique réutilisée | V4.1 : un re-test identique n’exécute pas de compilation/capture supplémentaire. |
| 8. Mauvaise réutilisation refusée | V4.1 : source/configuration/dépendance différente → nouvelle vérification ; pre-v5 : dérive pendant contrôle interdit le cache. |
| 9. Réparation qui progresse | pre-v5 : diagnostic original récupéré puis patch différent vérifié ; panne temporaire résolue avec 1 génération et 2 essais de vérification. |
| 10. Réparation qui stagne | pre-v5 : entrées identiques malgré changement de branche non considérées nouvelles ; sortie vide répétée suspendue. |
| 11. Édition cohérente multi-fichiers | efficiency, V4.1, V3.3 : lot utile + no-op et DOM + CSS acceptés après contrôles. |
| 12. Rollback sûr | efficiency, V4.1 : action essentielle invalide rétablit fichiers et métadonnées ; panne de vérificateur conserve au contraire la proposition non vérifiée. |
| 13. Contexte saturé | pre-v5, backend : garde avant appel, réserves schéma/images/sortie et contraintes préservées. |
| 14. Sortie structurée invalide | pre-v5, V4.1 : schema exact, type/champ/plage incorrect refusés ; erreurs de parsing séparées d’édition. |
| 15. Reprise | pre-v5, V4.1 : obligations, originaux et candidate restaurés, vérification avant génération supplémentaire. |
| 16. Changement de modèle | V4.1 : identité/endpoint incompatibles refusés sans écraser le checkpoint ; pre-v5 : mémoire filtrée. |
| 17. Provenance | V4.1 et pre-v5 : indépendants/user/model distingués ; capture suggérée indisponible n’annule pas un résultat indépendant valable. |
| 18. UI asynchrone | pre-v5 WebKit : React réel avec événements et timers, pas de simulation de DOM ni de temps JS. |
| 19. Autorisations | pre-v5 + Rust : `allowChanges=false`, chemins sensibles, tests protégés et scripts modifiés restent refusés. |
| 20. Généralisation technique | Projets synthétiques et modèle arbitraires ; aucun embranchement par nom de fixture/modèle ajouté. Ceci ne démontre pas une généralisation qualitative avec plusieurs LLM. |

## Interface observée et portée

Le contrôle navigateur existant valide chat normal, pièce jointe texte, copie d’une commande du catalogue, clair/sombre, consentement de mémoire, tâche Cortex en pause lorsque la compilation native manque, 600×760, clavier et reduced-motion. Captures inspectées : [clair en pause](../output/playwright/cortex/cortex-paused-light.png), [petite fenêtre](../output/playwright/cortex/cortex-small-reduced-motion.png), [chat sombre synthétique](../output/playwright/cortex/chat-dark.png). Le message assistant hors sujet visible dans cette dernière capture est injecté volontairement par le test pour vérifier le tour suivant ; il ne provient pas d’un modèle réel. Aucun nouveau design n’a été ajouté. La validation exhaustive des palettes personnalisées et l’application Tauri empaquetée restent non vérifiées dans ce lot.

## Problèmes trouvés puis corrigés pendant validation

- Un budget sérialisé strict a exposé la taille excessive de la grammaire DOM/outils en 4K. Grammaire de scénario retirée des éditions et catalogue d’outils réduit dans cette fenêtre ; le test 4K précédent passe sans augmentation de contexte.
- Des tests de prompt attendaient les anciennes répétitions narratives ou le code sans échappement JSON. Ils vérifient maintenant l’état structuré, la source exacte sérialisée et l’alternative effective ; assertions indépendantes et fixtures inchangées.
- Le dernier diagnostic était parfois évincé derrière un briefing visuel redondant. Son extrait exact est désormais prioritaire ; le briefing complet est réservé au premier jet.
- Une panne de rendu et un diagnostic auto-test pouvaient encore effacer une proposition ou devenir bloquants. Tests négatifs ajoutés : proposition conservée avec pause pour le contrôle nécessaire, suggestion indisponible non bloquante.
- Les archives pouvaient évincer un original encore requis par une récupération. Rétention prioritaire de ces références ; manque ou altération explicite au lieu de reconstruction.

## Limites et reproductibilité

Le dépôt reste non commité à partir de `44fe889`. Les huit fichiers d’origine autres que `package.json` conservent leurs SHA-256 précédents. `package.json` et des scripts Solar Bench ont évolué en parallèle pendant ce travail ; cette mission ne les a pas édités et ne les a pas rétablis. Aucun fichier de fixtures/validateurs officiel n’a été modifié par cette mission. Les changements parallèles du runner n’ont pas été validés comme faisant partie du présent lot.

Pas de mesure réelle de premier token, KV cache, qualité, consommation mémoire, efficacité longue durée ou nombre de réparations avec Ornith. Les tokens et durées artificiels utilisés dans un test de transport sont uniquement des fixtures de métriques. Les valeurs absentes restent absentes ; les estimations de taille ne deviennent pas des tokens observés. Les suites ne prouvent aucune accélération, aucun gain de score et aucune isolation OS. Voir [limites restantes](CORTEX_PRE_V5_REMAINING_ISSUES.md) et [hypothèses à mesurer](CORTEX_PRE_V5_PERFORMANCE_HYPOTHESES.md).
