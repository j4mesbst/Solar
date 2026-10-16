# Solar Cortex V3.3.2 — validation technique

## Audit de la campagne V3.3.1

La campagne Smart Regression du 15 octobre 2026 (`2026-10-15T11-28-23-150Z-44305c76`) a enregistré **5 PASS, 5 STAGNATION, 0 TIMEOUT** en 18 min 58 s. Les cinq checkpoints et leurs derniers journaux d'actions ont été inspectés. Ce sont des constats sur cette campagne, pas des résultats V3.3.2.

| Cas | Cause observée dans les traces |
| --- | --- |
| `ui-reference` | Premier HTML complet proposé, mais `patchFile.oldText` visait une ancienne source et n'a pas été appliqué. Les tours suivants ont rendu un JSON long tronqué ; aucun fichier n'a changé. |
| `ui-tabs` | Patch initial périmé ; proposition ultérieure avec script JavaScript invalide (`Unexpected token ';'`) et cible DOM `#panel` absente. Des actions de lecture/build ont ensuite répété le diagnostic. |
| `visual-layout` | HTML effectivement modifié, sans les éléments structurels exigés (`h1`, `h2`) ; les tours suivants relançaient les tests sans mutation réparatrice. |
| `motion-interactive` | Élément présent, mais aucune interaction ne déclenchait la transition attendue : opacité mesurée `0 → 0`. Les tours suivants relançaient tests/build. |
| `refactor-multifile` | Deux fichiers modifiés. Le contrôle statique signalait à tort une déclaration absente pour une variable destructurée ; l'exécution Node échouait réellement sur un chemin de module local introuvable. |

L'intention exacte d'Ornith hors des réponses conservées n'est pas déductible. Aucune cause non visible dans les checkpoints n'est présentée comme démontrée.

## Corrections apportées

- Premier artefact visuel limité à une création ou un remplacement de fichier complet. Un patch HTML entier visant une ancienne petite source peut devenir un remplacement explicite, toujours soumis aux contrôles de chemin, de protection et à la vérification réelle. Un bloc de code complet inattendu peut être récupéré seulement si son chemin est sûr et si le document est complet. Les JSON tronqués ne sont jamais appliqués partiellement hors actions complètes validées ; une continuation de suffixe est tentée, puis la sortie est rejetée si elle reste incomplète.
- Contrôle syntaxique aux points de vérification des modifications JS/TS/JSX/TSX et des scripts JavaScript intégrés au HTML. Les erreurs remontent fichier, ligne, colonne et extrait court. Une syntaxe invalide évite la compilation/rendu coûteux et ne devient pas la meilleure candidate.
- Classification courte des échecs : syntaxe, DOM/structure, module/import, interaction, mouvement, géométrie et tests. Elle reprend les sélecteurs/mesures effectivement observés par WebKit et oriente la mutation du fichier concerné avant de relancer la validation. Après un échec, une nouvelle action de lecture ou de build seule n'est plus traitée comme une réparation.
- Reprise d'une tâche dont les fichiers étaient déjà proposés mais la vérification indisponible : les mêmes fichiers sont revérifiés avant de solliciter le modèle. L'export CommonJS d'une variable destructurée n'est plus faussement signalé absent ; les vrais échecs de résolution de module restent remontés.
- Solar Bench Smart cartographie explicitement `skillEngine.ts` et `solarModels.ts` comme dépendances transversales ; leur modification peut donc toujours sélectionner Regression. Les fichiers système `.DS_Store` et `Thumbs.db` sont exclus de la détection et de l'empreinte source.

Les fixtures et leurs validateurs n'ont pas été modifiés. La protection des fichiers de test, l'isolation des changements proposés, l'annulation et l'absence de plafond global de production sont conservées. Aucune animation de secours n'est injectée.

## Vérifications techniques

- `scripts/cortex-v3-3-2.test.mjs` : récupération sûre du premier artefact, erreur syntaxique localisée, classification DOM, mapping Smart, et réparation simulée de `ui-tabs` soumise au véritable validateur WebKit.
- Contrats Cortex V3.3 et V3.3.1, `npm run test:cortex`, `npm run test:agent`, `scripts/solar-bench-smart.test.mjs`, `scripts/solar-bench-technical.test.mjs` et test natif Cortex V3.3 réussis. Ce dernier couvre WebKit réel, interaction React/Vite, fenêtre étroite et mouvement réduit. Les 8 tests Rust sont réussis. `npm run build` réussit avec l'avertissement existant sur la taille de certains chunks.
- `git diff --check` exécuté.

## Limites

Aucune commande `solar-bench run` ni inférence Ollama n'a été lancée. Le taux de réussite, la durée et la qualité visuelle réels de V3.3.2 avec Ornith restent **non vérifiés** jusqu'à la campagne de l'utilisateur. La récupération du code hors JSON est volontairement étroite : elle ne devine ni chemin ambigu, ni HTML incomplet, ni solution de benchmark. Les diagnostics structurels guident le modèle, sans garantir qu'il proposera le bon patch.
