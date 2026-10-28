# Solar Bench V3 — rapport de correction finale

Date : 21 octobre 2026. Campagne auditée : `2026-10-21T12-25-27-487Z-full-02215659` (3/12 pour chacun des trois agents). La campagne historique et Cortex n’ont pas été modifiés.

## Problèmes trouvés

- Les tests publics étaient copiés dans le dépôt de travail et le verdict exécutait `npm test` depuis ce dépôt. Quatre essais Cortex et un essai OpenCode ont modifié `public-test.mjs`; OpenCode a aussi créé `test-private.mjs`. Le verdict pouvait donc dépendre d’un fichier contrôlé par l’agent.
- L’oracle V1 comportait des assertions textuelles fragiles (`includes`, regex de source) qui refusaient des implémentations équivalentes.
- Aider était forcé au format `diff`. Avec Ornith, neuf réponses atteignaient exactement 2 200 tokens de sortie avant toute édition; ce n’était pas un défaut de permission du workspace.
- Les neuf timeouts OpenCode de la campagne montrent une activité et parfois des modifications jusqu’au délai; l’adaptateur attendait bien le processus. Le coût très élevé vient surtout des relectures de contexte mises en cache et des boucles natives. Le smoke final a isolé une erreur `provider.transport / ECONNRESET`, suivie de reprises OpenCode, et non un deadlock du runner.
- Le statut TIMEOUT était attribué avant validation de l’état final. Une solution correcte au moment du délai pouvait donc être déclarée en échec. La RAM Cortex n’était pas échantillonnée et la RAM des autres agents ne couvrait que le processus parent.
- Cortex disposait d’un timeout interne de génération de 120 s alors que le profil commun autorisait 480 s.

## Corrections effectuées

- Ajout du validateur **V2**, sans remplacer V1 : chaque nouvelle exécution consigne `validatorVersion: 2`; les anciennes campagnes restent interprétables avec leur oracle historique.
- Le test public officiel est désormais généré hors du workspace dans un bundle d’évaluation en lecture seule. Le verdict l’exécute directement et n’utilise plus le `package.json` ou le test que l’agent aurait modifié. La création/modification de `public-test.mjs`, `test-private.mjs`, de la commande de test ou du bundle produit `EVALUATION_TAMPERING`. Les agents peuvent créer d’autres tests sans influencer le verdict. L’oracle privé reste uniquement dans le processus du benchmark et n’est jamais fourni au modèle.
- Remplacement des contrôles textuels fragiles par des comportements exécutables et des contrôles AST/structure ciblés (React, imports SolarDate, HTML, responsive/accessibilité, contraintes de contexte). Les ambiguïtés purement stylistiques ont été retirées; les exigences explicites restent vérifiées.
- Aider utilise son format natif `whole`, adapté au modèle détecté, avec tous les fichiers projet utiles, un home/TMP isolé et les options sans navigateur. Aucun changement d’Aider lui-même.
- OpenCode conserve sa stratégie `build` native, une session standalone, un état/TMP isolé, 16K, 2 200 tokens par génération et Ollama local. La télémétrie consigne désormais étapes, outils et erreurs transport; aucun arrêt arbitraire fondé sur l’oracle privé n’a été ajouté.
- Le classement distingue `PASS`, `FUNCTIONAL_FAIL`, `REGRESSION`, `TIMEOUT`, `STAGNATION`, `EVALUATION_TAMPERING`, incompatibilité et erreur d’infrastructure. Un état final valide reste PASS avec la terminaison `timeout-after-pass`. L’absence d’écriture ne devient STAGNATION que pour une fixture qui exige réellement une écriture.
- Les tokens OpenCode séparent entrée nouvelle, cache lu et raisonnement; les valeurs arrondies Aider sont identifiées comme telles. La RAM couvre l’arbre de processus Aider/OpenCode; Cortex mesure le RSS du runner comme borne supérieure. Le timeout de génération Cortex est aligné sur le profil commun.

## Vérifications

| Vérification | Résultat |
|---|---|
| Contrats isolation/intégrité/tampering | PASS |
| Configuration déterministe Aider/OpenCode et comptage tokens | PASS |
| 12 états initiaux défectueux | 12/12 rejetés |
| 12 solutions de référence | 12/12 acceptées |
| 12 variantes correctes | 12/12 acceptées |
| 12 variantes volontairement défectueuses | 12/12 rejetées |
| `git diff --check` | PASS |
| Build global Solar | FAIL hors périmètre : erreurs TypeScript préexistantes dans `src/services/pluginRuntime.ts:50` et `src/ui/App.tsx:217` |

Smoke local unique, fixture `06-diagnosis-to-fix`, Ornith 9B / 16K :

| Agent | Résultat observé | Durée | Tokens entrée/sortie | Cause |
|---|---:|---:|---:|---|
| Cortex B | erreur infrastructure | ~120 s | non mesuré | ancien timeout interne de génération 120 s; aligné à 480 s après ce smoke, sans second essai |
| Aider | PASS | 48,668 s | 954 / 801 | édition `whole`, validations publiques et privées V2 réussies |
| OpenCode | erreur infrastructure | 227,190 s | 54 965 / 1 573, dont 47 821 en cache lu | connexion Ollama réinitialisée (`ECONNRESET`), puis reprises natives; aucune édition |

## Limites restantes

- Le correctif de budget Cortex et la stabilité OpenCode/Ollama après un `ECONNRESET` exigent une nouvelle campagne pour produire des scores; aucun résultat n’est inventé à partir du smoke.
- OpenCode peut encore consommer beaucoup de contexte ou atteindre le délai lorsqu’il progresse lentement. Aucun plafond d’étapes non documenté ni arrêt arbitraire n’a été ajouté.
- Aider émet encore des avertissements macOS de détection de navigateur sous sandbox, sans impact observé sur l’édition ou le verdict.
- Le harness V2 est prêt et équitable; la disponibilité opérationnelle des trois agents dépend encore de la stabilité locale d’OpenCode/Ollama pendant la campagne.

## Commande de relance corrigée (36 essais)

```bash
cd /Users/James/Documents/Solar
env SOLAR_BENCH_OLLAMA_BASE=http://127.0.0.1:11435 npm run bench:v3:full -- --confirm-full --repetitions 1 --profile STRICT
```

Cette commande crée une nouvelle campagne, utilise par défaut Cortex V5 B corrigée (`b2c691f8…`), Aider 0.86.2, OpenCode 2.1.2, Ornith `ornith-1.5:9b` et l’oracle V2. Ne pas reprendre l’identifiant historique, dont le protocole est V1.
