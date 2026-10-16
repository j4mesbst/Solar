# Stabilisation avant V5 — changements réels

16 octobre 2026. Branche existante conservée avec V4.1 et les modifications utilisateur. Aucun commit, push, DMG, téléchargement ou génération réelle. Les changements du runner Solar Bench apparus en parallèle sont hors de ce lot.

## A — Context Engine

- `src/lib/cortex/context-engine.ts` : paquet en cinq catégories, état structuré, projection déterministe, déduplication et métadonnées de sélection. Les obligations restent entières ; le dernier diagnostic utile conserve un extrait exact et son original référencé.
- `budget.ts`, `context.ts`, `agent/context.ts`, `cortexBackend.ts` : politique commune de sélection et de fitting ; suppression des deux coupes finales redondantes des sources, mesure du texte sérialisé et de ses octets. Les réserves restent explicites et estimées.
- `runtime.ts`, `prompt.ts` : retrait de l’architecture, des citations conversationnelles et de la mémoire du système stable ; suppression des copies de diagnostics dans plusieurs prompts. Les briefings visuels complets ne sont plus réinjectés à chaque réparation.
- `App.tsx` : le budget conversationnel legacy et ses résumés de réponses assistant ne sont plus calculés/injectés en parallèle pour Cortex ; le chemin cloud existant les conserve. Cortex utilise ses contraintes source-linked et sa mémoire vérifiée.
- En fenêtre 4K, schéma limité aux outils sûrs de lecture par plage/récupération et d’édition, sans augmenter la fenêtre ou les budgets. Les suggestions DOM utilisent un contrat séparé, évitant de payer leur grammaire dans chaque tour d’édition.

## B — Context Recovery

- `contextArchive` persiste les observations originales avec ID, empreinte, origine, état et sources. `readContext` récupère une plage exacte ; aucune sortie approximative substituée.
- `agent/types.ts`, `actions.ts`, runtime : schéma/parser/portée du nouvel outil de relecture ; références manquantes ou altérées suspendent la tâche. Données récupérées nécessaires conservées pendant la sélection.
- `conversation.ts` : déduplication exacte et remplacement explicite par IDs lorsqu’il est fourni par un utilisateur/appelant ; contraintes conservées dans le checkpoint puis restaurées même si la requête de reprise ne les renvoie pas.

## C — Repair Intelligence

- `repair.ts` : classification séparée du type d’échec et décision de génération fondée sur sources, observations, récupération et méthode.
- Re-test sans changement : résultat déjà obtenu, puis schéma ciblé sans nouveau re-test automatique. Répétition sans information/méthode nouvelle : pause honnête, meilleure proposition conservée.
- Erreur temporaire du vérificateur : nouvel essai technique, sans nouvel appel modèle. Erreur persistante d’un outil ou de WebKit : proposition conservée et non livrée comme vérifiée. Scénario suggéré non observable : conseil indisponible, aucun affaiblissement des contrôles indépendants.

## D — Visuel et édition

- `src-tauri/src/cortex-render.swift` : cibles et assertions attendues conditionnellement jusqu’à observation ou garde locale de 1,2 s, polling 16 ms ; abandon de l’hypothèse « React a fini après 40 ms ». Origines temporelles séparées et reduced-motion conservés. Les échecs restent observés, sans DOM/animation artificiels.
- `behavior.ts` : un élément absent peut prouver une absence attendue, mais jamais un style calculé demandé simultanément. Cas négatif ajouté, sans assouplir un validateur indépendant.
- `agent/atomic.ts` : lecture hors fichier refusée, taille du fichier annoncée et coupure explicite ; lecture renvoyant exactement le même contenu ne constitue plus une information nouvelle.
- `agent/actions.ts` : symbole ambigu/sans offsets → diagnostic avec empreinte et repli réel `readFileRange`/`replaceRange`, aucune sélection arbitraire. Lots cohérents et source guards conservés.

## E — Plan, mémoire et durabilité

- `task-graph.ts` : preuves requalifiées lors de changement de conditions/version de contrôles ou d’un nouveau défaut pertinent ; dépendants invalidés et nœuds toujours valables conservés. Critères métier faibles restent une limite.
- `learning.ts`, `cortexNative.ts`, `CortexServices`, connexion dans App : mémoire historique filtrée aussi par identité du modèle et environnement connu. Anciens items sans identité ne sont pas récupérés dans le chemin de production qui fournit cette identité.
- `runtime.ts` : sources/dépendances et environnement observables comparés avant/après vérification ; changement concurrent → verdict incertain et pause, sans mise en cache ni mémoire de réussite.
- Journal : raison d’appel, sélection/compactage/récupération, taille sérialisée, mesures absentes distinguées, actions proposées par type/chemin sans code brut. Une édition refusée ne transforme plus un JSON valide en erreur de parsing.
- Une erreur de fitting avant l’invocation du fournisseur ne compte plus comme génération. Le journal distingue la tentative de préparation et l’invocation du backend ; les retries internes éventuels du transport restent identifiés séparément.
- `chatApi.ts`, `domain/extensions.ts` : `decodeMs`, compte de cache seulement reçu, durées absentes non remplacées par zéro. Aucune métrique réelle d’Ornith revendiquée.

## F — Validation et limites

Deux suites ajoutées : `scripts/cortex-pre-v5.test.mjs` et `scripts/cortex-pre-v5-webkit.test.mjs`. Contrats unitaires précédents adaptés à la projection structurée et au nouvel essai du vérificateur sans régénération ; fixtures et validateurs indépendants non édités par cette mission. Voir [validation](CORTEX_PRE_V5_VALIDATION.md).

Les six fondations V4 restent intégrées. Aucune refonte visuelle, règle spécifique à Ornith/aux fixtures ou autorisation élargie. La sandbox OS, l’atomicité disque durable, les politiques d’index/chemins et la compréhension sémantique de longues contraintes restent ouvertes : [limites](CORTEX_PRE_V5_REMAINING_ISSUES.md). L’effet sur la vitesse/qualité reste à mesurer : [hypothèses](CORTEX_PRE_V5_PERFORMANCE_HYPOTHESES.md).
