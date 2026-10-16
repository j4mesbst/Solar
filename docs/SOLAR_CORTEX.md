# Solar Cortex — état de l’implémentation

Cortex est un moteur logiciel autour du modèle local `ornith-1.5:9b`, pas un nouveau modèle ni une API externe. Il est intégré à Solar Code pour ce modèle précis. Le chat normal reste conversationnel; les autres modèles et fournisseurs conservent leurs parcours.

## Installation et migration

Dans Paramètres → Modèles, Télécharger affiche un bloc sélectionnable/copirable :

```sh
ollama pull ornith-1.5:9b
```

La commande utilise la distribution officielle Q4_K_M avec son projecteur d’images (environ 6,6 Go). Le nom public reste Solar 9B; la licence MIT et l’attribution Ornith AI sont conservées. Actualiser relance réellement la découverte et recharge le catalogue.

L’ancien Ornith 1.0 est identifié comme ancien et n’est jamais supprimé. Le téléchargement intégré reste proposé. Il vérifie une génération avant de remplacer un ancien modèle par le nouveau dans le choix par défaut. Les conversations existantes gardent leur choix explicite. Une installation par Terminal est découverte au rafraîchissement; l’utilisateur choisit ensuite Solar 9B pour une nouvelle conversation. Aucun chat template ni token spécial n’est réécrit : Ollama utilise les métadonnées officielles du modèle. `/api/show` sert à découvrir les capacités réelles avant de démarrer Cortex.

