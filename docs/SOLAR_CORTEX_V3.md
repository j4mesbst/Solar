# Solar Cortex V3

Solar Cortex V3 est le runtime local de Solar Code pour `ornith-1.5:9b`.
Il reste hors ligne, ne télécharge aucun autre modèle et conserve la règle
fondamentale de Solar : une modification réelle reste une proposition tant que
l’utilisateur ne l’a pas approuvée dans le panneau Projet.

## Chemin d’exécution réel

`Intent → contexte → action structurée → copie isolée → vérification →
réparation ou proposition`.

- Les actions admises sont petites et validées : lecture/recherche, patch,
  création, remplacement total, `replaceSymbol`, contrôles autorisés et rendu
  HTML isolé. Les commandes du modèle ne sont jamais exécutées.
- Une tâche qui demande du code ne peut pas être terminée sans modification.
  Une proposition n’est `verified` que si elle contient des changements et que
  chaque contrôle requis a réellement réussi. Sinon elle est explicitement
  `completed_unverified` ou `paused` ; elle n’alimente pas la mémoire Cortex.
- Les appels sont bornés par mode, par durée, par répétition du même échec et
  par tentatives de réparation. Une réponse JSON coupée est continuée avant
  d’être interprétée.
- `createFile` sur un fichier existant est normalisé en `replaceFile` seulement
  pour une proposition non vide, explicite et toujours soumise à approbation.
  Sinon le modèle reçoit un diagnostic ciblé. Les signatures de changements et
  d’échec stoppent les répétitions sans progrès.

## Édition et contexte

`replaceSymbol` remplace une déclaration unique dans une copie mise en scène.
Il vérifie le chemin, l’unicité du symbole, une éventuelle empreinte de source,
la taille, puis laisse les vérifications TypeScript/Rust/Swift et les tests
confirmer la proposition. C’est actuellement un extracteur structurel
conservateur par expressions régulières pour TypeScript, JavaScript, TSX/JSX,
Rust et Swift : Tree-sitter n’est pas ajouté comme dépendance. Un symbole
ambigu ou absent échoue sans réécriture totale automatique.

La RepoMap met en cache par projet et hash de contenu les imports locaux,
signatures et dépendances des fichiers pertinents. Elle est compacte et
déterministe ; elle guide la sélection mais ne remplace jamais la lecture du
code. Les invites séparent un préfixe stable (système, architecture, contrat)
du tour mutable (objectif, erreurs, changements et prochaine action) afin de
permettre le cache KV d’Ollama sans promettre un taux de cache non mesuré.

## Vérification, UI et animation

- Les erreurs de build/test sont conservées intégralement dans les contrôles.
  Le modèle reçoit en priorité fichier, ligne/colonne et cause utile.
- Les changements sont vérifiés dans une copie de travail par le service Rust,
  sans écrire le projet de l’utilisateur.
- Les HTML autonomes sont rendus par WebKit dans une fenêtre isolée avec CSP.
  Cortex recueille positions, tailles, overflow, collisions de contrôles,
  texte tronqué et préférence de mouvement réduit. Chaque échantillon WAAPI
  pause les animations, fixe le temps puis demande une frame au compositeur
  avant la capture. Les minuteries JavaScript arbitraires ne sont pas
  virtualisées ; cette limite est signalée dans les résultats.
- Avant une génération visuelle, Cortex compose un brief compact et déterministe
  (layout, composants, responsive, mouvement, référence et contrôles). Il ne
  consomme pas une génération de plan supplémentaire et ne modifie pas le
  design global de Solar.
- Si Ornith expose réellement la vision dans Ollama, les captures WebKit et la
  référence sont examinées par ce même modèle. Les constats structurés
  rejoignent la boucle de réparation ; aucune note esthétique n’est inventée.

## Mémoire et amélioration contrôlée

Seules les trajectoires terminées et vérifiées sont enregistrées localement.
Leur récupération est isolée par workspace et redigée avant réinjection.
Les stratégies déduites ne sont activables qu’après benchmark apparié sans
régression (`mayPromoteStrategy`) ; aucun entraînement, LoRA ou envoi distant
n’est effectué.

## Évaluation

`scripts/cortex-benchmark.mjs` compare Ornith brut à Cortex V3 sur les
fixtures code, refactor, interface et animation. Il enregistre générations,
temps, mémoire runner, modèle chargé, contrôles et résultats de rendu dans le
chemin défini par `SOLAR_BENCHMARK_OUTPUT`. Le benchmark V2 reste une référence
historique : une comparaison V2/V3 n’est écrite que si le binaire V2 figé est
réellement disponible. Les limitations et l’état exact de la campagne sont
conservés dans `output/cortex/v3-evaluation/`.
