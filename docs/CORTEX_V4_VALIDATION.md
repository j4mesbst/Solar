# Cortex 4.0.0 — intégration et validation

Date : 15 octobre 2026. Modèle de comparaison réelle : `ornith-1.5:9b`.

## Ce qui est effectivement intégré

1. Profil adaptatif de transport/édition par modèle et configuration, persistant
   par compte. Les capacités déclarées par Ollama restent distinctes des
   observations. La fenêtre du runtime et celle du backend sont alignées.
2. Édition JS/TS/TSX par bornes AST exactes, empreintes de version, transactions
   multi-fichiers de propositions et garde contre les modifications externes.
3. Graphe structuré généré pour les demandes complexes, critères vérifiables,
   dépendances, checkpoints, invalidation transitive et revalidation à la reprise.
4. Assertions DOM après chaque action WebKit, cibles CSS supplémentaires,
   assertions finales, mesures temporelles existantes et critique visuelle
   transmise à la réparation avec les observations indépendantes.
5. Recherche séquentielle depuis la meilleure proposition : réinspection réelle,
   édition de symbole/plage, proposition alternative. Les mêmes éditions
   rejetées ne bénéficient pas d’un nouveau compteur en changeant de branche.
6. Mémoire compacte avec provenance, réparation utile et empreintes des fichiers
   et manifestes ; les expériences périmées ou d’un autre compte/projet ne sont
   pas injectées comme preuves actuelles.

## Vérifications techniques

Réussies :

- Contrats Cortex et agent existants ; maintien d’une tâche utile de neuf étapes
  sans plafond global de production, annulation et reprise.
- Suite V3.3 : assertions/compilation Swift et JS indépendantes, WebKit réel,
  interaction React servie avec ses assets Vite, normal/réduit et petit viewport.
- Non-régressions V3.3.1, conflits de patch et réparation autonome.
- Tests d’efficacité et de transport ; restauration d’un tour multi-fichier,
  concurrence pendant une vérification réussie, panne de vérification récupérable,
  suppression des rendus coûteux sur erreur de syntaxe, compactage conservateur.
- Suite V4 : AST préservant les symboles voisins, profils et invalidation,
  graphe explicite et automatique, invalidation de preuves, lecture ciblée
  conservée, répétition détectée, mémoire périmée écartée, isolation par compte.
- WebKit V4 : état ouvert puis fermé mesuré après chaque clic, attributs ARIA,
  alias CSS et correction d’un handler manquant à partir de ces observations.
- Le vérificateur externe peut ignorer volontairement les scénarios du modèle :
  ses résultats ne sont plus réinterprétés comme un DOM absent. Une capture
  complémentaire distincte observe le scénario sans modifier son verdict.
- Premier HTML autonome explicitement ciblé : document complet non échappé,
  puis contrat JSON court séparé. Une sortie tronquée n’est jamais appliquée ;
  un contrat invalide conserve le fichier et sa reprise ne régénère que le contrat.
- Huit tests Rust natifs. TypeScript et build Vite réussis. L’avertissement de
  taille des chunks existe toujours ; il n’a pas été masqué.
- Contrôle Playwright CLI dans un profil navigateur isolé et avec provider simulé :
  chat normal, contenu de pièce jointe transmis, modèle arbitraire conservé dans
  Cortex 4.0.0, consentement mémoire, proposition conservée et pause/reprise en
  l’absence de compilation native, thèmes clair/sombre, petit viewport sans
  débordement horizontal, focus clavier et média reduced-motion. Aucune erreur
  JavaScript observée. Captures inspectées dans `output/playwright/cortex-v4/`.
  Ce contrôle Chromium n’est pas une installation ni un essai complet de l’app
  Tauri ; les interactions WebKit natives sont couvertes séparément ci-dessus.

Commandes ajoutées :

```sh
node --experimental-strip-types scripts/cortex-v4.test.mjs
node --experimental-strip-types scripts/cortex-efficiency.test.mjs
node --experimental-strip-types scripts/cortex-backend-efficiency.test.mjs
```

## Comparaisons réelles ciblées

