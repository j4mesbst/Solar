# Cortex 4.1 — stabilisation du moteur

16 octobre 2026. Branche locale `codex/cortex-v4.1-stabilization`, base `44fe889`. Changements non commités, aucun push, DMG, téléchargement ou appel au modèle réel. Les neuf fichiers déjà modifiés au départ ont été préservés. Ce document décrit des changements de mécanismes testés, pas un gain de performance avec Ornith.

## A — Provenance et scénarios

- `types.ts`, `experience.ts`, `evidence.ts`, `search.ts` : origine explicite des contrôles (utilisateur, indépendant, déterministe, suggestion modèle, conseil vision), identité d’expérience avec empreintes/dépendances, paramètres, moteur/version et environnement. Les identités legacy dupliquées sans conditions sont conservées mais marquées non comparables : elles ne déclenchent plus une fausse régression par homonymie. Les verdicts indépendants ne sont pas modifiés.
- `agent/visual-validation.ts`, `behavior.ts`, Swift et Rust : schéma discriminé click/fill, `value` interdit sur click et obligatoire sur fill. Texte, valeur, visibilité, attribut exact, présence d’attribut booléen et style calculé ont des sémantiques distinctes. `open=""` est testé avec `present:true`, pas converti en chaîne true. Fill refuse une cible non éditable.
- `runtime.verify` : les validations DOM proposées sur une tâche non visuelle sont hors portée. Une suggestion mal formée n’annule pas les actions de fichier valables. Les auto-tests restent des diagnostics non indépendants : leur échec ou indisponibilité ne suffit pas à rejeter la proposition. Un vrai défaut du contrôle indépendant ou du scénario utilisateur reste bloquant. Les suggestions ne modifient ni la suite indépendante ni son rendu de référence.
- Pour HTML, chaque transition d’un scénario multiple est capturée dans une page distincte sur le préfixe d’actions correspondant. Les captures complémentaires ne remplacent plus le rapport indépendant. Pour les actions de précondition seulement, WebKit peut avancer les animations WAAPI **déjà produites par la page** à leur fin réelle avant le prochain déclencheur ; aucun style ni animation de secours n’est injecté. La transition finale est échantillonnée depuis zéro. Ce n’est pas une virtualisation des horloges JavaScript.

## B — Édition cohérente

- `runtime` : une action inerte devient une information ; le delta et la garde CSS sont évalués sur le lot entier. Une correction DOM suivie de CSS peut être vérifiée. Une action essentielle invalide restaure tout le lot et ses métadonnées de proposition : scénario, candidate, preuves, diagnostic, stratégie, branche et lectures. Compteurs d’observation conservés séparément.
- `semantic.ts` : offsets AST pour affectations CommonJS indépendantes et propriétés d’exports objet non calculées, seulement quand la plage est sûre. Les symboles sans offsets sont annoncés en lecture seule ; plages gardées restent disponibles. Les ambiguïtés et modifications concurrentes sont toujours refusées.
- `module-resolution.ts`, vérification et RepoMap : require suit les extensions implicites Node CJS, pas `.cjs` automatiquement ; ESM explicite et bundler ont des règles distinctes. Diagnostic avec importeur, spécificateur et tentatives. La résolution complète package exports/main/alias reste hors de ce lot.
- `adaptive.ts` : compteurs parsing/transport/outil/conflit/sémantique/code séparés. Les anciens rejets mélangés ne décident plus de réduire une transaction à une action. Prompt et schéma annoncent un lot cohérent de deux actions maximum ; budgets globaux non augmentés.

## C — Progrès et réutilisation

- `verification-cache.ts` : cache limité à la tâche, empreintes SHA-256 de tous les fichiers sûrs lisibles de l’index et des propositions, plus configuration de vérification. Une dépendance, source, scénario, viewport, préférence de mouvement, référence ou identité d’environnement différente invalide la réutilisation. Lecture incertaine ou SHA-256 indisponible : pas de cache.
- Les résultats indisponibles nécessaires et les vérifications interrompues ne sont pas mis en cache. Un re-test identique restitue ses contrôles/provenance sans recompiler ni recapturer. Les conditions externes non exposées par l’adaptateur restent une limite documentée.
- Les lectures ciblées ne désactivent plus automatiquement la demande de progrès. Une nouvelle plage peut fournir une information ; une lecture exactement identique est refusée. Les signatures de stagnation ne sont plus réinitialisées par un simple changement de branche.

