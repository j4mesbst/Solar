# Solar Bench — Smart Testing

`solar-bench run --smart` lit les fichiers modifiés dans Git (index, dossier de travail et fichiers non suivis). Si le dossier est propre, il prend les fichiers du dernier commit. La carte explicite `DEPENDENCY_MAP` dans `scripts/solar-bench/smart.mjs` relie les chemins aux cinq domaines. Un fichier de code non cartographié déclenche la suite de régression; un changement hors code utilise la suite rapide.

| Mode | Choix | Couverture |
|---|---|---|
| Quick (`--preset quick`) | 3 fixtures | Swift, JavaScript, animation |
| Targeted (`--smart`) | 2 fixtures par domaine affecté | Domaines issus de la carte Git |
| Regression (`--preset regression`) | 10 fixtures | 2 dans chacun des 5 domaines |
| Full (`--preset full`) | 25 fixtures | Validation officielle, toujours exécutée sans cache |

`--smart` bascule sur Quick si aucun domaine n'est concerné, et sur Regression lorsqu'un changement est transversal ou non cartographié. Les modes existants `smoke`, `medium`, `full`, `--domain`, `--fixture`, `--variant`, reprise, statut et rapports restent disponibles. `--smart` ne se combine pas avec une sélection explicite.

Un résultat partiel indique clairement qu'il ne mesure pas le score global des 25 exercices. Le rapport JSON et Markdown distingue `CACHED` des résultats exécutés; la durée d'une fixture réutilisée vaut zéro dans la campagne courante et sa durée d'origine est conservée séparément. Le Terminal récapitule les comptes exécutés et réutilisés ainsi que le temps de chaque fixture.

Le cache ne réutilise que les réussites antérieures avec une empreinte identique : contenu des sources et validateurs, définition et version de la fixture, variante, modèle et digest Ollama, version du serveur, options d'inférence/timeout/ablations, runner, registre, Node et plateforme. Les sources incluent largement `src`, `scripts/solar-bench` et le code natif pour invalider prudemment les dépendances implicites. Si le digest du modèle ou la version Ollama manque, il n'y a pas de réutilisation. `--no-cache` désactive la réutilisation.

Le détecteur d'échec rapide observe les checkpoints Cortex et arrête une fixture après des états identiques répétés, des erreurs d'infrastructure répétées ou des tentatives répétées sans modification. Chaque différence de contenu, de vérification ou de diagnostic remet le compteur à zéro. La seule durée écoulée n'est jamais un signal d'arrêt; le délai explicite par fixture reste indépendant.

Tests techniques courts sans inférence : `node --experimental-strip-types scripts/solar-bench-smart.test.mjs`, `npm run test:solar-bench`, `node --experimental-strip-types scripts/solar-bench-technical.test.mjs`. Aucune mesure de gain de temps réel ne peut être revendiquée avant une campagne Ollama.