Trois essais ciblés `ui-tabs` sans cache ont réellement été exécutés avec le même
`ornith-1.5:9b` Q4_K_M (digest `e5df7dcd…`), Ollama 0.40.1. Les fixtures et leurs
validateurs n’ont pas changé. Ce sont des essais de développement successifs,
pas une comparaison statistique ni la campagne des 25 exercices.

| Révision | Variante / résultat | Durée | Générations | Tokens | Réparations |
| --- | --- | ---: | ---: | ---: | ---: |
| `5ac2abf` | Native FAIL, aucune modification | 6,810 s | 1 | 33 | 0 |
| `5ac2abf` | Cortex PASS, 5 contrôles externes | 94,354 s | 2 | 1 732 | 0 |
| `0c14972` | Cortex INTERRUPTED, arrêt manuel de diagnostic | 233,700 s | non consolidé | non consolidé | non consolidé |
| `0ef021a` | Cortex PASS, 5 contrôles externes + 4 assertions de comportement internes | 296,767 s | 4 | 5 783 | 1 |

Le deuxième essai a révélé un défaut d’intégration : le validateur externe ne
capture pas le scénario supplémentaire proposé par le modèle. Le runtime
confondait cette absence d’observation avec un élément DOM manquant. L’arrêt
manuel a évité des réparations inutiles. La capture complémentaire séparée et
un test de non-régression corrigent cette cause ; le troisième essai valide
réellement le texte et ARIA dans les deux états des onglets.

Le troisième essai est plus lent, pas plus rapide : 266,827 s avant le premier
fichier préparé, principalement à cause d’un gros document JSON échappé tronqué,
d’une continuation invalide puis d’une génération réparée. Le dernier correctif
sépare le document HTML complet et le petit contrat JSON. Ses tests de sécurité
et de reprise passent, mais **son gain avec Ornith n’a pas encore été mesuré**.

Rapports sources (répertoire local `~/Library/Application Support/Solar/benchmarks/`) :

- `2026-10-15T20-12-31-154Z-fed58445/BENCHMARK_REPORT.md`
- `2026-10-15T20-20-57-576Z-37b5469e/BENCHMARK_REPORT.md`
- `2026-10-15T20-59-35-709Z-318901bf/BENCHMARK_REPORT.md`

L’essai Ornith d’animation envisagé n’a pas été exécuté. Les transitions sont
validées par les tests déterministes WebKit, pas par une nouvelle génération
réelle d’animation. Aucun nouveau score 25/25 n’est disponible. La précédente
mesure V3.3.2 de `ui-tabs` (91,506 s) ne démontre aucun gain de vitesse V4.

## Limites

- Aucun gain ×10 ni rapprochement mesuré avec un modèle frontier n’est établi.
- Un profil utilisant un identifiant arbitraire 30B est testé avec un backend
  simulé ; aucun modèle 30B réel n’est téléchargé ou benchmarké.
- La fenêtre reste conservatrice (4K/8K, bornée par les capacités déclarées).
  L’utilisation automatique de 12K+ nécessite des mesures matérielles séparées.
- Swift/Rust n’ont pas la même richesse d’édition AST que JS/TS. Les nouveaux
  fichiers restent soumis aux protections et dossiers autorisés existants.
- Les horloges JavaScript arbitraires ne sont pas virtualisées. Les assertions
  asynchrones sont observées après le délai natif existant ; une capture ne
  représente pas tous les états possibles d’une application.
- Les auto-tests du modèle sont figés mais ne constituent pas un oracle
  indépendant de compréhension. Ils complètent les validateurs externes.
- Les critiques vision sont indicatives ; elles ne certifient pas une qualité
  esthétique. La différence pixel est une mesure, pas un score de design.
- Les transactions ajoutées portent sur les propositions en mémoire. Le pont
  d’écriture approuvé existant conserve ses propres protections et limites.
- Les journaux de générations comptent les appels de runtime tentés ; un repli
  HTTP interne peut effectuer une tentative de transport supplémentaire.

Les offres commerciales, la spécialisation des poids et l’ajout d’autres LLM
restent hors périmètre. Aucun push ni installation de DMG dans cette mission.