## D — Contrats et contexte

- `agent/schema.ts` : validation locale du schéma effectivement choisi, avant staging. Les mauvaises familles d’actions/champs ne sont pas converties silencieusement. Le diagnostic est facultatif afin de ne pas imposer une responsabilité supplémentaire inutile au petit modèle. Les restrictions après conflit restent spécifiques au fichier, pas à tout le lot.
- `structured.ts` : dans le protocole autorisé d’un unique fichier HTML identifié, document fermé accepté sans fence finale ; fragment ou autre chemin refusé. Le contenu passe encore par les gardes et vérifications habituelles. Ce n’est pas un parseur HTML de conformité exhaustive.
- `budget.ts`, backend, sélecteur : estimation conservatrice commune, fondée sur le texte sérialisé et les réserves de schéma/outils/images/sortie ; compactage explicite des blocs source. Aucun tokenizer exact ni coût multimodal réel n’est revendiqué. Le système Cortex n’hérite plus de consignes conversationnelles Markdown contradictoires ajoutées par le transport.
- Le snapshot de conflit numéroté n’apparaît qu’une fois dans un bloc compactable. Les extraits et dépendances coupés sont marqués. Dernier diagnostic prioritaire, plus de coupe aveugle de guidance à1400 caractères.
- `conversation.ts`, App : exigences antérieures liées aux IDs de messages utilisateur, dédupliquées et réellement transmises. L’objectif courant reste entier. Une histoire obligatoire trop volumineuse peut encore provoquer une pause explicite plutôt qu’une amnésie silencieuse ; résumé sémantique compact non implémenté.

## E/F — Reprise, mémoire et frontières

- Journal de64 appels : rôle, schéma/empreintes, phases, durée, arrêt/annulation, caractère mesuré ou non des tokens et résultat de parsing. Pas de texte brut du modèle dans actionTrace par défaut, pas de chaîne de raisonnement. Les checkpoints nécessaires à la reprise conservent encore les sources/prompts : pas de promesse de suppression globale des données sensibles.
- Reprise : branche conservée, anciennes preuves de meilleure candidate invalidées avant usage, scénario revalidé, inspection persistée et changement d’identité modèle/endpoint refusé. Livraison de proposition enregistrée pending avant completed, puis delivered après le callback. Aucun droit d’écriture physique supplémentaire.
- Mémoire : conseil historique explicitement nommé, version du moteur et empreintes des dépendances observées requises ; SHA-256 réutilisé avec le bon algorithme. Les versions exactes de tous les outils/validateurs et dépendances hors index ne sont pas encore attestées.
- Consentement de dossier : ancien booléen global non réutilisé ; portée compte + workspace + fournisseur/endpoint. Le dossier natif reste une configuration de l’application, pas une frontière d’identité système.
- Ancien branchement AgentRuntime inatteignable retiré de l’UI ; modules réutilisables et six fondations Cortex conservés. Critère DAG `file` explicitement décrit comme preuve de présence, pas de réussite métier.

## Limites majeures conservées

La copie n’est **pas une sandbox système** ; exécution non fiable sans isolation OS : **NON TRAITÉ — blocage**. Consentements, fichiers protégés, gardes de source, refus d’ambiguïté et approbation physique maintenus. Pas de transaction durable multi-fichier sur disque ; undo encore en RAM. Index, politiques de chemins, package resolution avancée et capture de transitions multiples React sans adaptateur dédié restent incomplets. Aucun clavier/scroll/navigation distante/horloge JS virtuelle ajouté. Aucun progrès scientifique du DAG, mémoire, esthétique ou performance multi-modèle démontré.

Voir [couverture C4](CORTEX_V4_1_AUDIT_COVERAGE.md), [validation](CORTEX_V4_1_VALIDATION.md) et [plan d’évaluation non lancé](CORTEX_V4_1_FINAL_BENCHMARK_PLAN.md).
