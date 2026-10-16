# Cortex V4 — moteur indépendant du modèle

## Décision produit

Le moteur accompagne le modèle choisi par l’utilisateur. Aucune spécialisation
de poids, aucun entraînement réservé à Solar 9B et aucune nouvelle dépendance à
un fournisseur ne sont prévus dans ce chantier. Ornith 1.5 9B reste un modèle de
comparaison utile, pas une condition d’accès aux bénéfices de Cortex.

Les offres commerciales sont hors périmètre. Annulation, vérification des
sources, approbation des propositions et détection de stagnation restent actives.

## Phase 1 — récupérer les ressources perdues

Premier lot réalisé :

- Transaction isolée par tour, y compris plusieurs fichiers. Un échec de
  staging ou du service de vérification restaure la proposition précédente.
- Sources existantes recontrôlées après staging et avant remise d’une
  proposition vérifiée ; aucune écriture disque automatique ajoutée.
- Erreurs de syntaxe bloquant compilation/rendu coûteux jusqu’à correction.
- Fichiers issus du diagnostic et des dernières actions prioritaires dans le
  contexte suivant, avec lecture de leur version réellement préparée.
- Compactage par blocs de sources explicites, sans suppression arbitraire du
  milieu de l’objectif ou des diagnostics. Les sources omises sont signalées.
  Si les informations indispensables ne tiennent pas, la tâche est suspendue.
- Repli vers le JSON conservé pour la tâche après un échec observé du transport
  d’outils. Aucune règle fondée sur un nom de modèle.
- Compteurs de vérifications exécutées, portes de syntaxe, opérations rejetées,
  transactions restaurées et estimation du contexte dans les checkpoints.

À mesurer avant généralisation : répétitions Native/Cortex avec le même modèle,
paramètres et validateurs indépendants ; taux de réussite, temps, tokens,
réparations, actions rejetées, erreurs de contexte et interventions humaines.
Les comparaisons doivent inclure des tâches inédites. Un seul succès ne valide
pas la phase entière ; aucune promesse de gain ×10 n’est fondée à ce stade.

## Phase 2 — capacités intégrées dans Cortex 4.0.0

1. Profil de capacités observées par modèle et configuration : outils,
   qualité des éditions, vision, contexte et mémoire effectivement utilisables.
   Distinguer capacités déclarées et capacités vérifiées ; invalider le profil
   quand le modèle ou le backend change.
2. Critères de réussite techniques, fonctionnels et visuels indépendants de la
   génération ; déclarer explicitement une vérification indisponible.
3. Graphe de tâches persistantes avec dépendances, critères par nœud et
   invalidation ciblée après modification. Ne pas faire réexécuter les étapes
   dont les preuves restent valides.
4. Boucle visuelle localisée : scénario utilisateur, DOM, captures et instants
   mesurés, composant responsable, correction puis nouvelle observation.
5. Recherche de solutions séquentielle et pilotée par les preuves ; conserver
   la meilleure candidate et essayer des hypothèses distinctes seulement si
   une difficulté ou une amélioration mesurable le justifie.
6. Mémoire d’expérience compacte entre tâches : provenance, versions des
   fichiers et conditions d’invalidation. Ne pas transformer une ancienne
   réussite en vérité permanente.

Ces six fondations sont reliées au runtime, et non seulement déclarées :

- `adaptive.ts` : profil lié au modèle, endpoint, identité et fenêtre réelle,
  observations d’éditions et transport, repli JSON et taille des tours adaptés.
  Les profils sont persistants par compte, avec invalidation par configuration.
  Le contexte annoncé par Ollama borne la fenêtre configurée ; une grande
  fenêtre théorique n’est pas activée automatiquement sans preuve matérielle.
- `semantic.ts` et `transaction.ts` : plages AST exactes JS/TS/TSX, rejet des
  symboles ambigus, normalisation gardée des empreintes et transactions isolées.
- `task-graph.ts` : plan structuré automatique pour les projets complexes,
  dépendances acycliques, critères par étape, empreintes et invalidation
  transitive. Les tâches courtes gardent le chemin direct. La reprise revalide
  les propositions avant une nouvelle génération.
- `behavior.ts` et WebKit : assertions après chaque clic/saisie (texte,
  visibilité, valeur et attributs), cibles CSS supplémentaires, scénario figé,
  priorité des assertions externes et observations géométriques localisées.
  La vision du modèle reçoit aussi les erreurs mesurées et alimente les
  corrections ; son avis ne remplace jamais un validateur indépendant.
- `search.ts` : conservation de la meilleure proposition, comparaison de
  contraintes réelles, réinspection automatique puis approches alternatives
  séquentielles. Répéter une action rejetée ne produit pas une preuve de progrès.
  Les candidates conservées en mémoire sont bornées sans plafonner la durée
  totale d’une tâche qui progresse.
- `learning.ts` : expérience liée à la version des fichiers et manifestes,
  provenance et réparation utile ; la mémoire correspond à la proposition
  effectivement retenue. Une expérience non applicable n’est pas injectée.

Le routage visuel ne confond plus « puis » avec « UI » ni une déclaration
`interface User` TypeScript avec une interface graphique. Les lectures ciblées
restent présentes au tour suivant et leurs empreintes sont recontrôlées.

## Validation du premier lot

Les tests déterministes couvrent annulation d’un tour multi-fichier, conflit
concurrent pendant une vérification réussie, panne temporaire du vérificateur,
suppression des captures sur syntaxe invalide, priorité du fichier défectueux,
conservation du diagnostic pendant compactage et repli des outils avec un
modèle arbitraire. Les anciens contrats et vérifications WebKit sont réexécutés.

Les tests V4 ajoutent le graphe automatique, sa reprise/invalidation, les plages
AST, les profils par compte, les lectures ciblées, la mémoire périmée et de
vrais clics WebKit avec assertions après chaque action. Le bilan des mesures
Ollama ciblées est consigné dans `CORTEX_V4_VALIDATION.md` après leur exécution.
Le score global des 25 exercices et un modèle 30B réel restent à mesurer.

La transaction porte sur les propositions Cortex en mémoire ; l’écriture
approuvée sur disque reste gérée par le pont Projet existant. La présence d’un
nouveau fichier concurrent dépend encore de la fraîcheur de l’index du projet.
Swift/Rust conservent une navigation/représentation plus limitée que l’AST
JS/TS. Les horloges JavaScript arbitraires ne sont pas virtualisées. Un scénario
proposé par le modèle est un auto-test supplémentaire, pas une preuve que la
demande entière a été comprise. Les validateurs externes restent prioritaires.