Sources vérifiées : [Ollama](https://ollama.com/library/ornith-1.5:9b), [modèle Ornith](https://huggingface.co/ornith-ai/Ornith-1.5-9B), [GGUF](https://huggingface.co/ornith-ai/Ornith-1.5-9B-GGUF).

## Parcours opérationnel

1. Ouvrir Solar Code, sélectionner Solar 9B et un projet.
2. Choisir l’effort existant : Faible → Fast, Moyen → Balanced, Élevé → Deep, Ultra → Ultra. Une question simple utilise Fast.
3. Cortex sélectionne des fichiers, suit leurs imports locaux et prépare un contexte borné. Les fichiers cochés servent de priorité.
4. Le modèle propose des actions structurées. L’exécuteur contrôle chaque chemin et chaque patch. Les appels d’outils natifs et les sorties JSON passent par le même validateur.
5. Les changements restent dans une copie virtuelle. Les compilations/tests autorisés sont exécutés sur une copie temporaire du projet.
6. Les erreurs alimentent des réparations ciblées. `stop` ne signifie pas « tâche terminée »; une sortie tronquée est continuée, une boucle sans progrès est suspendue.
7. Les changements vérifiés sont présentés dans le panneau Projet. L’approbation/écriture/annulation déjà présentes dans Solar restent nécessaires.
8. Une tâche suspendue, annulée ou interrompue à la fermeture peut être reprise. Le projet, le modèle et les versions d’origine des fichiers sont contrôlés à la reprise.

Les étapes affichées proviennent des opérations réellement lancées. Une vérification absente porte le statut « Non effectué » et ne compte jamais comme réussie. La réussite technique d’une proposition ne prouve pas automatiquement toutes ses qualités sémantiques ou esthétiques; les contrôles disponibles et leurs limites sont visibles dans le rapport.

## Modules et maturité

| Technologie | État réel |
| --- | --- |
| Persistent Agent Runtime | Boucle bornée, état partagé, checkpoints locaux, continuation, annulation et reprise intégrés. |
| Adaptive Test-Time Compute / Confidence Router | Heuristiques selon la tâche, les fichiers et la mémoire; pas de probabilité de réussite annoncée. |
| Context Engine / Repository Graph | Index de chemins, symboles/imports/appels analysés sur les fichiers lus, dépendances locales et invalidation par contenu. Ce n’est pas un index sémantique exhaustif du dépôt. |
| Structured Tool Calling | Lecture, recherche, patch, création, remplacement, checks identifiés et rendu HTML. Aucun shell fourni par le modèle. |
| Build → Test → Repair | Npm build/test, TypeScript lorsque le projet le permet, Cargo offline et Swift typecheck. Boucle de réparation testée. |
| Candidate Search / Value Search | Candidats séquentiels isolés, classement par vérifications et coût des changements. Heuristique non calibrée. |
| Render → Judge → Repair | Captures WebKit réelles de HTML autonome; rendu des builds Vite/React produisant `dist/index.html`. Les problèmes observés alimentent la réparation. |
| Temporal Vision | 5–12 captures possibles, sept instants par défaut pour une animation; mesures géométrie/opacité/transformation/filtre. Timeline CSS/Web Animations figée. |
| Visual Reward initial | Débordements, erreurs JavaScript et écart pixel à une référence. L’avis visuel d’Ornith peut être ajouté si le backend déclare la vision. Aucun score esthétique appris/calibré. |
| Adaptive Verifier Ensemble | Syntaxe/imports, contraintes exécutables, compilation/tests et rendu selon le type de tâche. |
| Trajectory Memory | Résumés de tâches techniquement vérifiées, récupération ciblée dans le même projet, activation explicite par compte et suppression. |
| Evolution | Contrats versionnés, promotion conditionnée à des mesures appariées sans régression et rollback. Pas de recherche/activation autonome de stratégies en production. |
| Distillation | Extraction de règles candidates à partir de plusieurs trajectoires. Elles demandent une évaluation; aucune règle n’est automatiquement promue. |
| Self-Improvement Dataset | Construction d’exemples vérifiés avec consentement séparé et filtrage de secrets/e-mails. Aucune collecte automatique ni entraînement. Le filtre n’offre pas une anonymisation garantie. |
| Expert LoRA | Contrat d’adapter validé et routeur avec fallback. Aucun adapter entraîné ni chargement dynamique Ollama validé; infrastructure seulement. |

## Limites d’exécution

- Une génération se fait avec un seul modèle. Les candidats sont séquentiels et ne chargent pas de poids supplémentaires.
- Fenêtre Cortex initiale : 4 096 tokens en mémoire limitée, sinon 8 192. Estimation conservatrice par caractères, pas tokenizer exact. Les sorties et instructions ont une réserve; un contexte trop long est compacté. Les métriques Ollama de chargement/prétraitement/génération restent distinctes.
- Conservation du modèle pendant la tâche : 5 minutes, même si le profil global Éco libère les modèles entre les conversations. Aucun réglage 256K automatique.
- 8/20/40 étapes selon le mode, jusqu’à quatre candidats, cinq corrections par problème, détection de répétitions et limite de temps. La reprise accorde une nouvelle tranche bornée.
- Node/npm et les dépendances du projet doivent déjà être installés; Cargo utilise le cache offline. La capture WebKit/Swift nécessite les outils de développement macOS. Pas d’installation silencieuse de toolchain.
- L’exécution de scripts de projet demande une autorisation native pour la tâche. La copie protège les fichiers source contre les modifications ordinaires, mais **ce n’est pas un bac à sable macOS** : les scripts ont les permissions de l’utilisateur, et les dépendances Node existantes sont partagées. Les projets doivent être de confiance.
- Les scripts npm modifiés dans une proposition ne sont pas exécutés par Cortex; leur examen/approbation doit être effectué séparément. Un test natif vérifie ce refus.
- Rendu automatique initial : HTML autonome et builds web `dist/index.html`; pas d’aperçu SwiftUI/Xcode universel. Les services indisponibles sont signalés. Les timings `requestAnimationFrame`, timers JS arbitraires, événements utilisateur et interactions complexes ne sont pas virtualisés.
- Les contraintes métier doivent être couvertes par des tests ou des critères exécutables fournis. Une analyse syntaxique et une auto-évaluation du modèle ne constituent pas une preuve universelle de conformité.

## Persistance et confidentialité

Les checkpoints sont nécessaires à la reprise et restent locaux, dans le stockage du compte, avec les instructions, extraits, propositions et référence éventuelle. Ils sont supprimés avec la conversation. Les chats temporaires utilisent uniquement la mémoire. La conservation est bornée à 40 tâches et environ 24 Mo (la dernière tâche est conservée).

La mémoire d’expérience est désactivée par défaut, activable dans Performance, bornée à 100 résumés et effaçable séparément. Elle n’active pas la collecte pour entraînement. Les clés API et le contenu privé réel ne font pas partie des fixtures ou des commits. Cortex ne modifie jamais automatiquement le code exécutable de Solar à partir d’une stratégie générée.

## Chat normal corrigé

Les salutations complètes utilisent une seule requête courte, sans Skills, planification, Web ni anciens livrables. Le routeur ne réactive le contexte ancien que pour une continuation explicite. L’historique ordinaire est borné; une question telle que « Pourquoi ? » conserve ses échanges utiles. Les titres/labels locaux n’ajoutent plus de générations LLM concurrentes. Le rendu Markdown conserve ses clés stables et réinitialise correctement son identifiant de frame lors d’un démontage React.

## Vérification reproductible

```sh
npm run test:cortex
npm run test:cortex:render
npm run test:agent
npm run test:chat
npm run test:skills
npm run test:solar-ai
npm run test:providers
npm run test:pipeline
npm run test:features
cargo test --manifest-path src-tauri/Cargo.toml --lib
SOLAR_UI_NODE_MODULES="$PWD/node_modules" npm run test:ui:cortex
npm run build
```

`npm run benchmark:cortex` compare une génération brute et Cortex sur huit fixtures fixes : debug Swift, fonctionnalité, refactoring, UI descriptive, UI sur référence, animation simple, animation complexe et animation sur référence. Il utilise exclusivement Ornith 1.5; aucun téléchargement ni modèle de substitution. Le rapport est écrit dans `output/cortex/benchmark.json`. La collecte du pic mémoire n’est pas encore instrumentée.

## Résultats de cette livraison

## Validation V2 — 14 octobre 2026

- Le transport Ollama expose maintenant le statut HTTP et le détail JSON du serveur. Le diagnostic réel observé pendant les essais était `HTTP 500: invalid tool call arguments for "propose_actions": unexpected end of JSON input`; les demandes visuelles passent donc par une sortie JSON structurée, avec un repli contrôlé si un appel d’outil natif est mal formé.
- Les générations Cortex utilisent un signal dédié et un délai borné. Une génération trop longue est enregistrée en pause/reprise; elle ne laisse plus une requête suspendue ni une erreur non expliquée.
- Les actions Cortex sont validées par schéma discriminé et un tour qui lit sans modifier un dépôt de changement doit ensuite produire un `patchFile`, `createFile` ou `replaceFile`. Une mutation vérifiée peut clôturer la proposition sans attendre un `finish` décoratif.
- Le budget par défaut reste 8K sur ce Mac, 4K en mémoire basse; 12K n’est activé qu’après validation explicite. Les mesures Ollama distinguent temps de chargement, prétraitement, génération, tokens/s, RSS du runner et taille chargée.
- Benchmark court actuel (Ornith brut vs Cortex, quatre mesures) : Swift debug brut **échec**, Cortex **réussite** en 16,9 s / 3 générations; fonctionnalité JavaScript brut **échec**, Cortex **pause** en 34,6 s / 5 générations après absence de progrès et conflit de création de fichier. Aucun gain visuel n’est revendiqué sur ce run ciblé.
- Les tests automatisés passés après ces changements sont `test:cortex`, `test:cortex:render` (7 captures WebKit), `test:chat`, 7 tests Rust natifs et `npm run build`. Le test UI Playwright reste bloqué par la dépendance `ui-verification/node_modules/playwright` absente et l’absence de Chrome dans l’environnement.

- Contrats Cortex passés : contexte/routage, identité modèle, continuation, outils, checkpoint/reprise, isolation des candidats, réparation, annulation et garde-fous d’apprentissage.
- Tests Rust passés : chemins, écriture/undo existants, copie isolée, annulation de processus, véritable échec puis succès build/test Node et véritable capture web compilée.
- Sept vraies captures WebKit d’une animation de fixture validées avec mesures temporelles.
- Playwright : chat normal sur deux tours avec ancien hors-sujet dans l’historique, pièce jointe, commande copiée, thème clair/sombre, consentement mémoire, pause réelle en absence de service natif, petite fenêtre, clavier et mouvement réduit.
- Essai d’inférence du chat normal sur Ornith 1.0 déjà installé : réponse sociale pertinente, premier token environ 3,8 s et total environ 4,6 s sur un essai. Ce n’est pas un benchmark Cortex ni une garantie de vitesse.
- **Ornith 1.5 absent du Mac lors des essais** : le benchmark retourne `not-run`, HTTP 404, zéro mesure. Le téléchargement, le streaming/tool calling/vision de cette version et le scénario Cortex complet avec ses poids restent à vérifier après installation.
- Pas d’équivalence démontrée avec un grand modèle; pas de LoRA entraîné, de visual reward appris ou d’évolution autonome validés. Aucun DMG installé pour ce chantier.
