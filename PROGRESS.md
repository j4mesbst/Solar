# Cortex — phase 1.3, optimisation du Context Engine (16 octobre 2026)

- Diagnostic du checkpoint historique `2026-10-16T16-49-39-380Z-1e4f2e8b` : le contexte initial contenait une source courte, mais les tours de réparation conservaient également l'état complet (tous les contrôles réussis, diagnostics, références d'archive et mémoire de réparation). `fitContextPacket` ne pouvait alors évincer que les sources optionnelles. Le runtime sérialisait ce paquet déjà ajusté, puis le backend le sérialisait une seconde fois avec `call.context` ; cette duplication rendait le budget particulièrement fragile avec une image, un schéma JSON et les outils.
- Le moteur de contexte garde maintenant l'objectif, les contraintes et la prochaine action intacts, puis réduit l'état par paliers vérifiables : complet, compact (compteurs, changements récents, références récupérables, contrôles non réussis et réparation active), enfin minimal. Les résultats historiques restent dans le checkpoint et sont annoncés comme récupérables, sans reconstruction ni troncature silencieuse. Si les obligations seules dépassent réellement le budget, l'erreur `CORTEX_CONTEXT` reste explicite.
- Le runtime transmet un paquet déjà budgété au backend avec le marqueur `contextPrepared`; le transport ne réinjecte plus le même `context`. Lors d'un rejet serveur pour contexte trop long, le repli cible désormais un minimum viable de 2 400 caractères et applique la même compaction structurée, plutôt qu'un seuil de 1 000 caractères potentiellement inférieur aux seules obligations utilisateur.
- Vérifications déterministes réussies : paquet visuel surchargé avec image (contraintes conservées, contrôles réussis évacués, état compact annoncé), erreur explicite si les obligations seules sont trop longues, absence de double sérialisation au backend, Context Recovery, `readSymbol`, réparation multi-fichiers, First Artifact, `npm run test:cortex`, `npm run build` et `git diff --check`.
- Métadonnées inspectées pour `ornith-1.5:9b` : capacité annoncée 262 144 tokens, outils, réflexion et vision disponibles. Solar conserve volontairement sa fenêtre opérationnelle de 8K et ne modifie pas automatiquement `num_ctx`, afin de ne pas masquer le problème par une consommation mémoire excessive.
- Une seule campagne réelle `ui-reference` avec `ornith-1.5:9b`, snapshot isolé : **STAGNATION**, 9 min 16 s, 9 033 tokens, 7 réparations, 6 vérifications. La saturation `CORTEX_CONTEXT` ne s'est pas reproduite ; une modification de `index.html` et les contrôles WebKit, DOM `aside/nav`, débordement, largeur de sidebar et écart de référence ont réussi. Le blocage restant est distinct : après les réparations, le DOM manque toujours `textarea`, `input` et `button`; l'anti-stagnation a correctement refusé de répéter des tentatives sans progrès. Rapport et checkpoint : `/Users/James/Library/Application Support/Solar/benchmarks/2026-10-16T21-12-57-997Z-5957c127/`. Aucun second benchmark, commit ou push.

---

# Cortex — phase 1.2d, création HTML initiale (16 octobre 2026)

- Analyse du benchmark `2026-10-16T19-27-57-033Z-7e191fae` : Ornith avait reçu la consigne contradictoire de produire une interface HTML complète sans plafond de taille, mais chaque appel était limité à 2 200 tokens. Les deux générations ont donc été tronquées. Après cet échec, le schéma de réparation laissait encore `patchFile` et `replaceFile` disponibles malgré une empreinte conflictuelle ; le modèle répétait une édition périmée que le runtime rejetait à juste titre.
- Le premier artefact HTML est désormais explicitement minimal, autonome, complet, responsive et borné à 2 600 caractères, avec une sortie limitée à 1 100 tokens. Toutes les exigences structurelles restent demandées ; l’enrichissement reste piloté par une vérification indépendante ultérieure. Une continuation qui recommence un document HTML est rejetée, plutôt que concaténée au préfixe conservé.
- Après un conflit textuel, le schéma ne propose plus de patch textuel ni de remplacement intégral sur le fichier concerné. Il expose uniquement `readFileRange` et `replaceRange`, contraints au chemin, aux lignes et à l’empreinte réellement courante. Le rollback, les empreintes, l’anti-stagnation et les validateurs restent inchangés.
- Le test déterministe First Artifact couvre maintenant : création minimale validée, enrichissement après observation indépendante, sortie tronquée, continuation incomplète ou recommencée sans écriture partielle, absence d’inspections avant artefact, et refus d’un `patchFile` obsolète suivi d’une réparation atomique sur la source courante. Les suites First Artifact, Context Recovery, readSymbol et réparation multi-fichiers passent ; `npm run build` et `git diff --check` passent.
- Une seule campagne réelle `ui-description` avec `ornith-1.5:9b`, sans cache, sur snapshot isolé SHA-256 `bbe233c4b5e9cf9a3f1dac90c0b263997c006f2116863fc545280e7f7f77b3fc` : **PASS**, 75,9 s, 1 166 tokens, 2 étapes, 0 réparation. Le document final a été contrôlé par syntaxe, structure, WebKit réel, DOM (`aside/nav`, saisie, trois boutons) et absence de débordement. Rapport et checkpoint : `/Users/James/Library/Application Support/Solar/benchmarks/2026-10-16T19-43-30-579Z-e9e30c05/`. Ce résultat ciblé ne préjuge pas du score de la campagne complète. Aucun commit ni push.

---

# Cortex — phase 1.2c, First Working Artifact (16 octobre 2026)

- Le runtime conserve désormais le premier document HTML autonome arrêté par `stopReason: length` dans `pendingStandaloneHtml`, puis lance un seul tour dédié qui ne demande que son suffixe. Les deux morceaux sont reconstitués puis validés comme document complet avant toute conversion en `replaceFile`. Un suffixe incomplet ou une seconde troncature est rejeté sans écrire de fragment ; le moteur repasse alors au protocole de réparation normal avec un diagnostic explicite et borné.
- Tant qu’une tâche visuelle de création n’a produit aucune modification, les actions d’inspection/rendu (`inspectUI`, `inspectMotion`, `renderPreview`, `inspectRender`) sont retirées du schéma de réparation. La garde anti-stagnation reste active et la suppression s’applique également au repli compact. Après une mutation validée, les vérifications indépendantes restent disponibles.
- Nouveau test déterministe `scripts/cortex-first-artifact.test.mjs` : HTML tronqué puis continuation complète, continuation incomplète sans écriture partielle, absence d’inspection avant artefact et création suivie d’une vérification indépendante. Les suites First Artifact, read-symbol, Context Recovery, réparation multi-fichiers et V4.1 passent ; `npm run build` et `git diff --check` passent aussi.
- Une seule relance réelle de `ui-description` avec `ornith-1.5:9b`, sur snapshot isolé SHA-256 `e95b1d151e41fbd786d8080b501c3814bc43308b14c894cba11f82378ccf5965` : **FAIL**, 6 min 31 s, 8 400 tokens, 3 réparations et 1 vérification. Le premier HTML et sa continuation ont tous deux atteint la limite de longueur ; aucun HTML partiel n’a été appliqué. Le nouveau blocage est distinct : les réparations ultérieures émettent un `patchFile` obsolète puis refusent la correction demandée après conflit d’empreinte de `index.html`, au lieu d’utiliser l’édition atomique indiquée. Rapport et checkpoint : `/Users/James/Library/Application Support/Solar/benchmarks/2026-10-16T19-27-57-033Z-7e191fae/`. Aucun second benchmark, commit ou push.

---

# Cortex — phase 1.2, Context Recovery (16 octobre 2026)

- Le checkpoint de référence `2026-10-16T16-49-39-380Z-1e4f2e8b` confirme que le runtime proposait toujours `readContext` avec un identifiant texte libre, alors que le paquet présentait les observations sous une référence ambiguë `checkpoint:<tâche>/<ctx-id>`. La validation acceptait uniquement la forme `ctx-…`; Ornith a donc envoyé trois lots d'actions valides au niveau JSON mais inexécutables, sans récupération enregistrée, puis l'anti-stagnation a correctement arrêté la boucle.
- Le paquet expose désormais explicitement les seules observations réellement récupérables, avec identifiant exact, empreinte, statut et bornes de caractères. Les diagnostics courts, déjà présents intégralement, n'offrent plus `readContext`. Le schéma d'actions est spécialisé par tour : aucune action `readContext` sans observation tronquée récupérable, sinon une variante par identifiant exact avec bornes maximales. Une récupération complète n'est plus reproposée.
- Les erreurs distinguent référence mal formée, observation absente/introuvable, observation altérée et plage invalide. Une référence invalide conserve l'archive et permet une nouvelle proposition sûre ; une récupération valide injecte l'original attesté puis autorise la reprise de l'édition. Checkpoints, empreintes, provenance, détection de péremption, contraintes utilisateur, anti-stagnation et validateurs indépendants sont conservés.
- Nouveau test déterministe : identifiant composite invalide rejeté, identifiant exact borné dans le schéma suivant, récupération réussie, non-répétition de la récupération complète, reprise d'édition et validation indépendante. Tests Context Recovery, pré-V5, contrats agent/Cortex, V4.1, récupération de patch, refactoring multi-fichiers, isolation snapshot, build et `git diff --check` réussis.
- Une seule campagne réelle `ui-description` avec `ornith-1.5:9b`, sans cache, sur snapshot isolé SHA-256 `97223dfb95041184f965ce7a301c3898cfe89830bd7f6388484cca3130c656d1` : **FAIL**, 1 min 52 s. Le défaut Context Recovery ne réapparaît pas et aucune action `readContext` invalide n'est produite. L'échec restant est distinct : après une première sortie JSON tronquée, Ornith propose `readSymbol` avec un identifiant invalide à deux reprises ; arrêt anti-stagnation justifié. Traces : `/Users/James/Library/Application Support/Solar/benchmarks/2026-10-16T18-59-05-750Z-1e107920/`. Aucun second benchmark, commit ou push.

---

# Cortex — suivi de la réparation multi-fichiers (16 octobre 2026)

- Le checkpoint `2026-10-16T18-46-25-773Z-309e8bdc` montre une première édition à deux fichiers avec import `.cjs` erroné, une lecture utile des deux sources, puis une proposition régressive rejetée. Les fichiers de la meilleure version étaient restaurés, mais le bref diagnostic et la mémoire de réparation provenaient encore de la proposition rejetée. Les deux tentatives suivantes répétaient `readFile` sur des contenus déjà lus ; leur rejet et l'arrêt anti-stagnation étaient justifiés.
- Correction limitée au runtime : après rollback d'une régression, restauration du diagnostic et de la mémoire correspondant aux sources réellement conservées ; pour une réparation d'import dont toutes les sources ciblées ont déjà été lues intégralement, `readFile` n'est plus proposé, tandis que les éditions ciblées, la recherche et les autres outils restent possibles. Aucune modification de l'anti-stagnation, des benchmarks ou de leurs validateurs.
- Test déterministe étendu à la séquence réelle : import CommonJS invalide, lecture des deux fichiers, édition régressive et rollback, puis correction atomique de l'importeur et du module exporté sous vérification Node indépendante. Tests multi-fichiers, V4.1, réparation autonome, contrats agent, récupération de patch, isolation du snapshot, build et `git diff --check` réussis.
- Une seule relance réelle ciblée avec `ornith-1.5:9b` : **PASS**, 49 s, 4 étapes. Snapshot isolé SHA-256 `ed3ace1d74518d4811f642e565f8769d6741482930b6af48e6ef35d774a87b62`. Fichier final : `require('./format.cjs')`, export CommonJS fonctionnel, assertions Node indépendantes réussies. Rapport/traces conservés sous `/Users/James/Library/Application Support/Solar/benchmarks/2026-10-16T18-51-20-843Z-aeaf5cf9/`. Ce résultat ciblé ne mesure pas les 25 fixtures. Aucun commit ni push.

---

# Cortex — phase 1.1, refactoring multi-fichiers (16 octobre 2026)

- Le checkpoint historique `refactor-multifile` révèle deux vérifications sans édition, puis un lot modifiant `src/index.cjs` et `src/format.cjs` avec `require('./format')` ; deux vérifications identiques ont suivi. Node CommonJS ne complète pas cet import en `.cjs`. Le classificateur de réparation perdait le module cible en lisant le point de ponctuation du diagnostic et ne ciblait que l'importeur.
- La vérification signale désormais les fichiers proches non résolus et leur chemin d'import explicite ; le classificateur retient importeur et cible dans le contexte de réparation. Le schéma d'actions exclut les vérifications sans changement lorsqu'un import manque ou qu'une tâche de modification n'a produit aucune édition. Les lectures ciblées et les éditions gardées restent possibles, y compris dans un lot à deux fichiers. Empreintes, chemins autorisés, rollback et vérifications indépendantes conservés.
- Test déterministe ajouté : résolution CommonJS `.cjs`, exports, lecture des deux fichiers, lot fautif, diagnostic puis réparation atomique des deux fichiers, exécutée par Node. Les suites agent, Cortex, V4.1, réparation autonome, V3.3.2, récupération de patch et isolation des snapshots, ainsi que le build et `git diff --check`, réussissent.
- Une seule exécution Ornith `ornith-1.5:9b` de `refactor-multifile`, sur snapshot isolé SHA-256 `bb807dc81b7ee149597f8c8df312290dc05934decfe8374995927fc8f1bdd4b1` : **STAGNATION**, 46 s, aucune édition. Le modèle a émis `runCheck` deux fois aux étapes 1, 2 et 4, et a seulement lu les deux fichiers à l'étape 3. Traces conservées dans `/Users/James/Library/Application Support/Solar/benchmarks/2026-10-16T18-42-36-926Z-688e9fe9/`.
- La garde contre ces vérifications initiales inchangées a été ajoutée après cette unique mesure et validée uniquement de façon déterministe ; son effet sur Ornith reste non vérifié. Aucun autre benchmark, commit ou push.

---

# Cortex — stabilisation avancée avant V5 (16 octobre 2026)

- Moteur de contexte réellement branché au runtime et au transport : règles stables, objectif/contraintes protégés, état structuré, sources ciblées et observations historiques. Politique commune de budget, taille sérialisée/échappement JSON suivis, réserves explicites ; grammaire d’outils compacte en 4K et absence de briefing visuel complet répété lors des réparations.
- Récupération déterministe d’originaux archivés dans le checkpoint par `readContext`, avec provenance/empreinte et plage exacte ; doublons supprimés, données devenues historiques marquées, origine perdue/altérée suspendue explicitement. Contraintes persistées à la reprise ; aucune synthèse LLM nécessaire.
- Générations motivées par une source, observation ou méthode nouvelle ; repli concret après re-test inchangé. Panne temporaire du vérificateur traitée par un nouvel essai de l’outil, sans régénération du patch. Panne persistante/rendu indisponible conserve la proposition non vérifiée ; suggestion modèle indisponible reste non bloquante.
- Vérification des sources/dépendances et de l’environnement avant/après contrôle. Preuves du DAG requalifiées si conditions/versions changent, mémoire liée à l’identité réelle du modèle. Lectures hors fichier et lectures sans information nouvelle refusées ; repli sûr de symbole vers plage gardée.
- WebKit attend désormais des cibles/assertions observables avec une garde locale, plutôt qu’un délai supposé de 40 ms ; React réellement différé testé, reduced-motion et transitions séparées conservés. Journal des raisons, sélection, actions et métriques reçues amélioré, sans code brut dans les traces d’appels.

Validation : 16 suites déterministes réussies, 9 tests Rust réussis, build TypeScript/Vite réussi et contrôle Playwright existant réussi avec réponses simulées. Captures clair/sombre/petite fenêtre inspectées. Aucun appel réel de génération, mini-benchmark, campagne de 25, commit, push ou DMG. Aucune amélioration de performance revendiquée. Les modifications parallèles de Solar Bench/package.json ont été conservées et restent hors de ce lot.

Limites : sandbox OS absente, atomicité disque durable non garantie, longue histoire d’obligations distinctes encore susceptible de dépasser la fenêtre, budget de tokens estimé, outils/environnement hors index imparfaitement attestés, capture temporelle générale de projets React et monitoring RAM continus incomplets. Registre conservateur : 6 constats corrigés, 18 partiels, 2 non traités. Les six fondations V4 et les autorisations existantes sont préservées.

Livrables : [architecture](docs/CORTEX_PRE_V5_CONTEXT_ARCHITECTURE.md), [changelog](docs/CORTEX_PRE_V5_CHANGELOG.md), [validation](docs/CORTEX_PRE_V5_VALIDATION.md), [limites](docs/CORTEX_PRE_V5_REMAINING_ISSUES.md), [hypothèses à mesurer](docs/CORTEX_PRE_V5_PERFORMANCE_HYPOTHESES.md). Aucun benchmark complet avant V5, conformément à la nouvelle mission.

---

# Cortex V4.1 — stabilisation du moteur (16 octobre 2026)

## Solar Bench Quick — 16 octobre 2026

- Ajout des profils `smoke`, `quick` et `regression` au CLI Solar Bench. `smoke` reste déterministe et n’appelle pas Ollama ; `quick` utilise trois micro-fixtures existantes ; `regression` en utilise huit, sans modifier les 25 fixtures officielles.
- Toutes les campagnes Ollama passent par le snapshot Cortex SHA-256 immuable créé avant la première fixture. Le runtime, le backend, les actions et leurs imports relatifs sont chargés depuis ce snapshot ; les chemins résolus hors snapshot provoquent une erreur explicite.
- Les rapports enregistrent l’empreinte, la branche, le commit, l’état dirty, l’identité/version Ollama et les paramètres de contexte. Le verrou `~/.solar-bench-smoke.lock` empêche deux smoke simultanés.
- Vérifications déterministes réussies : `npm run test:solar-bench`, `node --experimental-strip-types scripts/solar-bench-snapshot.test.mjs` et `npm run test:solar-bench:smoke`. Aucun benchmark général ni campagne Ollama n’a été lancé.

Travail local sur `codex/cortex-v4.1-stabilization` à partir de `44fe889`, sans commit ni push. Les neuf fichiers déjà modifiés par l’utilisateur ont été conservés sans changement par cette mission. Aucun DMG, téléchargement de modèle ou benchmark Ornith n’a été lancé.

- Preuves et scénarios : distinction entre exigences utilisateur, contrôles indépendants, vérifications déterministes, suggestions du modèle et conseils visuels. Un auto-test invalide ou hors domaine ne bloque plus une correction valable ; un défaut confirmé par un contrôle indépendant reste bloquant. Contrats click/fill, attributs booléens, input value, styles et transitions d’ouverture/fermeture alignés avec WebKit/Rust/Swift.
- Éditions : lots évalués ensemble, no-op informatif, DOM + CSS cohérents, rollback intégral d’une action essentielle invalide. Offsets CommonJS sûrs ou repli gardé, résolution CJS/ESM/bundler séparée, diagnostic de conflits et erreurs de format distinctes.
- Efficacité de la boucle : cache de vérification local à la tâche indexé par sources/dépendances/configuration, lectures nouvelles reconnues sans masquer la stagnation, empreintes de rejet évitant des répétitions identiques. Aucun plafond global de durée ajouté.
- Contrats et contexte : validation locale du schéma exact demandé, HTML autonome complet accepté dans le protocole autorisé sans fence finale, budget de payload explicite, exigences utilisateur des tours précédents injectées et dédupliquées.
- Reprise et confidentialité : journal borné des appels sans réponse brute dans la trace par défaut, identity modèle/endpoint vérifiée avant reprise, anciennes meilleures preuves invalidées, mémoire historique versionnée et empreintes SHA cohérentes, consentement cloud restreint par compte/dossier/fournisseur.

Validation : 14 suites déterministes réussies, 9 tests Rust réussis, `npm run build` et `git diff --check` réussis. WebKit réel a mesuré des transitions et attributs ; l’interface de production a été inspectée en clair/sombre et petite fenêtre avec fournisseur fictif, pièce jointe, focus, réduction du mouvement et Stop pendant une réponse simulée. Ces essais ne prouvent aucune amélioration de vitesse ni de réussite avec Ornith.

Registre d’audit : **6 corrigés, 18 partiels, 2 non traités** sur C4-001…026. Limites principales : aucune sandbox OS pour exécution non fiable, aucune transaction disque durable multi-fichier, index et permissions de fichiers non entièrement harmonisés, provenance incomplète de certains anciens adaptateurs, pas de mesure continue RAM ni d’évaluation réelle du modèle. Les six fondations V4, les protections de chemins/sources/tests et l’approbation physique sont conservées. L’évaluation finale reste à autoriser séparément.

Documents : [changelog](docs/CORTEX_V4_1_CHANGELOG.md), [couverture de l’audit](docs/CORTEX_V4_1_AUDIT_COVERAGE.md), [validation](docs/CORTEX_V4_1_VALIDATION.md) et [plan de benchmark non lancé](docs/CORTEX_V4_1_FINAL_BENCHMARK_PLAN.md).

---

# Correctif — 11 octobre 2026

## Mise à jour — compte, onboarding et animations

- Ajout de Supabase à la configuration locale ignorée par Git avec l’URL et la clé publique fournies par James. Aucune clé secrète/service-role n’est utilisée.
- Ajout d’une vraie section Paramètres > Compte avec connexion, création de compte, récupération/mise à jour du mot de passe, état de session et explication claire : comptes et identité distants, conversations/fichiers/clefs locaux.
- Les erreurs de formulaire du compte s’effacent automatiquement après trois secondes.
- L’assistant de premier lancement propose le dossier de référence optionnel, avec sélection puis validation persistante, et explique qu’il sert au contexte de fichiers ; l’historique reste dans le stockage interne local Solar. Le choix existant reste modifiable dans Paramètres > Stockage.
- Accélération de l’ouverture/fermeture du panneau : largeur 280ms, révélations décalées de 8ms par élément, fondu/flou conservés et préférence de mouvement réduit respectée. Le contenu visible apparaît avant 650ms ; la cascade de 50 lignes reste sous une seconde.
- Bouton latéral et feux natifs macOS remontés ensemble de 2px. Alignement horizontal inchangé.
- Build de production et contrats de fonctionnalités, chat et fournisseurs réussis. Le endpoint public Supabase répond 200, le fournisseur e-mail est activé et l’inscription n’est pas désactivée ; la confirmation e-mail est requise (`autoConfirm=false`). L’envoi effectif par SMTP, les URL de redirection/confirmation et leur retour vers l’application native restent à valider/configurer dans Supabase ; aucun compte de test n’a été créé.
- Le DMG n’a pas pu être reconstruit sur cet environnement : la commande Tauri s’arrête avant le build natif, car `cargo` n’est pas installé. L’artefact DMG existant n’a pas été remplacé.

- Refonte du panneau de navigation : à l’état fermé, le chrome ne conserve que le bouton de panneau à côté des contrôles macOS natifs. L’ancien rail, le compte, le nouveau chat et le titre du chat ont été retirés de la barre haute.
- À l’ouverture, l’historique devient un panneau flottant bordé au-dessus du chat, avec New Chat, New Projects, Search, Hub, Settings et les conversations existantes. Les raccourcis et le clavier restent disponibles.
- Icônes des actions reprises en SVG animés, à 18 px, avec repli sans animation lorsque « Réduire les animations » est actif. Le nouveau visuel fourni est devenu l’icône macOS ICNS/PNG de Solar.
- Ajout de `public/skills/mode-presentation.txt` et du skill installable « Mode Présentation » : les demandes de diaporama guident désormais vers un artefact HTML autonome, navigable et imprimable ; PowerPoint reste réservé à une demande explicite.
- Limitation : l’icône `.ico` Windows existante n’a pas été modifiée, car le visuel demandé concerne le paquet macOS arm64.
- Suppression de la barre web superposée : les trois contrôles macOS reviennent à leur position native standard.
- Chrome resserré : en-tête 52 px, rail 52 px et historique 210 px sur bureau.
- État actif clair adouci et icônes ramenées à 16 px ; l’icône Réglages utilise à nouveau un tracé de réglage professionnel.
- Correctif final du chrome : barre native macOS et en-tête Solar fusionnés dans une unique bande de 78 px, sans seconde barre.

---

# Rapport — 11 octobre 2026

- Barre de titre macOS reconstruite en mode overlay : boutons système natifs conservés, titre Solar centré et zone de déplacement transparente.
- Rail et historique rendus translucides avec flou de fond, tout en conservant les palettes clair, sombre et personnalisées.
- Icônes du rail redessinées en vecteurs monochromes plus fins et réduites à 18 px ; animations finies et préférence de mouvement réduit préservées.
- Limitation matérielle : la transparence/vibrancy dépend de l’API macOS privée activée dans la configuration Tauri ; elle ne vise pas une distribution Mac App Store sans adaptation native distincte.

---

# Compte rendu — ajustements du 10 octobre 2026

## Changements livrés

- Suppression de la colonne Personnaliser. Catalogues sur toute la largeur, logos colorés, + indisponibles grisés uniquement.
- Ajouter actif dans les deux pages : raccourcis HTTPS personnels enregistrés pour les plugins ; création/import Markdown, activation et suppression de skills persistants. Les skills activés alimentent les prochains messages. Les raccourcis ne connectent pas les API Gmail/Adobe/etc.
- Chatbox à surface unie, sans bordure ni changement de bordure au focus ; icônes affinées, modèle/effort compacts, icônes d’activité colorées et arrondies.
- Chat/Work choisi dans une capsule centrée sur les nouvelles conversations.
- Réponse en cours et secondes centrées et agrandies, animation shiny, étapes observées développées sous le séparateur (fichiers, sources, connexion, réception). Aucun raisonnement interne privé n’est affiché ni inventé.
- Artefacts : carte titrée avec version et Ouvrir, aperçu/édition/export existants ; récupération des sorties Markdown/JSON ordinaires complètes ; aperçu HTML interactif isolé sans accès réseau/stockage de Solar.
- Work : vérifications avant d’effacer le brouillon ; import de dossier pour les navigateurs sans accès natif, lecture/analyse des fichiers cochés et export des modifications. Écriture directe/annulation conservées pour les dossiers autorisés et l’application native.
- Web : correction du défaut SearXNG non configuré, recherche DuckDuckGo sans clé via proxy Vite ou HTTP natif, sources réelles transmises au modèle. Le globe active directement la recherche avec autorisation explicite. Erreurs lisibles.
- Apparence : import PNG/JPEG/WebP redimensionné et persistant ; transparence séparée barre des tâches/chat, rail plus doux que le noir/blanc central ; configuration macOS transparente et vibrancy.

## Limites à connaître

- DuckDuckGo a renvoyé une vérification humaine lors de l’essai réseau depuis cet environnement. Elle n’est pas contournée. Brave/Ollama avec clé ou SearXNG configuré restent des alternatives ; le pipeline est vérifié avec des réponses réseau contrôlées, sans prétendre que l’essai externe a réussi.
- Un site Web statique nécessite un proxy pour la recherche sans clé. npm run dev fournit ce proxy ; la version native utilise le plugin HTTP.
- Work importé en lecture seule ne modifie pas directement le disque : il propose un export. L’application macOS et les navigateurs avec autorisation de dossier disposent des écritures et de l’annulation.
- Les trois fonds proposés par James sont encore attendus ; aucun fond de remplacement n’a été inventé.
- La transparence native repose sur la vibrancy Tauri et l’API privée macOS, pas sur une reproduction complète du matériau Liquid Glass. Une distribution App Store nécessite une autre approche. Le rendu du bureau/dock réel reste à vérifier sur le Mac.

## Vérification

Compilation production et TypeScript réussis. Les quatre suites de contrats stockage/chat/fournisseurs/évolution passent, ainsi que six suites Playwright : redesign, évolution, progression, améliorations, polish et refinement. Les tests couvrent ajouts persistants et consignes des skills, Web/sources, artefacts/aperçu HTML, Work/import/export, thèmes/mobile, progression, défilement, fonds et transparence. Le résultat final est indiqué dans la livraison.

---

# Compte rendu — Refonte à partir des quatre captures (10 octobre 2026)

La version fonctionnelle précédente a été publiée sur `j4mesbst/Solar` dans le commit `422b923`. Le dépôt distant n’avait aucun changement supplémentaire à intégrer. Le correctif des icônes natives a ensuite été publié (`65dc8eb`). L’ancienne mention de publication bloquée, plus bas, est historique : l’autorisation explicite a été reçue.

## Réalisé

- Paramètres : lignes arrondies inspirées de la première capture, recherche en capsule, icônes nettes, composants partagés shadcn, contenu sur toute la largeur, thèmes et personnalisation conservés.
- Plugins : navigation Personnaliser, titres et recherche comme la référence, onglets Public/Personnel, grille à deux colonnes, douze connexions grisées avec `(bientôt)`. Recherche réelle et onglets clavier ; installation volontairement indisponible. Aucun faux plugin installé.
- Skills : même direction visuelle, recherche et toolbar ; Recommandés en haut et Installés en dessous, deux espaces vides, aucun skill prérempli.
- Chatbox : plus courte et plus haute, coins de 30px, nouveau chat centré à 690px max, conversation à 640px max ; plus pour les fichiers, globe relié au moteur Web configuré, modèle/status, effort et flèche circulaire précise. Feedback au clic, Stop et brouillon pendant génération conservés. Le bouton Web nécessite la configuration et le consentement existants ; il ouvre les paramètres si nécessaire.
- Défilement : Revenir en bas évite le conflit de scroll fluide pendant un flux ; ResizeObserver suit les changements de hauteur du rendu Markdown uniquement lorsque le suivi est actif. La lecture vers le haut reste libre.
- Statut : bandeau d’activité avec durée et Stop ; composant `animated-text-01.tsx` reprenant la brillance fournie. Les libellés suivent les événements réels et le type de réponse demandé. Le raisonnement privé n’est jamais affiché. Le caret animé est limité à 18px.
- Structure : composants shadcn Button/Input/Tabs/Badge officiels dans `src/components/ui`, tokens liés aux palettes Solar, alias `@/`, `components.json` et utilitaire `cn`. Réemploi dans les paramètres, formulaires, apparence, onboarding et composer.
- Correctif macOS : le premier workflow a révélé un fichier `icons/icon.png` absent. Icônes PNG/ICO/ICNS produites à partir d’un SVG sobre, fichiers ajoutés et configuration corrigée. Aucun logo solaire ajouté au chat.

## Trente phrases disponibles

| Opération réelle | Variantes |
|---|---|
| Connexion | Connecting to your model · Starting the conversation · Sending your message |
| Attente | Waiting for your model · Preparing a response · Your model is getting ready |
| Réflexion signalée | Solar is thinking · Thinking through your question · Working through the details |
| Recherche Web réelle | Searching the web · Looking for current sources · Retrieving web results |
| Rédaction | Writing your response · Putting the answer together · Generating a response |
| Code demandé | Generating code · Writing the implementation · Building your code response |
| Explication | Writing an explanation · Explaining the key ideas · Developing an example |
| Résumé | Writing a summary · Summarizing your content · Putting the key points together |
| Réécriture | Rewriting your text · Refining the wording · Drafting your revised text |
| Artefact demandé | Creating an artifact · Building your artifact · Generating your artifact |

Les phrases ne défilent pas artificiellement. Les variantes de rédaction sont choisies de façon stable par réponse ; les phases techniques privilégient un libellé constant. « Generating code » n’est pas utilisé pour une simple explication de code.

## Validation

- Build TypeScript/Vite et quatre suites de contrats validés.
- Playwright : nouvelle suite redesign (proportions, bouton Web et contexte réellement transmis, galerie/search/tabs/disabled, Skills vides, paramètres/search, clair/sombre, mobile), suite Thinking avec serveur SSE différé, smoke, compact, customization, polish, référence, enhancements et evolution validés : neuf suites navigateur au total après ajustement des dimensions.
- Captures inspectées visuellement ; conflit de couleur du bouton Ajouter corrigé ; labels accessibles des navigations et des deux boutons Stop distingués. Aucune erreur JavaScript dans la nouvelle suite.
- Réduction des mouvements, clavier Radix, labels des icônes, absence de débordement mobile et hauteur tactile vérifiés.
- Frontend de la version précédente également validé par GitHub Actions. La première compilation macOS a échoué sur l’icône absente ; après le correctif, les jobs frontend et native-macos sont tous deux verts (run 38042138605). Compilation native et tests Rust validés sur macos-14. Les dialogues et accès disque interactifs natifs nécessitent toujours un essai réel sur Mac.

## Dépendances et limites

Ajouts : `radix-ui`, `class-variance-authority`, `tw-animate-css`. Logos sélectionnés depuis Simple Icons (SVG locaux, licence conservée), sans chargement réseau à l’ouverture. Pas d’installation, de compte ni de clés supplémentaires pour le design. Les grandes bibliothèques d’export/diagramme restent chargées à la demande ; Vite signale toujours certains chunks volumineux.

Skills utilisés : frontend-design, ui-ux-pro-max et les règles de design du chat déjà chargées. Les autres skills demandés, shadcn MCP et Context7 n’étaient pas accessibles dans cette session ; cela a été signalé. Composants récupérés dans le registre officiel shadcn et vérification réelle avec Playwright.

Fichiers principaux : `src/ui/App.tsx`, `src/styles.css`, `src/redesign-tokens.css`, `src/components/ui/extension-directory.tsx`, `animated-text-01.tsx`, les quatre primitives shadcn, `src/services/activityLabels.ts`, `components.json`, les aliases TypeScript/Vite, les tests navigateur, les SVG locaux et `src-tauri/icons`.

---

# Solar — Compte rendu du 10 octobre 2026

## Implémenté

- **Affichage de génération** : Thinking en shimmer 17 px lorsque le fournisseur signale une phase de réflexion, phases connexion/préparation/rédaction, chronomètre et rapport repliable. Aucun raisonnement interne affiché. Lueur renforcée sur chaque niveau d’effort, avec réduction des animations respectée.
- **Nouvelle conversation** : chatbox plus grande et centrée, puis retour animé au bas de la conversation au premier envoi. Les conversations existantes gardent la version compacte.
- **Titres** : génération après le premier échange à partir de la demande et de la réponse, 2–3 mots et majuscule ; rejette les préambules/titres génériques ; protège les titres manuels. Repli local lorsque l’API échoue. Pas de promesse de titre parfait indépendamment du modèle choisi.
- **Chat / Work** : navigation séparée, sessions Work dans l’historique, fournisseurs/modèles/effort/rendu partagés. Dossier choisi explicitement, explorateur repliable, aperçu de fichiers et sélection de contexte. Maximum 2 000 entrées, 10 fichiers transmis, 200 000 caractères de contexte ; fichiers binaires, privés, gros fichiers et liens symboliques exclus.
- **Work contrôlé** : analyse du projet et propositions JSON validées sur les seuls fichiers transmis, aperçu avant/après, acceptation/refus, écriture réelle, historique persistant, annulation avec contrôle de concurrence. Nouvelle autorisation de dossier = nouvelles propositions requises. Aucun terminal ni exécution automatique de code. Le cloud reçoit l’arborescence et les fichiers sélectionnés seulement après consentement explicite.
- **Rich Responses** : Streamdown remplace ReactMarkdown, avec reprise du rendu GFM/code/math existant, copie des tableaux/blocs de code, gestion du Markdown incomplet en streaming, HTML brut désactivé et liens limités à HTTP/HTTPS/mailto.
- **Solar Web** : interfaces SearchProvider/Query/Result/Source, SearXNG sans abonnement imposé, Brave et Ollama Web Search ; modes Auto/On/Off ; consentement, clé dédiée dans le coffre, timeout 12 s, cache mémoire 5 min, sources réellement récupérées et erreurs visibles. SearXNG nécessite une instance configurée avec JSON activé ; l’aperçu navigateur nécessite CORS. Aucun moteur payant obligatoire ni recherche fictive.
- **Performance** : détection ponctuelle architecture/OS/mémoire et informations de puce sur macOS ; profils Ollama Économique (2 048, pas de préchargement, keep_alive 0), Équilibré (4 096, 5 min), Performance (8 192, 15 min). Réutilisation des modèles résidents, préchargement cohérent avec le contexte choisi. Mesures premier token/durée ; chargement/tokens par seconde uniquement si Ollama les fournit. Explication des effets sur le contexte dans les paramètres.
- **Solar Smart** : classification locale rapide (pas de deuxième modèle systématique), consignes courtes adaptées, utilisateur garde modèle/effort et peut désactiver Smart/Web. Reconnaissance des demandes explicites d’artefacts et de leurs modifications.
- **Artifacts** : panneaux repliables, structures JSON validées et bornées, identifiant/revision conservés pendant une modification, stockage local associé à la conversation. Code éditable/copiable/exportable, présentations navigables export PPTX, documents PDF/DOCX, tableaux éditables/triables CSV/XLSX, diagrammes Mermaid SVG/MMD. Prévisualisation des diagrammes isolée sans script ; aucun code exécuté. Exports macOS par dialogue natif, exports navigateur par téléchargement. Les chats temporaires gardent leurs artefacts en mémoire uniquement.
- **Installation intelligente** : Welcome to Solar, Commencer/Configurer plus tard, choix multiple Ollama/GonkaRouter/OpenAI/Anthropic/compatible ; configuration et tests des fournisseurs, clés masquées ; détection Ollama, lien d’installation volontaire, recommandations selon RAM connue, téléchargement Ollama avec vrais octets/progression par couche, annulation et reprise via couches déjà téléchargées. Assistant conservé comme terminé, pas de compte obligatoire.
- **Anthropic** : découverte /models, requêtes /messages, SSE text/thinking/message_stop et images adaptées à son format. Les clés du modèle et du moteur Web restent séparées.
- **Extensibilité** : ToolRegistry, ToolDefinition, ToolExecutor, ToolPermissions, SkillRegistry et PluginRegistry ; transport MCP prévu, aucune installation automatique de plugin.

## Tests et limites de validation

- Types TypeScript et build Vite de production.
- Contrats fournisseurs/chat/stockage, et nouvelle suite évolution : structures invalides, révisions, exports binaires PPTX/PDF/DOCX/XLSX, sécurité CSV, chemins Work/propositions, permissions d’outils, consentement/cache/sources Web, profils, flux de téléchargement tronqué/succès et protocole Anthropic.
- Tests navigateur sur la vraie application avec réponses de fournisseurs contrôlées : chat existant, scroll pendant streaming, titres manuels, favoris, Markdown/liens sûrs, paramètres/images, nouvelle chatbox, états du modèle, effort, présentation 6 diapositives et modification, téléchargement, sources Web, opérations Work dans l’adaptateur de fichiers navigateur, exports PDF/DOCX/XLSX et diagramme SVG, configuration ignorée puis rechargement.
- Test avec véritables événements SSE différés : Thinking 17 px, raisonnement interne absent, réponse finale et lueur des quatre niveaux.
- Les réponses des services externes et le navigateur de fichiers sont des fixtures de test. Aucun secret réel n’a été utilisé. Le code de production appelle les vrais fournisseurs et les vraies API de fichiers.
- **À valider sur macOS** : compilation Rust/Tauri, dialogues natifs, Trousseau, accès au disque et mesures matérielles. Ce conteneur n’a pas Rust/macOS ; un workflow GitHub macOS est préparé mais ne peut démarrer avant publication autorisée. L’annulation native ne survit pas à la fermeture de l’app (les sauvegardes restent en mémoire) ; l’historique reste visible.
- **Délibérément futurs selon le brief** : terminal isolé, intégrations Git/GitHub/navigateur/MCP actives, vrais skills/plugins, construction complète de sites. Monaco n’est pas ajouté : éditeur texte et coloration existante suffisants pour cette première version, sans charger un IDE dans Chat.
- Le PDF utilise les polices standard jsPDF : les écritures hors alphabet latin peuvent nécessiter une police incorporée ultérieurement. Les tailles de modèles/RAM recommandées sont des estimations affichées comme telles.
- Build : avertissements de taille sur certains modules (ExcelJS/Mermaid notamment), chargés à la demande. Pas d’erreur de build.

## Dépendances

Ajoutées : Streamdown, PptxGenJS, docx, ExcelJS, jsPDF, Mermaid. ReactMarkdown direct supprimé pour garder un seul moteur de rendu. Les exports/diagrammes sont importés à la demande.

## Fichiers principaux

- `src/domain/{types,extensions}.ts` : contrats de données.
- `src/services/{artifacts,extensionStore,modelInstall,performance,solarSmart,solarWeb,toolRegistry,workProject}.ts` : nouveaux services.
- `src/services/{aiLabels,chatApi,conversationTools,ollama,providerApi}.ts` et `src/hooks/useModelPreparation.ts` : services existants étendus.
- `src/components/ui/{advanced-settings,artifact-panel,onboarding,work-surface}.tsx` : nouvelles interfaces ; `markdown-message.tsx`, `rail-icon.tsx` adaptés.
- `src/ui/App.tsx`, `src/styles.css`, `vite.config.ts`, `package.json`, `package-lock.json` : intégration.
- `src-tauri/src/{lib,work,hardware}.rs` : accès natif contrôlé, export binaire et matériel.
- `scripts/evolution-contract.test.mjs`, `scripts/ui-{evolution,thinking}.cjs`, suites précédentes adaptées aux nouveaux états et dimensions.
- `.github/workflows/validation.yml` : checks frontend et macOS Rust.

## Publication

Code prêt localement. L’approbation automatique a refusé l’envoi du nouveau code source sur GitHub : elle exige une autorisation utilisateur explicite de publication vers `j4mesbst/Solar`, malgré la vérification du propriétaire et de l’accès en écriture. Aucune branche distante n’a été modifiée pour cette version. Ne pas lancer `git pull` en espérant recevoir ces changements avant que cette publication soit autorisée et confirmée.


---

## Historique de la version précédente

# Progress — 2026-10-09

## Completed implementation

The approved Solar redesign, previous features and latest attached feature brief are implemented in the existing Tauri/React project, with native export awaiting macOS verification. No repository history has been rewritten.

- Flat dark/light interface, larger consistent corners, macOS system typography, restrained icons, collapsible sidebar, pinned settings and independently scrolling chat.
- Drafting and changing model/effort while generating; each request keeps its captured settings, later edits apply to the next turn.
- Markdown/GFM, code copy, horizontal code/table scrolling, real generation status via the supplied ToolGroup component, safe reasoning-tag buffering and stream error handling.
- Persistent schema-v3 conversations/messages/drafts/attachments; transactional writes; migration from legacy browser settings and current-tab history. Browser localStorage adapter and native Tauri Store adapter.
- Cmd K local history search: titles/messages, accent/case-insensitive matching, snippets/highlights, arrow/Enter/Escape interaction, focus restoration and exact-message jump.
- Nonblocking Ollama detection, manual selector refresh, distinct model IDs, preserved cloud providers and removed-model availability states.
- Debounced local preparation with stale-result cancellation, one preload at a time, `/api/ps` resident-model check and five-minute expiry. No cloud preloading, model download or forced unloading.
- Compact smart paste from 1500 characters or 30 lines: preview, removal, conversion to textarea text, draft persistence, full unmodified attachment content in model input.
- Simplify/Expand/Correct/Rephrase/Summarize for selected assistant text: shared real-provider streaming service, separate result, copy/insert/stop, original response retained, captured text treated as data. Primary and contextual generation do not overlap.
- Stored API key masked using a dummy display, read-only until explicit replacement; saving unchanged never stores the dummy. Native Keychain errors are distinguished from absent credentials.

## Checks actually run

- `npm run test:providers`: passed. Validation, model mapping, auth/error paths, Ollama keyless `/api/tags`.
- `npm run test:chat`: passed. SSE/NDJSON, request settings, auth, repeated tokens/whitespace, split reasoning tags, full-message snapshots, malformed/truncated streams and cancellation.
- `npm run test:features`: passed. Store recreation/restart, separate drafts and exact attachments, write failures, serialized mutations, deletion/late-stream guard, offline accent-insensitive search/highlights, compact-paste thresholds/full input.
- `npm run build`: passed. TypeScript and Vite production bundle.
- Browser smoke suite with controlled provider responses: passed against the real application. Verified editable draft and controls during generation, next-request settings, isolation when switching/new chat, Markdown/code/tables, all five selection actions, copy/insert, compact paste preview/full send, draft/attachment restoration after reload, Cmd K search/Enter message jump/Escape, masked stored key, light/dark theme, automatic local discovery, rapid-change preload debounce, removed-model reconciliation and responsive sidebar/settings at 390×700.
- Additional browser checks passed: unavailable Ollama does not block configured cloud models; simulated preload memory failure does not block local sending; paste expand/remove preserves content; Stop marks a request interrupted.
- Desktop chat, search palette, light settings and small-window provider settings were rendered and visually inspected.
- `git diff --check`: passed.

The browser suite uses fake network fixtures only for external provider responses, not fake production implementations. No real API credential was used or logged.

## Files and dependencies

- Existing app/types/store/vault boundary/provider/chat/styles/Vite/native files updated; stale documentation rewritten.
- New `components/ui`: ToolGroup, Markdown, search palette, pasted-content preview, selection actions.
- New `hooks`: persistent drafts, model preparation, text actions.
- New `services`: storage core/driver, search index, Ollama discovery/preparation, pasted-content handling, browser/native transport.
- New targeted feature suite and optional portable browser smoke suite; native capability configuration added.
- Runtime dependencies added: react-markdown, remark-gfm, clsx, tailwind-merge, @tauri-apps/plugin-http.
- Build dependencies added: tailwindcss, @tailwindcss/vite. Rust HTTP plugin and Apple-native Keychain backend configured.

## Still requires a real macOS check

Rust/Xcode and a macOS target are unavailable in this workspace. `npm run tauri dev` and a native bundle were not tested. Verify:

1. Tauri Store migration, app close/reopen and exact draft restoration.
2. Keychain access/create/read/replace/delete and OS permission prompts.
3. HTTP plugin capabilities and real GonkaRouter discovery/streaming/Stop.
4. Installed Ollama discovery/preloading, actual first-token latency and memory-pressure behavior.
5. Native keyboard shortcuts, SF Pro rendering and window sizing.

## Limits

- Effort profiles adjust instructions/output budgets; provider-native reasoning levels are not inferred. No web search or simulated tool execution.
- Adaptive Solar model and model downloads remain deferred.
- Browser credential storage is localStorage, not encrypted Keychain storage. It is scoped by browser/origin, not IP address.
- Custom browser endpoints may need CORS; fixed development proxies cover default Ollama and GonkaRouter.
- Preloading is intentionally skipped when another local model is already resident. Actual low-memory behavior needs a real machine.
- Attached content is sent in full. Provider context/token limits may reject it; Solar does not silently truncate it.
- Whole-file/localStorage storage is appropriate for this V1. Very large archives and concurrent independent app windows need further storage/index synchronization work.
- Contextual transformation results are transient until copied/inserted/sent; original messages and drafts are persistent.
- Open Design's guide was read, but its local MCP service was unavailable. No Open Design generation was claimed.

## Exact changed-file inventory

- `ARCHITECTURE.md`
- `DESIGN.md`
- `PROGRESS.md`
- `README.md`
- `ROADMAP.md`
- `SOLAR_SPEC.md`
- `package-lock.json`
- `package.json`
- `scripts/chat-contract.test.mjs`
- `scripts/features-contract.test.mjs`
- `scripts/provider-contract.test.mjs`
- `scripts/ui-smoke.cjs`
- `src-tauri/Cargo.toml`
- `src-tauri/capabilities/default.json`
- `src-tauri/src/lib.rs`
- `src/components/ui/markdown-message.tsx`
- `src/components/ui/pasted-content.tsx`
- `src/components/ui/search-palette.tsx`
- `src/components/ui/selection-actions.tsx`
- `src/components/ui/tool-group.tsx`
- `src/domain/types.ts`
- `src/hooks/useDraft.ts`
- `src/hooks/useModelPreparation.ts`
- `src/hooks/useTextActions.ts`
- `src/services/chatApi.ts`
- `src/services/contracts.ts`
- `src/services/mockStore.ts`
- `src/services/ollama.ts`
- `src/services/pastedContent.ts`
- `src/services/providerApi.ts`
- `src/services/search.ts`
- `src/services/storageCore.ts`
- `src/services/store.ts`
- `src/services/transport.ts`
- `src/styles.css`
- `src/ui/App.tsx`
- `tsconfig.app.json`
- `vite.config.ts`

## Latest redesign and attached feature brief

- Fixed streaming autoscroll: upward wheel, touch, keyboard or scrollbar movement suspends following; return-to-latest resumes. Search and favorite jumps remain at the chosen message, including when already viewing that conversation.
- Permanent icon rail (Home, Plugins, Skills, Settings), independently scrolling collapsible history with smooth reduced-motion-aware transitions, enlarged original Solar wordmark, thinner rounded rows. Plugins and Skills now intentionally display only their title and “Arrive bientôt”, following the latest feedback. No plugin marketplace or arbitrary skill runtime is claimed.
- Removed top-right delete control and assistant/model labels. History hover/context actions support deletion/renaming/pinning. Real request preparation/response receipt status and elapsed time precede a thin separator; results stream progressively and settle with a short fade. No invented agent activity.
- Effort gauge/menu with an understated warm Ultra state; existing model search/grouping/refresh retained. Effort remains an instruction/output-budget profile, not a guarantee of native reasoning.
- Rich GFM tables with TSV copy, code language/copy/syntax coloring, nested/task lists, H1–H6, safe links/quotes and KaTeX math. Unsupported formulas preserve their source; HTML is skipped and untrusted math commands disabled. Display updates capped at roughly 10 per second while all chunks remain in the final persisted response. Math/syntax bundles split out.
- Temporary chats use a separate memory store, never the disk store or draft recovery. No search/export/favorite/pin participation; explicit close removes their content. Cloud-provider handling remains distinct from local retention.
- Persistent pins and favorite message flags (deduplicated on the original message), favorite previews/original-message navigation/removal.
- First-message local titles with code/attachment fallbacks and manual-title protection.
- Settings-only single/all Markdown or text export with ordered message content/model metadata; temporary chats and provider credentials excluded. Browser download verified. Rust native save-dialog command implemented with user-chosen path only; compilation and dialog behavior require macOS verification.

### Additional verification

Contract feature tests passed for memory-only temporary messages/drafts, no disk writes, restart loss, close/late-write protection, persistent pins/favorites, deduplication, title cleanup and export filtering. Existing provider/chat contracts passed. Existing browser regression suite passed, including all five selection actions and small-window settings. New browser enhancement suite passed against timed SSE chunks: small and large upward scrolling, stable reading position during additional chunks, resume-follow button, pins/manual titles, favorite navigation and reload, temporary privacy/recovery/close, downloaded export content, math/syntax/copy/safe links, rail visibility and mobile overflow. Native Rust/macOS remains untested.

## Reference-image layout revision

- Inspected the supplied image and retained its interface geometry without its illustrated background or middle-message styling.
- Wide two-row composer with 36px corners (28px on mobile), circular add/attachment/send controls and compact secondary chips. Text/code file attachment reuses the existing draft/content path, with original bytes retained and a 5 MB per-file limit. Existing smart paste, Enter/Shift+Enter, streaming/Stop and draft isolation retained.
- Model, overflow menu and effort button moved to the top right. Effort popover provides a horizontal native range with four discrete levels, named level buttons, keyboard support and understated Ultra color. Dragging previews locally and commits on release; model/effort changes continue to apply to the next request during generation.
- Navigation icons animate on each click with a soft scale/translation, Settings uses a restrained rotation; selection surface and placeholder-page entrance animate briefly. Reduced motion disables these effects. Added the reference's discrete favorites heart above Settings.
- Plugins/Skills: title and “Arrive bientôt” only. No prefilled connections or text-action lists in those pages.
- Flat dark/light themes remain. History starts hidden, remembers explicit user preference and retains responsive collapse behavior.
- Web search, image creation and microphone affordances from the reference are explicitly disabled as upcoming features; no fake tool execution. File attachment and response-profile actions are functional.
- Verification: production build, existing chat/store/provider contracts and browser smoke/enhancement regressions pass. New reference-layout suite verifies header/composer geometry, placeholder contents, icon motion/reduced motion, pointer and keyboard range changes, exact file-content persistence, overflow-menu Escape, unavailable-tool state, dark/light and mobile bounds. Desktop dark/light and mobile layouts visually inspected. Native macOS not run in this environment.

## Motion, roomy settings and image attachment revision

- Replaced whole-icon rotation with individually animated SVG parts: house construction, four-tile assembly, wand and staggered sparks, heart echo, expanding gear segments. Keyboard activations replay the same motion without replacing the focused button.
- Added short settings/content, popover entry/exit, attachment, copy, Stop and error transitions. Closing menus become inert and hidden from assistive technology immediately; all added motion respects reduced-motion.
- Rebuilt settings from both supplied screenshots: full workspace width, searchable rounded category menu, independent desktop scrolling and responsive mobile layout. No invented settings.
- Appearance has Automatic/Light/Dark previews with rounded blue selection borders. Automatic follows local time: light from 06:00 through 19:59, dark from 20:00 through 05:59. Boundary timers and focus/visibility/clock refresh work independently of OS appearance; manual choices override the schedule. Existing `system` storage value now represents scheduled Automatic mode.
- Replaced the former wide, button-heavy composer with a narrower 760px maximum, taller input and only Add and Send/Stop. Model/effort/options remain in the header and stay editable during generation.
- PNG/JPEG/WebP import now decodes and optimizes images, shows removable thumbnails/previews, persists image drafts and sends actual pixels: OpenAI-compatible image_url data URLs or Ollama raw base64 images. Clipboard and drag/drop are supported. Files above 10 MB, unsupported formats and invalid images show errors; large images are resized to 2048px maximum dimension and constrained for local storage. Text/code import remains supported.
- Image placeholders in message text never expose base64. A provider rejecting an image request receives a clear user-facing error instead of silent attachment loss. Image understanding still requires a vision-capable model.
- Validation: production build; provider/chat/feature contracts; browser smoke, enhancement, reference and new polish suites. The new suite verifies 20:00/06:00 boundaries, manual override, settings search/full width, blue border, compact composer, actual image import/paste/drop/remove/preview/reload and mocked cloud/local request payloads/rejection, per-part motion and reduced-motion, and 390px mobile bounds. Desktop and mobile screenshots visually inspected. Native macOS and live-provider image analysis remain unverified.

## Supplied composer code, effort reference and full appearance customization

- Adapted the supplied prompt input/upload layout to Solar’s live chat: textarea above an action row, paperclip and Send/Stop only, removable attachment grid and drop overlay. The demo timeout was replaced by actual request/cancel behavior; existing per-chat drafts, Enter/Shift+Enter and streaming controls remain.
- Added lazy-loaded PDF.js and Mammoth text extraction for PDF/Word attachments (5 MB, 100 PDF pages, 500k text characters maximum). Images still use the actual vision payload path. Empty scans/protected/invalid files fail explicitly; there is no OCR or silent binary-as-text import.
- Added actual stream phase events: connection, response accepted/waiting, provider-reported thinking and visible response reception. A TextShimmer header and expandable activity report use those events; reasoning content is never shown and the waiting label appears once.
- Added an animated monochrome caret overlay while preserving the native textarea, selection, line wrapping and scroll. Reduced motion uses the native caret.
- Rebuilt effort from the supplied reference: prominent level and short model name, thick horizontal rounded track, white circular thumb, animated fill/label, discrete warm Ultra particles, reset and all four keyboard/pointer-selectable levels. These remain response instructions/output budgets, not invented native reasoning capabilities.
- Rail hover/focus replays multipart vector choreography; clicks add a spring zoom/dezoom. The button owns pointer hits so animation replay cannot cancel its click. Removed the redundant history Favorites link; the heart remains.
- Model labels are generated automatically in background with the configured provider, 48 output-token budget and 15-second timeout. Short local fallback and grounded-label validation prevent unrelated completions becoming labels. Full API IDs and provider names are untouched; labels survive discovery/restart and are searchable alongside raw names.
- First successful conversation turns request a capitalized title of at most three words from the same model. Atomic metadata writes preserve manually renamed titles, do not resurrect deleted chats and leave local fallbacks on failure. These brief auxiliary requests use the configured provider and its normal costs; no unrelated service is involved.
- Appearance uses a unified settings canvas and persisted independent light/dark palettes: dominant color, canvas, surfaces/composer, text, navigation, user bubbles, borders and selection/focus. Radius and font are editable; reset restores defaults. Automatic 06:00/20:00 mode remains. Solar’s original wordmark typeface is preserved.
- Validation: build, provider/chat/store/appearance/label/activity contracts and browser smoke, enhancement, reference, polish and customization suites. The customization suite imports actual PDF/DOCX fixture bytes, verifies extracted text in chat requests, exercises native editing/caret selection/multiline, real SSE thinking/writing transitions with hidden reasoning, provider-backed metadata requests/raw IDs, hover/press, animated Ultra/reset, palette persistence/reset, mobile and reduced motion. Native macOS and live provider/model checks remain outstanding.


## 2026-10-09 — Compact composer and runtime controls
- Composer baseline reduced to about half its former height; grows with multiline drafts.
- Model, small red/green connection dot, effort and Send share the lower-right action row. Options moved top left.
- Local preparation pulses light green, ready stabilizes, failures show red; readiness persists during generation.
- Effort popup reduced to roughly one third its former height; every level has a distinct dynamic particle pattern.
- Rail multipart motion runs on hover/focus only; click uses a separate scale spring, with reduced-motion support.
- Narrow-window popovers stay inside the composer bounds. Focused browser regression covers placement, all effort animations, provider states, editable generation, hover/click, mobile and reduced motion.

## 10 octobre 2026 — fonds jumelés, Work et diaporamas

- Commande exacte `npx shadcn@latest init --preset b48 --template next` exécutée. Réponses par défaut : installation du CLI acceptée ; écrasement de components.json refusé (défaut No). Le CLI s'arrête dans ce cas : la configuration shadcn existante et le projet Vite restent en place ; le preset b48 n'a pas été appliqué.
- Six images fournies regroupées en Côte, Plage et Dunes, versions claire/sombre, optimisées en WebP. Aperçus moitié/moitié, choix enregistré, changement avec le thème automatique (6 h / 20 h) et manuel. Fonds limités au chat ; aucune image derrière la navigation ou les paramètres. Import personnel conservé.
- Accueil et Skills arrondis, autres pictogrammes de navigation harmonisés. Icônes blanches sur capsule sombre au survol et sur la page active ; animations existantes respectent le mouvement réduit.
- Work reprend la composition de la référence : accueil central, chatbox, choix de projet, Fichiers, Plugins. Aucun panneau droit permanent ou ouvert par une réponse. L'inspecteur s'ouvre sur demande ; Échap, fermeture, focus clavier et retour au bouton sont pris en charge. Sélection des fichiers, consentement cloud, approbation et annulation restent fonctionnels. Pas de dictée vocale ou d'approbation à la place de l'utilisateur.
- « Réponse en cours » revient à gauche, en 14 px, secondes sur la même ligne. Les étapes sont celles observées, sans raisonnement privé.
- Cartes d'artefacts monochromes selon le thème. Demandes diapo/diaporama/exposé détectées comme présentations. Export PPTX 16:9, couverture, hiérarchie typographique, contenu en points/colonnes, pied de page ; aperçu adapté. Les anciens artefacts de code restent conservés : demander un nouveau diaporama produit le bon type sans renommer un fichier texte en PowerPoint. La qualité des faits/contenus dépend du modèle sélectionné.
- Vérification : build TypeScript/Vite ; contrats fonctionnalités et évolution (ZIP PPTX, six slides XML, taille 16:9) ; Playwright sur génération, artefacts, Work, import/export et thèmes/fonds, mobile et erreurs JS. Captures inspectées et contraste des icônes corrigé. Pas de test visuel natif macOS dans cet environnement.

## 10 octobre 2026 — comptes en ligne, plugins, aperçu et chatbox

- Aperçu d'artefact agrandissable/réductible ; Échap, cycle de focus et arrière-plan inactif. Les diaporamas sont beaucoup plus lisibles en grand format.
- Suppression des trois points près de Solar. Nouveau chat reste accessible dans l'historique et par un + lorsque celui-ci est replié.
- Nouveau chat et les changements de modèle/effort ne créent aucune conversation. La première question valide crée l'entrée d'historique. Choix récents conservés, brouillons et conversations temporaires préservés.
- GitHub et Gmail activés dans le catalogue, logos de marque. Connexion réellement vérifiée par API ; GitHub : dépôts et README avec PAT limité ; Gmail : recherche et lecture readonly, Google OAuth côté Web ou jeton avancé côté natif. Ajout au brouillon uniquement, aucun envoi au fournisseur IA sans action de l'utilisateur. Les autres intégrations restent annoncées bientôt.
- Compte Solar en ligne avec Supabase : inscription, confirmation e-mail, connexion, déconnexion, récupération et nouveau mot de passe. Session native dans le Trousseau, séparation des données locales par compte, espace invité conservé. À activer avec URL et publishable key du projet commun à Solar ; aucun serveur Supabase réel n'a été créé/configuré ici. Pas de synchronisation cloud de l'historique dans cette version. Guide dans docs/ACCOUNTS_AND_PLUGINS.md.
- Selon la correction de James, fonds d'écran personnalisables retirés, images embarquées et service d'import supprimés. Les anciennes valeurs stockées n'affichent plus de fond. Thèmes et couleurs restent personnalisables.
- Fichier de chatbox intégré : CSS fourni et variables reliées aux thèmes, arrondi 28 px, focus, + animé, flèche inactive/active, bandeau animé avec phases réellement reçues et phrases sans répétition consécutive. Modèle et durée sur la ligne inférieure, Stop, confirmation 2,2 s / arrêt 1,4 s. Les formulations ne simulent pas d'outils ni un raisonnement privé. Champ ancré pendant le bandeau, rédaction et changement de contrôles possibles pendant la génération ; Entrée/Maj+Entrée conservés.
- Validation : contrats stockage/fonctionnalités, chat, providers et évolution ; compilation TS/Vite ; Playwright connections (SSE réel de test, Stop, fin, rotation, champ ancré, jetons refusés, import GitHub/Gmail contrôlé, signup/login/logout Supabase simulé, isolation, mobile/mouvement réduit), évolution Work/artefacts avec aperçu agrandi ; captures inspectées. Les intégrations réelles Google/Supabase attendent leurs configurations publiques et autorisations ; parcours natif OAuth Google complet non réalisé, pas de test visuel natif macOS ici.

## Dernière passe Solar / Solar Code — 10 octobre 2026

- Noir profond #000000 commun au chat et aux barres ; nuance claire #ffffff / #fdfdfd. Couleurs personnalisées et transparence conservées.
- Menu sur le mot Solar, calqué sur la capture : Solar / Solar Code, descriptions et coche. Suppression du sélecteur central Chat/Work et de l'icône Work redondante. Navigation clavier et retour du focus corrigés dans le bouton shadcn React 18.
- HTML fourni conservé intégralement dans public/references/solar-composer.html. Shaders, palettes, constantes et équations de mouvement repris sans modification : nuages WebGL, chute avec flou, fondu, descente FLIP et relance à Nouveau chat. CSS original isolé ; adaptateur pour les messages réels, fichiers, sélection modèle/effort et stockage existants. Aucune réponse de démonstration n'est envoyée à l'utilisateur.
- Chatbox 640 px maximum, 28 px d'arrondi, champ natif et redimensionnement animé ; animations originales des boutons, bandeau, fichiers et apparition du texte. Le modèle choisi est conservé ; rédaction et réglages restent utilisables pendant la génération.
- Outils raccordés aux fichiers joints, à la recherche Web et aux propositions de modifications Code. Terminal et calculateur dédié affichent Bientôt ; aucune capacité inexistante n'est annoncée active.
- Supabase : organisation Solar confirmée (offre free), aucun projet visible. L'appel requis get_cost retourne UNAVAILABLE (« MCP tool get_cost was not returned by tools/list ») : le projet n'a pas été créé, aucune facturation ni activation publique n'est annoncée. L'inscription/connexion existante reste prête à recevoir l'URL et la publishable key du projet commun. Version supabase-js épinglée avec lockfile. Un accès au tableau de bord ou la création du projet par le mainteneur est nécessaire.
- Vérifications : contrats fonctionnalités/chat/fournisseurs/évolution et build TS/Vite ; tests navigateur scène (WebGL, chute/FLIP/relance, Stop, menu clavier, brouillon Code, fichiers, fallback sans WebGL, thèmes/mobile/mouvement réduit), connexions et comptes simulés, évolution Work/artefacts. Captures inspectées. Pas de compte Supabase réel créé, pas de test natif macOS dans cet environnement.

### 10 octobre 2026 — Navigation compacte et génération par mode

- Rail réduit à 44 px, en-tête desktop de 64 à 24 px, raccord arrondi et historique translucide/flouté ; cibles mobiles préservées.
- Menu Solar/Solar Code compact, chatbox Code centrée avec sa tablette de projet, curseur animé monochrome rétabli.
- Code : étapes réellement observées sous une séparation, durée sur la ligne du statut ; brillance réservée aux commandes actives, sans inventer un terminal ni montrer de raisonnement privé.
- Solar : composant AITextLoading fourni adapté aux phases réelles, petits points, fondu du texte ; suppression du panneau et des pastilles de sources. Arrêt disponible dans le bouton d’envoi.
- Rafraîchissement du flux normal à 32 ms et suppression des 600 ms d’attente supplémentaires après la descente initiale. Ultra conserve ses instructions et son budget ; le calcul du fournisseur reste hors du contrôle de Solar.
- Dépendance motion épinglée ; contrôle visuel et contrats exécutés avant publication. Comptes et connexions externes ne sont pas reconfigurés dans cette passe.

- Correction du chargement d’historique pendant la création : les mises à jour du flux en mémoire priment sur une lecture antérieure du stockage. Les phases observées sont enregistrées à chaque changement, et les chemins des fichiers réellement lus sont visibles pendant l’attente du modèle.

## Dernière passe — en-tête et deux premiers messages (10 octobre 2026)
- Menu Solar/Solar Code déplacé à la place du titre Conversations dans l’historique ouvert.
- En-tête composé d’un bouton latéral arrondi, d’une séparation et du titre natif de la conversation.
- Composant Kokonut AI Text Loading réintégré : texte brillant, transitions verticales, phases Preparing/Waiting/Thinking/Analyzing/Generating selon les événements reçus ; suppression des trois points.
- Correction du transfert du brouillon au premier envoi et de l’effacement asynchrone : les modifications plus récentes restent conservées.
- Protection de l’animation d’entrée pour ne pas la relancer au deuxième envoi rapide.
- Vérification dédiée par navigateur avec sauvegarde retardée, deux premières réponses rapides, historique et brouillon suivant ; contrôles clavier, petit écran et mouvement réduit.
- Validation terminée : compilation TypeScript/Vite, contrats providers/chat/features/evolution et suites Playwright first-turns, solar-scene et connections réussis. Rendus clair/sombre et mobile inspectés. Les sauvegardes retardées testent également la saisie pendant l’effacement du brouillon. Les tests de fournisseurs et de comptes utilisent des fixtures ; aucune configuration de service externe n’est modifiée dans cette passe.

## Interface monochrome et six skills — 10 octobre 2026
- Chargement normal réduit à 16px, aligné à gauche, avec alternatives descriptives toutes les 10 secondes selon les étapes réellement observées.
- Bouton de retour en bas supprimé ; le contrôle du défilement reste disponible dans la conversation.
- Chatbox blanche/noire unie, sans bordure contrastée ni couleur verte ; statut accessible et indicateurs monochromes conservés.
- Barre des icônes agrandie à 64px ; icônes ×1,5 et placement abaissé. Indication Entrée/Maj+Entrée retirée en Solar Code.
- Compte : fenêtre minimaliste refaite, champs espacés, bouton principal pleine largeur et affichage/masquage du mot de passe. Flux Supabase conservés.
- Six skills proposés et installables : Artefact Pro, Code Max, Recherche Pro, Clarté Plus, Document Expert et Data Analyst. Installation, activation, suppression et sauvegarde par compte ; injection dans la demande seulement pour les tâches pertinentes.
- Réponses : consignes de résultat précis, respect du projet et revue interne ciblée ; rafraîchissement du texte en Solar Code à 32ms comme Solar. Aucun appel de revue supplémentaire ni réduction arbitraire de l’effort. La latence et la qualité finale dépendent aussi du modèle/fournisseur ; les skills sont des instructions, pas de nouveaux outils.
- Vérifications réussies : build TypeScript/Vite, contrats skills/providers/chat/features/evolution, suites Playwright skills-polish, first-turns, connections, evolution et solar-scene. Contrôle visuel clair/sombre/mobile ; installation/rechargement/désactivation/suppression des skills et présence réelle de leurs instructions dans la requête ; rotation à 10 secondes avec horloge contrôlée ; artefacts exportables et propositions Work approuvées/annulées. Les comptes sont vérifiés avec des fixtures Supabase ; l’activation réelle requiert toujours la configuration Supabase de l’installation.

## 11 octobre 2026 — chrome macOS, panneau et Hub

- Suppression de la bande blanche du haut : l’animation du chat commence à l’extrémité supérieure de la fenêtre et le seul bandeau de contrôle est transparent.
- Position des boutons macOS abaissée à y=28 ; le bouton 18 px d’ouverture/fermeture du panneau est aligné sur la même ligne.
- Les cinq actions du panneau déclenchent désormais les animations SVG au survol de toute leur ligne ou au focus clavier ; mouvement réduit respecté.
- Hub ouvre les Plugins et Settings ferme automatiquement le panneau ; Plugins propose maintenant le bouton Skills à côté de Personnel. Plugins et paramètres utilisent chacun une surface unique dérivée du thème.
- Les retours d’erreur visuels se ferment après trois secondes, y compris ceux du chat, du répertoire et les alertes de formulaire restantes.
- Vérification effectuée : compilation TypeScript/Vite et contrôle des espaces Git sans erreur. Limite : le contrôle visuel automatisé Playwright n’est pas disponible localement (navigateur/module absent) ; le bundle macOS reste à reconstruire et à ouvrir pour le contrôle natif final.

## 11 octobre 2026 — correction finale de la barre native

- Suppression à la source du matériau macOS `underWindowBackground`, ainsi que de tous les fonds CSS de la zone de titre : aucune bande blanche ne doit subsister au-dessus de la scène.
- Boutons macOS déplacés à droite et abaissés (x=30, y=47) pour s’aligner avec l’ouverture du panneau.
- New Projects devient Solar Code et ouvre le mode Code/Work existant, dédié aux demandes de développement.
- Panneau latéral : fondu, léger déplacement et flou à l’ouverture comme à la fermeture ; mouvement réduit préservé.
- Messages d’erreur du chat retirés de l’interface, tout en laissant les échecs techniques tracés dans les données ; recherche des paramètres retirée ; navigation affinée en pastilles arrondies.
- Skills conserve les boutons Public, Personnel et Skills, avec retour direct au Hub depuis les deux premiers.
- Contrôle natif reconstruit : la zone supérieure est désormais continue avec la page ; le bouton du panneau est remonté de 16 px pour coïncider visuellement avec les trois contrôles macOS.

## 11 octobre 2026 — corrections du chat normal et du panneau

- Bouton latéral unifié : suppression du bouton distinct placé dans le panneau; l’unique commande reste à la même coordonnée ouvert/fermé, par-dessus le panneau flottant. Aucun changement aux coordonnées des contrôles natifs macOS. Les titres Plugins, Skills et Paramètres commencent au même endroit sous la bande transparente.
- New Chat force l’espace normal, même si l’utilisateur se trouvait dans Solar Code. Les contrôles de projet restent propres à Solar Code. Les raccourcis visibles sont retirés des libellés du panneau.
- Ajout dans Paramètres > Stockage d’un choix de dossier par défaut avec sélection distincte puis bouton Valider; le dossier peut être remplacé ou retiré. Le chemin est conservé dans le répertoire de configuration macOS. En chat normal, le dossier n’est consulté que pour les demandes relatives au code/projet, seuls des fichiers sûrs et pertinents sont lus, et la réponse est explicitement en lecture seule. La validation informe et autorise la transmission des extraits pertinents au modèle.
- Hub/Skills : onglets ordonnés Public, Skills, Installés; depuis Skills, Public et Installés reviennent sur l’onglet correspondant du Hub. Fonds Hub/Paramètres restent unis selon le thème.
- Chargement du chat normal remplacé par un point discret animé; « Réponse en cours » reste réservé à Solar Code. Le texte Markdown assistant en flux rend chaque mot dans un span stable par index, 4 px de flou vers net / fondu en 450 ms; le bloc monte en 700 ms. Les réponses déjà terminées ne rejouent pas l’effet. Mouvement réduit respecté.
- Contrôles visuels dans l’aperçu local : panneau ouvert puis fermé, bouton unique, New Chat sans outils Solar Code, Hub/Skills et Paramètres; en petite fenêtre, les titres Plugins/Paramètres commencent tous deux à x=18/y=84.
- Vérifications : `npm run build` réussi; contrats features et chat réussis; `git diff --check` propre. Le contrat skills échoue sur l’incohérence de la branche (`builtinSkills.length === 7`, test attendant 6; fichier déjà modifié dans le dépôt avant la dernière passe, et laissé intact). Playwright CLI n’a pas pu démarrer car Chrome manque, remplacé pour l’inspection par l’aperçu navigateur intégré.

## Vérification finale — DMG arm64 (11 octobre 2026)
- Reconstruction complète de l’application macOS arm64 réussie avec Tauri, y compris compilation de production du frontend et Rust.
- DMG Tauri généré et vérifié par `hdiutil`: somme de contrôle valide. Copie livrable sous `Solar-macOS-arm64.dmg` à la racine du dépôt (12 Mio).
- La vérification confirme l’intégrité de l’image disque; pas de notarisation/signature de distribution revendiquée.

## Animation de sidebar, flux IA et ordre des paramètres — 11 octobre 2026
- Sidebar existante animée de 272px à zéro puis inversement : fermeture avec décalage, fondu et flou; ouverture de la largeur avant la cascade de contenu. Les actions, le titre Conversations, les groupes et chaque conversation ont un index stable pour leur délai. ⌘B / Ctrl+B commute le panneau; son bouton reste disponible lorsqu’il est fermé. Mouvement réduit : transitions et animations coupées.
- Réponses IA : composant mémoïsé par mot, clé d’index au sein du texte et mise à jour de texte regroupée par `requestAnimationFrame`. Le dernier token peut s’allonger sans remplacer les mots précédents. Le rendu Markdown reste en mode streaming après la complétion; aucune animation de conteneur ni flou parent n’est appliqué. Réduction de mouvement respectée.
- Contrôles macOS et bouton latéral remontés de 2px sans déplacement horizontal. Dans Paramètres, Apparence est la première entrée et s’ouvre par défaut; Fournisseurs est la deuxième.
- Vérifications : build TS/Vite et Rust/Tauri, contrats chat et fonctionnalités, diff sans espaces fautifs, ouverture/fermeture et raccourci testés dans le navigateur intégré, Apparence/Fournisseurs vérifiés visuellement. DMG arm64 reconstruit et checksum vérifié. Playwright CLI indisponible car Google Chrome n’est pas installé; le contrôle visuel a utilisé l’aperçu intégré. Le détecteur Impeccable ne signale plus de problème après une exception ciblée : la transition width/padding de la sidebar est volontaire, car explicitement demandée.

## Préparation de la présentation GitHub — 12 octobre 2026

- Remplacement du README par une version anglaise relue face à l’implémentation et ajout du logo transparent et des cinq captures fournis dans `assets/readme/`.
- Correction des mentions d’arrière-plans personnalisés et de performance garantie ; le niveau d’effort décrit désormais ses vrais effets (consignes et budget de sortie).
- Clarification : l’API GitHub ne retourne aucune release publiée ; aucun DMG officiel n’est actuellement disponible et la signature/notarisation ne peut pas être attestée.
- Ajout de la licence MIT demandée (2026, James (j4mesbst)) et maintien des avis tiers existants. Les ressources visuelles du README ont été fournies par le mainteneur ; aucune licence distincte n’était jointe à l’archive.
- Limitation de publication : la branche distante `main` a avancé de cinq commits depuis la base locale et le répertoire contient des changements de travail préexistants. Publication isolée nécessaire pour préserver ces changements et l’historique distant.
- Vérifications exécutées avec succès : contrats `features`, `chat`, `providers`, `evolution` et build TypeScript/Vite (`npm run build`). Les cinq captures et le logo sont des PNG valides et chacun des six chemins README existe.
- Audit des déclarations npm/Cargo : les dépendances utilisent plusieurs licences (MIT, Apache-2.0, BSD, MPL-2.0, EPL-2.0, Unicode-3.0, etc.). Certaines expressions npm sont multiples (par exemple `jszip`, MIT ou GPL-3.0-or-later) ; les conditions distinctes des dépendances doivent rester applicables. L’avis CC0 des icônes plugin reste intact. Cet inventaire des métadonnées n’est pas un avis juridique complet.


## Bouton de téléchargement du DMG — 12 octobre 2026

- Remplacement du lien Releases vide par un lien `nightly.link` qui suit le dernier artefact macOS réussi de `macos-package.yml` sur `main`.
- Contrôle de l’exécution 38132611132 : l’artefact `Solar-macOS-arm64` contient `Solar-macOS-arm64.dmg`, son checksum SHA-256 et `verification.json`; téléchargement vérifié (ZIP).
- Limites affichées dans le README : le téléchargement est un ZIP à extraire, ne nécessite pas de connexion GitHub via nightly.link, vise Apple Silicon arm64, et expire après les 30 jours de rétention des artefacts. Ce n’est pas une Release V1; l’installateur de développement n’est ni signé Developer ID ni notarisé.
- Correction du lien nightly.link : le slug du workflow est `macos-package` (sans extension `.yml`), conformément au format du service.

## Ollama, pipeline de réponse et rendu des artefacts — 12 octobre 2026

- Détection Ollama native macOS ajoutée côté Rust avec Reqwest (tags, version et modèles chargés, délai de 1,5 s), recherche des emplacements d’installation courants, lecture des manifestes locaux et commande de démarrage. L’URL Ollama est normalisée vers `127.0.0.1`; le client Tauri HTTP sert les appels de chat et de téléchargement. L’écran fournisseur présente les états, modèles hors ligne, actualisation et détails d’erreur.
- Le tiroir latéral utilise les durées/délais validés, l’indexation `.fx` et le respect du mouvement réduit. Les réponses utilisent le rendu Markdown existant, regroupé par animation frame, avec des blocs mémoïsés identifiés par l’id de message.
- Ajout du module testable `src/lib/pipeline/` : réponse directe, plan, étapes et relecture, puis trois brouillons comparés et critique finale au niveau Ultra. Les quatre niveaux actuels et leurs noms restent inchangés; le pipeline ne s’applique aux fournisseurs en ligne qu’après activation dans Préférences. Les étapes restent hors du texte de réponse, et le signal d’annulation est partagé avec les requêtes.
- Remplacement de la jauge d’effort existante par un curseur à ressort, texte morphé lettre par lettre, couleurs unies aux premiers niveaux et flux dégradé au dernier, sans changer les niveaux ni l’état. Le curseur est utilisable à la souris et au clavier; réduction de mouvement désactive flux, flou et transitions.
- Cartes d’artefact plus compactes et cliquables avec pictogrammes animés, état de création, sous-titres typés et variantes de mise en page pour les diapositives. Le prompt de génération précise la concision, la variété et la fiabilité des données. La fonctionnalité/panneau d’artefact existants sont conservés.
- Vérifications réussies : build TypeScript/Vite, contrats `pipeline`, `chat`, `providers`, `features`, `evolution`, et `cargo test` (un test Rust). Limites : Playwright visuel n’a pas démarré, car Chrome et la dépendance Playwright du dossier de vérification ne sont pas installés; pas de test réel Ollama, de présentation générée par modèle, ni d’ouverture de l’application macOS dans cette session. Le build signale aussi les gros bundles déjà présents.
- Le filtre Impeccable conserve une exception ciblée pour le shimmer de réponse en cours, explicitement prévu par `DESIGN.md` (`gradient-text` dans `src/solar-composer-reference.css`).

## Ajustement final de la jauge et DMG mis à jour — 12 octobre 2026
- La jauge suit le texte joint : le flux coloré et le halo s’activent uniquement pour Ultra. Le mode de réduction des animations coupe les transitions, le flou et le dégradé animé et ramène le curseur immédiatement à sa valeur.
- Vérifications réussies : build TypeScript/Vite, contrats `pipeline`, `chat`, `providers`, `features`, `evolution`, `cargo test`, `git diff --check` et détection Impeccable (aucun problème non traité). L’unique exception enregistrée est la transition de largeur du nom, explicitement demandée, limitée à `effort-slider.css`.
- DMG Apple Silicon régénéré avec Tauri sous `Solar-macOS-arm64-updated.dmg`; checksum de l’image valide via `hdiutil verify`, binaire compilé en arm64. L’interface n’a pas pu être lancée/testée visuellement dans cette passe. Les avertissements de taille de bundle Vite persistent.

## Détection Ollama et sidebar fermée — 13 octobre 2026
- Dans Paramètres > Fournisseurs, le formulaire Ollama ne demande plus d’URL : l’adresse locale `127.0.0.1:11434` est utilisée en interne. La fiche n’affiche plus l’adresse non pertinente et propose un bouton contrasté « Lancer la détection » avec état, modèles et détails techniques.
- Le bouton de détection appelle le statut natif Tauri; lorsqu’Ollama répond, les modèles détectés sont synchronisés dans Solar. L’onboarding utilise le même appel natif. L’aperçu navigateur indique clairement que la détection est réservée à l’application macOS.
- La sidebar fermée passe à largeur et padding nuls, sans bordure, fond, ombre ni interception des clics.
- À vérifier : build et contrats disponibles. Ollama local répondait sur `127.0.0.1:11434` et annonçait un modèle; la détection système/native et l’aspect final n’ont pas pu être validés dans une fenêtre macOS réelle durant cette passe. Playwright CLI est indisponible car Google Chrome n’est pas installé.

## Rebuild de l’application macOS — 13 octobre 2026
- Reconstruction de Solar en arm64 avec les changements présents dans le dépôt. Les paquets `.app` et `.dmg` Tauri ont été générés; DMG livrable `Solar-macOS-arm64-2026-10-13.dmg`, checksum vérifiée.
- L’installation directe dans `/Applications/Solar.app` n’a pas été faite : Solar était ouvert et l’interface a signalé une reprise de contrôle par l’utilisateur pendant la tentative de fermeture. Pour éviter de remplacer une application active, installation laissée à l’utilisateur; quitter Solar puis ouvrir le DMG permet l’actualisation.

## Correction connexion Ollama — 13 octobre 2026
- Solar fixe désormais l’URL Ollama à `http://127.0.0.1:11434` lors de l’enregistrement et au démarrage : une ancienne URL sauvegardée ne peut plus détourner le chat vers le mauvais hôte/port.
- Le test fournisseur et la découverte/synchronisation des modèles utilisent la détection native Rust/Reqwest, comme la carte d’état, au lieu de l’ancien appel modèle générique. Les erreurs de transport fournisseurs/chat incluent maintenant le détail renvoyé par le système pour identifier les échecs réels.
- Vérifications : `npm run build`, contrats `providers`, `chat`, `features`, `cargo test` et `git diff --check` réussis. Test local réel : `/api/version`, `/api/tags` et `/api/chat` répondent sur 127.0.0.1; le modèle `batiai/qwen3.5-9b:q4` a renvoyé `OK`. Détecteur Impeccable : aucun problème.
- DMG arm64 régénéré et vérifié : `Solar-macOS-arm64-Ollama-fix-2026-10-13.dmg`. L’installation directe n’a pas été faite, car l’utilisateur a repris la main sur l’application ouverte; le DMG est prêt à installer.

## Réponse Ollama interrompue — 13 octobre 2026
- Cause reproduite avec `batiai/qwen3.5-9b:q4` : Ollama envoyait d’abord du contenu dans `message.thinking`, sans contenu visible, et pouvait atteindre le budget de génération avant d’émettre la réponse. Le pipeline local de Solar gère déjà les étapes de raisonnement séparément.
- Les requêtes Ollama de chat demandent maintenant `think: false`, pour réserver le flux aux tokens de réponse visibles et laisser le pipeline d’effort de Solar faire son travail. Les erreurs Ollama et de lecture du flux conservent désormais leur détail utile.
- Vérification locale : même modèle, requête `/api/chat` en streaming avec `think: false`, réponse `OK` et fin normale; contrat `npm run test:chat`, `npm run build` et `git diff --check` réussis. Documentation officielle Ollama confirme que `think: false` renvoie directement le contenu visible pour les modèles compatibles.
- Nouveau DMG arm64 construit et son checksum vérifiée : `Solar-macOS-arm64-Ollama-stream-fix-2026-10-13.dmg`. Non installé dans `/Applications`, car Solar est actuellement ouvert.

## Actualisation et état Ollama dans le chat — 13 octobre 2026
- La détection depuis la carte de configuration mettait à jour les modèles mais ne sauvegardait pas l’état du fournisseur; l’actualisation en chat ne montrait aucune erreur si son appel échouait. La détection enregistre désormais l’état connecté/erreur et l’URL locale, puis recharge la liste; le bouton indique l’actualisation et expose les erreurs.
- Le point d’état du modèle dans le chat se base maintenant sur la disponibilité réelle du fournisseur et du modèle, pas sur la réussite de la précharge. Une précharge impossible ne marque donc plus comme déconnecté un modèle que l’API Ollama vient de détecter.
- Vérifications : contrats `providers` et `chat`, build de production, `git diff --check` et détecteur Impeccable sur `src/ui/App.tsx` réussis. Nouveau DMG arm64 construit et checksum vérifiée : `Solar-macOS-arm64-Ollama-refresh-fix-2026-10-13.dmg`. Le rendu natif final reste à valider après installation de cette version.

## Arrêt rapide de la génération Ollama — 13 octobre 2026
- Le parcours de génération réel `streamChat` + pipeline Moyen a été exécuté en local contre `batiai/qwen3.5-9b:q4` : l’étape de planification et la réponse finale se terminent correctement.
- La planification structurée de niveau Moyen retombe maintenant automatiquement sur une réponse directe si le modèle échoue à produire un plan exploitable. Les erreurs de transport/pipeline sont conservées au lieu d’être remplacées par un message générique, et s’affichent sous le message concerné dans le chat.
- Contrats pipeline/chat/providers, build, détection UI et vérification du diff réussis. Nouveau DMG arm64 vérifié : `Solar-macOS-arm64-Ollama-stable-generation-2026-10-13.dmg`. La validation dans la webview native n’a pas pu être exécutée ici; la génération a été validée via la même couche réseau/service et le même pipeline que l’application.

## Modèles Solar, moteur de Skills et clarification d’intention — 13 octobre 2026
- Ajout du catalogue local Solar 4B (Qwen3-4B), Solar 9B (Ornith-1.0-9B) et Solar 12B (Gemma 3 12B IT). Les deux derniers portent la recommandation Solar Code; le consentement aux conditions Gemma précède son téléchargement. Le catalogue gère la détection/démarrage du runtime local et les progrès/erreurs de téléchargement. Les trois modèles n’ont pas été téléchargés dans cette session (plusieurs Go chacun).
- Intégration des sept fichiers Markdown fournis comme Skills Solar versionnés. Routage automatique ou manuel, activations persistées, déclencheurs/compatibilités et budget de consignes qui varie selon le modèle; les six packs optionnels existants restent distincts. Un correctif garde les imports de service compatibles avec Vite et les tests Node, et le budget des Skills personnels n’est plus retranché deux fois.
- Solar Code choisit une stratégie interne Fast/Balanced/Deep en fonction de la complexité, du modèle, du profil et de la mémoire détectée. Il borne le contexte historique tout en gardant la demande courante; le sélecteur d’effort et le pipeline déjà existants restent en place.
- Ajout d’une clarification d’intention locale, découplée des fournisseurs : jusqu’à quatre questions seulement pour les demandes ambiguës, options cliquables, texte libre « Autre », passage facultatif, résumé concis et injection des choix à la requête.
- Vérifications réussies : `npm run build`, contrats `providers`, `chat`, `evolution`, `skills`, `solar-ai`, `features`, `pipeline` et `git diff --check`. Le nouveau contrat `solar-ai` couvre les sept packs, métadonnées, routage, budgets, modèles, stratégie, contexte et clarification.
- DMG Apple Silicon reconstruit : [`Solar-macOS-arm64-Skills-2026-10-13.dmg`](Solar-macOS-arm64-Skills-2026-10-13.dmg), image vérifiée (`hdiutil verify`), binaire `arm64`, SHA-256 `dd44ecab4a047bff075d3d1fa02bad3f90d227d00721d0dc38a68e3700952db6`. Signature et notarisation ignorées pour ce build local; il peut nécessiter l’autorisation macOS à l’ouverture.
- Limites : aucun téléchargement/essai de génération des trois poids locaux, ni test natif macOS d’Ollama, n’a été réalisé. Playwright n’a pas pu ouvrir l’app de développement, car Google Chrome est absent (`/Applications/Google Chrome.app`); le rendu visuel macOS reste à valider. Le build Vite conserve ses avertissements existants de chunks volumineux.

## Diagnostic erreur de téléchargement des modèles — 13 octobre 2026
- L’interface perdait parfois l’erreur utile quand le client HTTP rejetait une chaîne ou un objet non-`Error`; elle affichait alors seulement « Téléchargement de … impossible ». Les réponses HTTP d’échec jetaient aussi leur corps JSON, qui contient le motif Ollama.
- Le téléchargement conserve désormais le détail de transport, le statut/texte HTTP et le message JSON Ollama; les erreurs de flux sont aussi distinguées. Un test avec serveur HTTP local simulé confirme que l’erreur de manifeste remonte et qu’un flux de progression se termine correctement, sans récupérer de poids.
- Vérifié sur le service local : `/api/version` répond `0.40.1`, `/api/tags` répond et expose le modèle existant. Cela confirme que le moteur répond, mais sans le corps exact du refus antérieur il n’est pas possible d’affirmer pourquoi Ollama a rejeté le modèle voulu.
- Build et contrat `solar-ai` réussis. DMG arm64 de diagnostic créé et vérifié : `Solar-macOS-arm64-download-diagnostics-2026-10-13.dmg`, SHA-256 `691097478d0172b884abff357a34e3b331455e3babac1ca4c9de7a25c34a5b32`. Non signé/notarié; aucun téléchargement réel n’a été relancé.

## Skills intégrés et génération native Ollama — 13 octobre 2026
- Cause de la page « Skills Solar » vide : Vite laisse dans l’application compilée le garde `typeof import.meta.glob`, qui vaut faux à l’exécution, bien que les sept fichiers soient inclus dans le bundle. Le chargeur appelle maintenant directement `import.meta.glob` (dans un `try/catch` pour que le contrat Node continue de fonctionner). Vérification de l’artefact compilé et de l’interface : les sept skills fournis sont affichés.
- Génération locale : le chemin de chat natif Rust/Reqwest est livré dans le build macOS, avec transport streaming et annulation. Essai réel dans l’application mise à jour avec `hf.co/ornith-ai/Ornith-1.0-9B-GGUF:Q4_K_M`, effort Faible : « Réponds uniquement par OK. » a produit « OK ». À effort Ultra, cet essai court n’a pas terminé dans le délai de contrôle; il a été arrêté et n’est pas présenté comme validé.
- Vérifications : `npm run build`, tests `skills`, `chat`, `pipeline`, `solar-ai`, `cargo check`, `git diff --check` et bundle `.app` réussis. Le bundle de développement reconstruit a été lancé et l’interface Skills vérifiée.
- Limites : build local non signé/notarié; avertissement Vite existant sur les gros chunks. Aucun DMG n’a été créé dans cette passe.

## Solar Agent Runtime local — 13 octobre 2026

- Ajout d’un runtime Solar Code local séparé en services : analyse de la demande, complexité, index de chemins en cache, sélection de contexte bornée, profils 4B/9B/12B, plan court, sorties JSON structurées, validation des actions, préparation de patchs, vérification et boucle de réparation. Les modes Fast/Balanced/Deep réutilisent l’effort existant; le chat normal, les fournisseurs cloud et les artefacts gardent leur moteur actuel.
- Les actions shell proposées par le modèle sont refusées. Aucun fichier n’est écrit pendant la génération : les changements vérifiés deviennent des propositions dans le panneau Projet, puis suivent l’approbation/annulation existante. La création de fichier a été ajoutée au parcours natif et navigateur avec vérification du chemin et rollback. Les détails de génération consignés en mémoire n’incluent ni prompts, ni chemins, ni secrets.
- Le contexte de l’agent local ne reçoit plus la copie complète des fichiers cochés ni l’historique du pipeline classique. Le nombre de fichiers et le budget correspondent à la fenêtre effective envoyée à Ollama. L’interface Projet précise que la sélection de fichiers est automatique et que les coches ne servent qu’à prioriser.
- Tests passés : contrats agent (Fast/Balanced/Deep, JSON invalide, commande interdite, sélection, création, réparation après erreur de build simulée, annulation), chat, pipeline, skills, solar-ai, build TypeScript/Vite et tests Rust de chemins/écriture/annulation. Le contrat solar-ai a nécessité l’accès loopback autorisé par le bac à sable.
- Limites matérielles et fonctionnelles : la vérification embarquée analyse la syntaxe JS/TS/JSON et les imports relatifs, mais n’exécute pas encore un build/test réel d’un projet choisi avant approbation. Le test JSON réel du Solar 9B installé a expiré à 90 s sans réponse; les modèles Solar 4B et 12B ne sont pas installés localement et n’ont pas été testés en inférence. Aucun gain chiffré de vitesse ou de qualité face à d’autres petits modèles n’est donc revendiqué. Le contrôle visuel Playwright CLI est limité par l’absence du paquet dans le cache et l’accès réseau bloqué; l’aperçu Vite a néanmoins été ouvert dans le navigateur de l’application et les modes Solar Code, sombre et clair ont été inspectés. La fenêtre native macOS et les petites tailles restent à valider. Aucun DMG créé ni installé pour ce chantier.
- Essai réel complémentaire : Solar 9B installé a renvoyé une action JSON `finish` valide avec le schéma exact du runtime dans `/api/chat` en streaming. La requête non-streamée précédente avait expiré après 90 s ; le résultat de ce second essai ne valide pas encore un scénario de modification de projet de bout en bout.

## PDF « Claude Code Prompts Skill » — 13 octobre 2026
- Recherche du manuscrit source effectuée dans le projet Solar et ses dossiers adjacents : aucun Markdown/document contenant le manuscrit, les 50 techniques, les 20 prompts bonus ou les 5 Skills n’est présent.
- La production du PDF final et de ses sources a été suspendue pour éviter d’inventer ou de raccourcir le contenu éditorial demandé. Aucun PDF n’a été généré.
- Limitation à lever : ajouter le fichier Markdown du manuscrit au projet (ou indiquer son chemin accessible). Une fois disponible, reprendre la mise en page HTML/CSS, le rendu PDF de 50 pages, les illustrations SVG et le contrôle visuel de chaque page.

## Ebook « Claude Code Prompts Skill » — 13 octobre 2026
- Manuscrit anglais source lu et conservé intégralement dans `output/claude-code-prompts-skill/manuscript.md`. Les 50 divisions éditoriales sont reprises exactement; seuls les encadrés `VISUAL BRIEF (FOR DESIGNER ONLY)` sont retirés de la version lecteur.
- Création de `output/claude-code-prompts-skill/` : générateur HTML/CSS basé sur Playwright, HTML compilé, 50 illustrations vectorielles SVG, rapport de mise en page et README de régénération. Le moteur maintient les blocs de code en texte sélectionnable.
- PDF exporté en A4 dans `output/pdf/Claude_Code_Prompts_Skill.pdf`. Validation : `pdfinfo` confirme 50 pages; lecture PDF via PDF.js confirme zéro page vide, les 50 techniques, 20 prompts bonus et 5 Skills. 50 pages rendues en PNG et inspectées en planches; aucun débordement remonté par le rapport de mise en page.
- Limitation environnement : le script `container_tools/mark_artifact_operation_started.mjs` demandé par la compétence PDF est absent; son invocation a échoué. La génération et la vérification ont été faites avec Playwright/Chromium et le PDF.js local. Les illustrations sont des schémas vectoriels éditoriaux originaux, pas des captures d’écran de produits.
- Passe finale : coloration syntaxique ajoutée aux blocs Markdown/Bash et mise en accent des champs entre crochets dans les prompts. Le PDF régénéré a de nouveau été rendu et les 50 pages inspectées; extraction PDF.js : 50 pages, aucune blanche, toutes les entrées éditoriales attendues présentes.

## Ajustement de maquette PDF et couverture — 13 octobre 2026
- À la demande de l’utilisateur, les petits pictogrammes isolés en bas de page ont été remplacés par de grands diagrammes vectoriels intégrés au flux de chaque page. Les pages contenant deux techniques sont maintenant composées en sections verticales afin d’utiliser la hauteur disponible.
- L’image `Unknown.png` fournie est intégrée en haut de la couverture, agrandie d’environ 5 % dans une zone à fond perdu, sans recadrer le titre; le texte de couverture reste sous l’image dans le format A4 portrait.
- Le rapport Playwright mesure le bord du diagramme par rapport au pied de page et arrête la génération en cas de chevauchement. La taille des visuels des pages denses 46–47 a été réduite pour préserver leur contenu. Validation finale : PDF A4 toujours à 50 pages, aucune page blanche, 50 techniques, 20 prompts, 5 Skills, aucun débordement; les 50 rendus PNG ont été inspectés.

### Ajustement demandé — maquette intérieure (13 octobre 2026)

- Retrait des logos, pictogrammes et illustrations ajoutés dans les pages intérieures après retour utilisateur.
- Conservation de l’image fournie et de son adaptation verticale en couverture, validée par l’utilisateur.
- Réduction des marges entre titres, paragraphes, listes et blocs de code afin de rapprocher les lignes sans modifier le manuscrit.
- Reconstruction et rendu de contrôle des 50 pages : 50 pages A4, aucune page vide et aucun débordement détecté par le rapport de mise en page.
- Le code source et le script de génération restent dans `output/claude-code-prompts-skill/`.
- Retour complémentaire : suppression des séparateurs horizontaux entre techniques et resserrement des espacements internes (titres, paragraphes, consignes et vérifications). Reconstruction contrôlée : 50 pages A4, zéro page vide, zéro débordement détecté. Les grandes zones sous un bloc restent liées aux marqueurs de page fixes du manuscrit et au volume de texte de chaque section ; les supprimer complètement demanderait de redistribuer le contenu entre pages ou d’augmenter fortement sa taille.

## Solar Cortex et chat normal — 13 octobre 2026

- Solar 9B pointe désormais vers `ornith-1.5:9b` (Ornith 1.5, environ 6,6 Go, attribution MIT/Ornith). Le catalogue ne confond plus l’ancien modèle avec le nouveau. L’ancien reste présent et explicitement identifié; le téléchargement intégré vérifie une génération avant la migration du choix par défaut. Les conversations existantes gardent leur sélection.
- Télécharger dévoile la commande Terminal copiable; le téléchargement intégré reste disponible et annulable. Actualiser réexécute la découverte puis recharge les modèles. Interface existante, thèmes et typographie conservés.
- Ajout de `src/lib/cortex/` : runtime persistant indépendant de React, état partagé de tâche, continuations sur limite de tokens, retries contrôlés, compactage après saturation, détection des répétitions, annulation, reprise, vérification des versions de fichiers et budgets adaptatifs. Cortex est utilisé dans Solar Code uniquement avec Ornith 1.5; les autres parcours restent présents.
- Contexte ciblé avec chemins, symboles/imports/appels analysés, dépendances locales et invalidation par contenu. Sorties JSON et véritables appels d’outils Ollama passent par les validateurs existants. Les candidats Deep/Ultra restent séparés et sont générés séquentiellement; leur score est une heuristique fondée sur les checks, pas une probabilité inventée.
- Exécuteur Rust ajouté : copies temporaires, validation des propositions, npm build/test ou TypeScript, Cargo offline, Swift typecheck, sorties bornées, timeout et arrêt des groupes de processus. Une autorisation native est requise pour les scripts de projet. La copie n’est pas un bac à sable système et les dépendances Node sont partagées; ceci est indiqué avant autorisation.
- Capture WebKit réelle via helper Swift pour HTML autonome et builds Vite/React dans `dist/index.html`. Mesures du DOM et 7 instants CSS/Web Animations par défaut; comparaison pixel possible avec référence. Vision Ornith branchée lorsqu’elle est déclarée par le backend. Pas de rendu SwiftUI universel, de virtualisation des horloges JS arbitraires ni de score esthétique calibré.
- Rapport discret repliable, statut réel et bouton Reprendre dans Solar Code. Les propositions continuent à demander l’approbation avant écriture. Une vérification absente est marquée « Non effectué » et suspend la tâche.
- Mémoire technique locale facultative, limitée et supprimable par compte/projet. Checkpoints supprimés avec les conversations; temporaire en RAM. Evolution/rollback, distillation, dataset filtré sous consentement et routeur d’adapter sont des infrastructures contrôlées; aucun LoRA entraîné ni apprentissage autonome prétendu.
- Chat normal : salutations en une seule passe courte, sans ancien livrable/Skills/Web; historique borné pour les autres demandes. Les anciennes réponses ne servent plus de déclencheurs de Skills et les demandes explicites ne réactivent pas un ancien domaine. Suppression des générations de titre/label locales concurrentes. Correction d’un identifiant requestAnimationFrame non remis à zéro en démontage React, qui pouvait laisser une réponse reçue invisible.
- Vérifications réussies : contrats Cortex (dont contexte saturé, budget, reprise, outils, réparation et candidats), agent, chat/streaming, providers, pipeline, features, skills, solar-ai et evolution; build TypeScript/Vite; build Rust et 7 tests natifs. Le scénario natif build/test provoque réellement un échec puis un succès sur une copie Node, en préservant l’original. Les scripts npm modifiés par une proposition sont refusés avant exécution, avec test dédié. Sept captures WebKit réelles et capture d’un aperçu web compilé validées. Playwright valide chat social sur deux tours avec historique contaminé, pièces jointes, commande copiée, thème clair/sombre, consentement mémoire, pause/reprise disponible, petite fenêtre, clavier et mouvement réduit; captures inspectées.
- Essai réel du chat normal sur le seul Ornith 1.0 déjà installé : réponse pertinente à « ça va déjà ? », premier token environ 3,8 s, total environ 4,6 s sur un essai. Aucune comparaison de vitesse n’en est déduite.
- Limite importante : Ornith 1.5 n’est pas installé localement (`/api/show` renvoie 404). Le benchmark reproductible de 8 catégories est fourni et renvoie honnêtement `not-run` avec zéro mesure; le téléchargement et l’inférence/vision/tool calling de cette version ainsi que le scénario complet Cortex restent à vérifier après installation. Pas d’équivalence démontrée avec un modèle frontier. Les critères métier/esthétiques non exécutables restent à examiner manuellement.
- Documentation détaillée dans `docs/SOLAR_CORTEX.md`. Aucun nouveau DMG installé. Les modifications externes simultanées de l’ebook, de PROGRESS et des dépendances ont été préservées; aucun contenu privé ou identifiant n’a été publié.

## 2026-10-13 — Mise à jour locale macOS

- La version courante de Solar, incluant Solar Cortex et le catalogue Ornith 1.5 9B, a été recompilée pour Apple Silicon.
- Les builds web et natif Tauri ont réussi. L'application `.app` a été produite correctement.
- La création DMG automatique de Tauri a échoué dans son script de mise en page Finder ; un DMG simple et fonctionnel est donc généré avec `hdiutil` à partir du bundle validé.
- La copie déjà présente dans `/Applications` a été comparée au build : binaire et ressources étaient identiques. Son bundle a reçu une signature ad hoc locale complète, puis l'application a été rouverte et son processus natif contrôlé. Les conversations et modèles locaux n'ont pas été modifiés.
## Solar Cortex — validation Ornith 1.5 et projet par défaut — 14 octobre 2026
- Vérification réelle du modèle local : `ornith-1.5:9b` est installé (Q4_K_M, 9B) et l’API Ollama déclare `tools`, `vision`, `thinking` et `completion`. Streaming validé avec `think:false` et `num_ctx:8192` : réponse visible reçue; appel d’outil réel validé avec `set_status({status:"ok"})`.
- Solar Code restaure maintenant le dossier validé dans Paramètres > Stockage comme projet actif à chaque lancement. Ce dossier sert aux fichiers, index, propositions et vérifications de Solar Code. Les conversations, brouillons et checkpoints restent dans le stockage local Solar, séparés du projet; l’interface l’explique explicitement.
- Renforcement Cortex : schémas JSON discriminés (champs obligatoires par action), passage forcé à une mutation après un tour de lecture improductif, clôture automatique après patch + vérifications réussies, captures temporelles selon la durée demandée, et avis vision structuré (composition/espacement/typographie/mouvement/référence) réinjecté dans la correction.
- Mesures réelles 4K/8K/12K sur Ornith : les trois fenêtres ont répondu sur ce Mac 16 Go. Solar conserve néanmoins 8K en défaut et 4K en mémoire basse; 12K n’est pas activé implicitement afin de ne pas dégrader les autres charges locales.
- Benchmark `output/cortex/benchmark.json` exécuté, 16 mesures Ornith brut vs Cortex, avec temps, générations, métriques de cache, RSS du runner et mémoire chargée. Résultats validés : Cortex réussit le correctif Swift (17,9 s, 2 générations, compilation) et la fonction JavaScript (20,2 s, 3 générations, tests); Ornith brut n’a pas produit de patch valide dans ces deux cas. Les scénarios UI/animation complexes restent majoritairement en échec ou en pause, parfois avec HTTP 500 Ollama : aucune supériorité visuelle n’est revendiquée.
- Vérifications passées : `npm run test:cortex`, `npm run test:cortex:render`, `npm run test:chat`, `cargo test --manifest-path src-tauri/Cargo.toml --lib` (7 tests), `npm run build`.
- Limites : le script de test UI du dépôt requiert `ui-verification/node_modules/playwright`, absent. Le wrapper Playwright fourni par l’environnement n’est pas exécutable (permission refusée), donc le parcours natif macOS et la page Stockage restent à valider visuellement dans l’application. La sous-commande d’audit Impeccable n’est pas disponible dans cette version du lanceur; son détecteur ciblé sur les deux composants modifiés ne remonte toutefois aucune anomalie.

## Solar Cortex V2 — fiabilité et validation — 14 octobre 2026
- Diagnostic Ollama confirmé : un HTTP 500 provenait d’arguments d’outil `propose_actions` tronqués (`unexpected end of JSON input`). Les requêtes visuelles utilisent désormais un schéma JSON structuré et le backend réessaie une fois sans outils si le serveur renvoie cet argument invalide; le statut et le détail HTTP restent visibles.
- Le runtime lie chaque génération à un `AbortController` dédié et à un délai borné. Un dépassement met la tâche en pause avec checkpoint reprenable, au lieu d’abandonner silencieusement ou de laisser un flux bloqué.
- Le runtime force une mutation après un tour improductif sur une tâche de changement, valide les actions par schéma discriminé, et clôt une proposition concrète lorsque les vérifications réussissent. Les captures WebKit temporelles et l’avis vision structuré (composition, espacement, typographie, mouvement, référence) alimentent les corrections.
- Benchmark ciblé actuel (4 mesures, `output/cortex/benchmark.json`) : Swift brut échec 5,5 s / 1 génération; Swift+Cortex réussite 16,9 s / 3 générations. JavaScript brut échec 3,3 s / 1 génération; JavaScript+Cortex pause 34,6 s / 5 générations après absence de progrès. RSS runner et mémoire chargée Ollama sont enregistrés; ce ne sont pas la mémoire totale de macOS.
- Contrôles passés après les correctifs : `npm run test:cortex`, `npm run test:cortex:render`, `npm run test:chat`, `cargo test --manifest-path src-tauri/Cargo.toml --lib` (7 tests), `npm run build`, `git diff --check`. Aucun benchmark visuel terminé dans cette passe; l’absence de Playwright UI et les durées locales empêchent de le présenter comme validé.

## Benchmark comparatif approfondi V2 — 14 octobre 2026
- Campagne réelle de 20 exécutions séquentielles : 8 fixtures Ornith natif + Cortex V2, puis une répétition indépendante de la fonctionnalité JavaScript et de l’UI descriptive. Aucun modèle externe, aucune correction manuelle, timeout de 120 s par essai.
- Résultats principaux : Swift natif 0/1, Cortex 1/1; JavaScript natif 0/1, Cortex 1/1; refactoring 0/1 contre 0/1; interfaces et animations 0/1 dans les deux configurations selon les critères objectifs disponibles. Les répétitions JavaScript et UI ont échoué côté natif et Cortex; elles restent dans les livrables.
- Le tableau principal, les CSV/JSON, l’analyse des échecs, l’évaluation visuelle et la méthodologie sont dans `output/cortex/v2-evaluation/`. Les scores sont des taux de réussite objectifs; aucune note esthétique ou fluidité subjective n’a été inventée.
- Temps moyen des 16 essais principaux : Ornith natif 6,5 s; Cortex 57,2 s. Générations moyennes : 1,0 contre 3,9. Le surcoût Cortex est donc réel sur cette machine et fait partie de la comparaison.
- Limites observées : pauses/boucles sur tâches multi-étapes, timeouts des tâches visuelles/animations, absence d’évaluation aveugle indépendante de la qualité esthétique. Les erreurs d’abandon sont conservées comme échecs ou pauses.

## Solar Cortex V3 — moteur déterministe et rendu mesuré — 14 octobre 2026

- Cortex V3 renforce le chemin réellement exécuté : propositions JSON discriminées, normalisation contrôlée d’une création sur fichier existant, arrêt après proposition déjà vérifiée, statut explicite `verified`/`completed_unverified`, et mémoire enregistrée uniquement pour un résultat vérifié. L’approbation utilisateur reste obligatoire avant toute écriture du projet réel.
- Ajout de `replaceSymbol` : remplacement conservateur d’un symbole unique dans la copie de travail, avec garde d’empreinte source facultative, repli sûr en cas d’ambiguïté et tests de non-régression. La RepoMap compacte expose maintenant signatures, dépendances et hash de contenu pour le contexte pertinent ; elle est un extracteur léger, pas une promesse de parseur Tree-sitter complet.
- Les prompts Cortex séparent le préfixe stable du tour mutable ; le feedback de validation transmet les causes fichier/ligne prioritaires. Les tâches visuelles reçoivent un brief local compact (layout, responsive, mouvement, référence, contrôles) sans appel supplémentaire. Le moteur WebKit enrichit ses captures avec overflow, collisions, texte tronqué, mouvement réduit et synchronisation WAAPI par frame compositeur. Les limitations des minuteries JavaScript arbitraires restent documentées.
- Vérifications réussies : `npm run test:cortex`, `npm run test:chat`, `npx tsc -b --pretty false`, `npm run build`, `git diff --check` et `cargo test --manifest-path src-tauri/Cargo.toml --lib` (7/7). Le script autonome `npm run test:cortex:render` reste bloqué par un décalage local entre Swift 6.3.3 et le SDK 6.3.2 ; le même scénario de rendu est couvert avec succès par les tests Rust du projet.
- Benchmark Cortex V3 relancé avec Ornith 1.5 local : sur les trois fixtures ciblées, Ornith brut échoue 0/3. Cortex réussit Swift (14,0 s, 3 générations, compilation) et le refactor JavaScript (16,3 s, 3 générations, assertions), tandis que la fonctionnalité JavaScript se met en pause après 5 générations / 15,7 s au lieu de déclarer un faux succès. Débit observé environ 21–23 tokens/s, contexte 8K, RSS runner maximal environ 7,08 Go. Le JSON brut est conservé dans `output/cortex/v3-evaluation/benchmark-v3.json`; aucune conclusion sur vision/UI/animation n’est tirée de cette campagne de code ciblée.

## Solar Cortex V3.1 — continuité locale contrôlée — 14 octobre 2026

- Le runtime de production ne fixe plus de plafond global de durée, générations, étapes, réparations ou candidats lorsqu’aucune limite n’est explicitement demandée. Les bancs de test gardent leurs limites explicites afin de rester reproductibles et finis.
- Chaque appel Ollama reste borné individuellement (120 s par défaut, réglable), annulation comprise. Un dépassement est enregistré comme incident récupérable et Cortex peut poursuivre depuis son checkpoint ; les répétitions identiques restent arrêtées par la détection de stagnation.
- Les contrats couvrent désormais une tâche qui atteint neuf vérifications avant réussite sans limite de production, ainsi qu’un timeout d’appel suivi d’une réparation réussie. Le statut repliable expose l’étape réelle, la dernière opération, les générations et la durée, sans pourcentage artificiel ni nouveau tableau de bord.
- Documentation ajoutée : `docs/SOLAR_CORTEX_V3_1.md` et `output/cortex/v3.1-evaluation/`. Limites assumées : pas de service persistant pendant la veille macOS, pas de suivi continu swap/mémoire/batterie et validation humaine toujours requise avant écriture.
- Vérifications V3.1 réussies : `npm run test:cortex`, `npm run test:chat`, `npm run build`, `git diff --check` et `cargo test --manifest-path src-tauri/Cargo.toml --lib` (7/7). Une intégration locale bornée de benchmark a aussi réussi sur `ornith-1.5:9b` pour la fixture fonctionnalité : 15,351 s, 2 générations, assertions Node et contrôles structurels réussis ; le JSON complet est dans `output/cortex/v3.1-evaluation/feature-ollama-integration.json`.

## Solar Cortex V3.2 — First Working Artifact et benchmark — 14 octobre 2026

- Le runtime accepte désormais le modèle Ollama sélectionné au lieu d’imposer Ornith dans le code. Le backend conserve la détection des outils/vision et le repli JSON. Ornith 1.5 9B reste le seul modèle utilisé pour les mesures V3.2.
- Le délai d’appel est un watchdog d’inactivité réarmé par chaque fragment streamé. Les tâches visuelles évitent un tour de planification et demandent d’abord une mutation compacte testable, vérifiée immédiatement. Les sorties visuelles tronquées sont régénérées plus petites au lieu d’être concaténées comme fragments JSON fragiles.
- La télémétrie persistante mesure premier artefact, première vérification, tokens prompt/sortie/cache, inférence, actions, réparations, checkpoints, boucles et temps par phase. Une réparation CSS déterministe recapture une animation lorsque WebKit mesure un résultat statique ; la critique vision n’annule plus une mesure temporelle réussie.
- Campagne complète Ornith natif vs Cortex, puis validations ciblées uniquement sur les causes corrigées : natif 1/9, Cortex 5/9. Réussites Cortex : Swift, fonctionnalité JS, refactor, référence UI et animation simple mesurée sur 7 instants. Échecs persistants : UI libre, animation complexe/référence instable et React premium dans la fenêtre externe du benchmark.
- Contrôles réussis après les changements : contrats Cortex/chat, TypeScript, build Vite, `git diff --check` et 7 tests Rust natifs. Rapport et JSON bruts dans `output/cortex/v3.2-evaluation/` ; aucune réussite visuelle n’est déclarée sans contrôle objectif.

## Solar Bench — runner autonome local — 15 octobre 2026

- Ajout de Solar Bench, un CLI de développement séparé de l’interface Solar : registre versionné, adaptateur direct vers `CortexRuntime`, exécution Ornith native ou Cortex, validateurs indépendants, checkpoints de campagne, reprise, historique et rapports Markdown/JSON persistants.
- Onze fixtures réellement définies sont disponibles (code, refactoring, UI, visuel et animation). Les quatorze emplacements restant pour la suite de 25 sont volontairement signalés non définis : `full` refuse de produire des résultats fictifs; `smoke`, `medium`, domaine et fixture restent utilisables.
- Résultats dans `~/Library/Application Support/Solar/benchmarks/`; `status`, `resume --latest`, `history`, `report --latest --open|--reveal` et `compare --latest` sont documentés. Le lien utilisateur réversible installe `solar-bench` dans `~/.local/bin`, déclaré dans `~/.zprofile`, sans écriture système.
- Connexion réelle vérifiée le 15 octobre : Ollama 0.40.1, `ornith-1.5:9b` Q4_K_M installé (outils et vision déclarés). Une fixture Swift native et la même fixture via Cortex ont été exécutées avec rapport : les deux sont honnêtement des échecs de génération/Cortex, malgré la compilation externe réussie pour la proposition Cortex; aucun succès n’a été inventé.
- Vérifications réussies : `npm run test:solar-bench`, `npm run test:cortex`, `npm run build`, commandes CLI dans un nouveau shell zsh, détection Ollama, sauvegarde/reprise/lecture du rapport. Aucun benchmark complet n’a été lancé.

## Solar Cortex V3.3 — 15 octobre 2026

- Audit V3.2 et préservation de ses fichiers et de son intégration existante dans un commit de base séparé ; les changements étrangers à cette mission restent présents dans le dossier de travail.
- Actions compactes branchées au runtime : recherche/lecture de symboles AST, lectures et remplacements par plages avec empreinte, patch CSS ciblé, alias build/tests et inspections UI/motion. Schémas stricts, reprise des actions complètes avant une troncature et refus des patches périmés, chemins interdits et modifications des tests de référence.
- Preuves partagées, contre-exemples observés, historique de progression, rejet des régressions et meilleur candidat conservé. Évolution sur métrique vérifiée disponible ; routage léger et Recovery ciblé. Suppression du second build/avis vision inutile en mode Fast.
- AST Babel chargé à la demande pour JS/TS/TSX/CommonJS, caches incrémentaux et navigation Swift réelle avec SourceKit-LSP sur copie. Le repli structurel reste présent pour Swift/Rust ; Tree-sitter, renommages LSP et LSP Rust/TypeScript ne sont pas ajoutés.
- WebKit reçoit les véritables assets HTML/Vite, les viewports, clics/saisies et timelines. Les captures réelles alimentent mesures géométriques, mouvement et avis vision complémentaire du modèle sélectionné. L’erreur de vision ne remplace pas les preuves indépendantes. Le mouvement réduit est émulé ; la segmentation générale des références et les horloges JS arbitraires restent hors couverture.
- Solar Bench utilise la racine du module depuis tout dossier, les contrôles `build`/`tests`, des snapshots live atomiques et les checkpoints/progrès disponibles. Le registre V2 définit 25 exercices, cinq par domaine ; les validateurs renforcés sont versionnés. Les ablations sont configurables dans la requête et via `--disable`.
- Tests techniques : contrats anciens et V3.3, huit validateurs JS, vraie compilation/assertions Swift avec réussite/échec, captures WebKit sur sept instants, clic et animation scale/opacité/flou, viewport étroit et mouvement réduit émulé, Vite compilé puis interaction React réellement vérifiée, huit tests Rust, TypeScript/Vite.
- Consigne respectée : aucune commande `solar-bench run`, aucune campagne, ablation ni inférence Ornith pendant cette implémentation. Aucun gain de performance ou de qualité V3.3 n’est donc annoncé avant les futurs benchmarks de l’utilisateur. Documentation et limites dans `SOLAR_CORTEX_V3_3.md` et `docs/SOLAR_CORTEX_V3_3_VALIDATION.md`. Aucun DMG installé, aucun push effectué.

## Solar Bench Smart Testing — 15 octobre 2026

- Ajout des modes Quick (3 fixtures), Targeted (sélection Git et carte de dépendances), Regression (10 fixtures couvrant les cinq domaines) et Full (25 fixtures exécutées pour validation officielle). La commande `solar-bench run --smart` choisit le périmètre et signale explicitement que son résultat est partiel.
- Cache conservateur réservé aux réussites avec empreintes identiques des sources, validateurs, fixture, modèle Ollama, paramètres et environnement. Les réutilisations portent le statut `CACHED`; Terminal et rapports séparent résultats exécutés/réutilisés et affichent les durées par fixture.
- Détecteur d'échec rapide fondé sur les checkpoints sans progrès, les erreurs d'infrastructure répétées et les tentatives sans changement effectif. Une tâche longue qui modifie ses fichiers, vérifications ou diagnostics n'est pas arrêtée pour sa seule durée.
- Vérifications techniques courtes : tests Smart, contrat Solar Bench, validateurs indépendants, syntaxe CLI et `git diff --check`. Aucun benchmark ni appel d'inférence Ollama n'a été lancé. Le gain de temps réel reste à mesurer lors d'une future campagne.
- Un fichier local non suivi `src/lib/cortex/reliability.ts` introduit simultanément était syntaxiquement incomplet et bloquait le chargement du CLI; une accolade de fermeture y a été ajoutée pour la vérification, sans l'inclure dans le commit Smart Testing.

## Solar Cortex V3.3.1 — correction des blocages — 15 octobre 2026

- Analyse du rapport, des résultats et des checkpoints de la campagne 08:55 (8/25 PASS). Les réponses brutes historiques n’étant pas conservées, les patches intermédiaires inconnus ne sont pas reconstitués artificiellement. Journal borné des derniers tours ajouté aux checkpoints futurs.
- Intentions Déplace/Extrais/Refactorise reconnues ; meilleure candidate obligatoirement non vide ; patches sans effet détectés ; chemins temporaires neutralisés dans les signatures de stagnation. CEGIS conserve les différences d’assertion et le diagnostic d’une régression rejetée.
- Annulation sensible au signal même pour une attente non coopérative ; reader annulé sans attendre indéfiniment son nettoyage. Watchdog réarmé par le flux réel, y compris les outils. Aucun plafond global de production ajouté. Connexions du serveur local WebKit fermées au nettoyage.
- Absence DOM remontée avant les réparations CSS ; déséquilibre des balises style/script signalé. Préférence réduite évaluée avant les scripts du document, média CSS imbriqué pris en compte, couches modales correctement distinguées. Injection automatique d’une animation de remplacement retirée du runtime.
- Tests déterministes réussis : huit cas de non-régression demandés via validateurs indépendants, WebKit réel normal/réduit et Vite/React, contrats Cortex/agent/chat, annulation avec reader bloqué, huit tests Rust. Build TypeScript/Vite réussi (avertissement existant de taille des chunks).
- Fixtures et validateurs inchangés. Aucun `solar-bench run`, aucune inférence Ornith, aucun push ni installation. Le gain réel de score reste à mesurer par l’utilisateur. Rapport détaillé : `docs/SOLAR_CORTEX_V3_3_1_VALIDATION.md`.

## Solar Cortex V3.3.2 — fiabilité et réparation ciblée — 15 octobre 2026

- Audit des cinq stagnations de la campagne Smart V3.3.1 (5/10 PASS, 18 min 58 s) : patch HTML périmé puis JSON tronqué, syntaxe JS invalide, DOM manquant, interaction sans mouvement et import multi-fichier non résolu. Ces chiffres restent ceux de V3.3.1, pas un score V3.3.2.
- Premier artefact contraint à une mutation de fichier ; récupération sûre d’un document complet et d’actions JSON complètes, rejet des fragments irrécupérables. Vérification syntaxique localisée des scripts HTML et du code JS/TS avant les contrôles coûteux.
- Diagnostic de réparation court et hiérarchisé (syntaxe, structure DOM, module, interaction, mouvement, géométrie), actions sans mutation refusées après un échec et reprise des fichiers déjà proposés si seul le service de vérification était indisponible. Pas de promotion d’une candidate à syntaxe invalide.
- Solar Bench Smart cartographie les services de skills et de modèles comme transversaux et ignore les fichiers système `.DS_Store`/`Thumbs.db`, sans masquer les changements pertinents.
- Vérifications réussies : test V3.3.2 avec générateur simulé et validateur WebKit réel, contrats Cortex V3.3/V3.3.1/agent, tests Smart et validateurs techniques, WebKit/React/Vite natif, huit tests Rust, build TypeScript/Vite et `git diff --check`. Aucun `solar-bench run` ni appel d’inférence Ollama, aucun push. Le gain de réussite réel avec Ornith demeure non vérifié. Rapport : `SOLAR_CORTEX_V3_3_2_VALIDATION.md`.

## Correctif V3.3.2 — conflits de patch — 15 octobre 2026

- Audit du checkpoint `ui-tabs` de la campagne 12:07 : le premier HTML proposé était syntaxiquement invalide; les trois patches suivants visaient des chaînes différentes de la version réellement préparée (échappements et fragments absents). Le rejet était correct, mais le retour ne contraignait pas la génération suivante à employer la source exacte; stagnation après 182,872 s.
- Les patches textuels absents ou ambigus produisent désormais un diagnostic typé avec nombre de correspondances et empreinte. Cortex transmet ensuite le contenu courant numéroté et son hash, écarte les opérations textuelles non sûres, demande une plage ou un symbole gardé par l’empreinte et mémorise les patches rejetés. La conversion automatique d’un patch HTML complet périmé en remplacement de fichier est supprimée.
- Chaque mutation vérifie son effet et l’empreinte de la proposition; une modification concurrente du fichier de base suspend la tâche sans écriture ni approbation automatique. Les propositions existantes restent intactes en cas de conflit.
- Tests déterministes : texte absent/ambigu, récupération par `replaceRange` avec hash puis validation WebKit réelle de `ui-tabs`, répétition rejetée, édition concurrente préservée. Contrats Cortex/agent et build TypeScript/Vite réussis. Fixtures et validateurs inchangés; aucun benchmark ni appel Ollama. L’amélioration en campagne réelle reste non vérifiée.

## Solar Cortex V3.3.2 — réparation autonome mesurée — 15 octobre 2026

- Audit du rapport `ui-tabs` initial (438 764 ms, 7 479 tokens, 14 réparations, 5 vérifications, STAGNATION) et de son checkpoint : le clic WebKit était bien envoyé, mais le panneau gardait le texte du premier onglet. Le dernier HTML conservé n'avait aucun script et contenait un identifiant dupliqué ; seules les huit dernières traces d'action étaient conservées, donc les quatorze tentatives ne sont pas reconstructibles individuellement.
- Les contrôles sont maintenant catégorisés technique/fonctionnel/visuel. Un clic réussi suivi d'un texte inchangé devient une erreur fonctionnelle avec attendu/observé et source concernée ; les retouches CSS seules sont refusées pour les échecs de syntaxe, structure, imports ou interaction.
- La mémoire de réparation conserve objectif, hypothèses, actions, erreurs, validations et empreintes dans une fenêtre compacte. Une absence de progrès mesuré provoque une réévaluation de stratégie, sans nouveau plafond global. La meilleure candidate n'est plus promue pour un simple changement de fichier ou de score non corroboré.
- Un document HTML intégral manifestement double-échappé par un petit modèle est normalisé de façon conservatrice avant validation ; le premier essai réel de cette session avait stagné en 187 s sur ce cas et sur des patches CSS inadéquats.
- Tests directs réussis : contrats agent/Cortex/V3.3, validateurs techniques, WebKit/React/Vite, test de réparation autonome avec clic réel, deux détours CSS rejetés puis handler corrigé, TypeScript et build. Fixtures et validateurs inchangés.
- Benchmarks officiels ciblés sans cache avec `ornith-1.5:9b` : `ui-tabs` PASS en 91 506 ms, 1 426 tokens, 0 réparation, 5 vérifications ; `ui-chat-interaction` PASS en 100 661 ms, 1 341 tokens, 1 réparation, 6 vérifications. Rapports dans `~/Library/Application Support/Solar/benchmarks/2026-10-15T13-46-35-339Z-6feb914d/` et `2026-10-15T13-48-18-072Z-6ab10a7e/`. Deux succès ciblés ne démontrent pas une amélioration du score global des 25 exercices ; les autres domaines restent non vérifiés.

## Cortex V4 — phase 1, premier lot indépendant du modèle — 15 octobre 2026

- La spécialisation des poids Solar 9B est exclue de la feuille de route. Cortex doit accompagner le modèle de l’utilisateur ; Solar Plus reste une décision produit distincte des protections techniques et aucune facturation n’est ajoutée.
- Transactions de propositions isolées, annulation du tour entier sur échec et contrôle des sources après staging et avant remise d’une proposition. Une panne de vérification n’interdit pas de réessayer la même édition valide. La transaction ne prétend pas rendre atomique le pont d’écriture disque existant.
- Fichiers des diagnostics/actions prioritaires dans le contexte, compactage par blocs de fichiers complets, diagnostics et objectif préservés ; suppression de la coupe arbitraire au milieu des prompts. Suspension explicite si le contexte indispensable dépasse la fenêtre.
- Les échecs syntaxiques évitent les appels de compilation et de rendu. Le backend conserve son repli JSON après un échec réel du transport d’outils, quel que soit le modèle. Ajout de compteurs aux checkpoints pour rendre les pertes observables.
- Tests déterministes ajoutés dans `scripts/cortex-efficiency.test.mjs` et `scripts/cortex-backend-efficiency.test.mjs` : restauration multi-fichiers, concurrence, reprise après panne, portes syntaxiques, priorité du contexte, compactage sans perte de diagnostic et repli durable des outils avec un identifiant de modèle arbitraire. Contrats Cortex/agent, WebKit/React/Vite et build vérifiés.
- Aucune nouvelle inférence Ollama ni campagne lancée. Le gain réel de ce lot n’est pas encore mesuré ; la phase 1 entière et la phase 2 ne sont pas déclarées terminées. Feuille de route et limites : `docs/CORTEX_V4_ROADMAP.md`. Aucun gain ×10 ni compatibilité réelle 30B annoncé sans mesure.

## Cortex 4.0.0 — phases 1 et 2 intégrées — 15 octobre 2026

- Six fondations reliées au moteur : profil adaptatif observé et persistant par compte, édition AST/transactionnelle, graphe acyclique avec critères et invalidation, scénarios WebKit avec observations après chaque action, recherche séquentielle à partir des contre-exemples et mémoire liée aux empreintes des fichiers/manifestes. Aucun entraînement de poids, autre LLM ou système commercial ajouté.
- Corrections de pertes supplémentaires : ambiguïté entre mots français contenant « ui » et vraies tâches visuelles, confusion avec les interfaces TypeScript, oubli des lectures ciblées, nouvelle génération inutile lors d’une reprise, repli de transport non réutilisé et mémoire enregistrant une candidate différente de la proposition retenue.
- La vision reçoit les diagnostics mesurés et ses critiques utiles sont transmises à la boucle de correction ; les observations après clic sont vérifiées indépendamment du simple déclenchement. Les contrats d’interaction du modèle sont figés et ne remplacent pas les critères externes. La recherche relit réellement les sources avant une approche alternative et borne les snapshots en mémoire, sans plafond global de production.
- Tests V4 avec générateur simulé et WebKit réel : symboles adjacents préservés, profils invalidés selon configuration et isolés par compte, graphe automatique et invalidation transitive, lectures répétées détectées et extraits conservés, mémoire périmée écartée, ouvert/fermé et attributs contrôlés à chaque clic, génération corrigée à partir du retour WebKit. Contrats antérieurs, huit tests Rust et build TypeScript/Vite réussis.
- Trois essais ciblés `ui-tabs` réellement exécutés sans cache : Native FAIL (6,810 s, aucune modification) contre Cortex PASS (94,354 s, 1 732 tokens) au premier essai ; un essai interrompu manuellement à 233,700 s pour diagnostiquer un scénario ignoré par le vérificateur ; puis Cortex PASS (296,767 s, 5 783 tokens, 1 réparation) avec texte et ARIA mesurés dans les deux états. La capture complémentaire est désormais séparée des résultats du validateur externe, qui restent inchangés.
- Le dernier essai était plus lent : document JSON volumineux tronqué puis continuation invalide. Le premier HTML autonome explicitement ciblé est maintenant généré en document complet non échappé, suivi d’un petit contrat JSON. Tests déterministes réussis : aucun fragment appliqué, fichier conservé en cas de contrat invalide, reprise du contrat seul. Le gain réel de ce dernier correctif n’a pas été mesuré avec Ornith.
- Contrôle Playwright CLI avec provider simulé dans un profil isolé : chat, pièce jointe, modèle arbitraire, consentement mémoire, pause explicite sans compilation native, clair/sombre, viewport étroit, clavier et reduced-motion ; aucune erreur JavaScript, captures inspectées. Tests V4 et anciens contrats, WebKit natif, huit tests Rust et build TypeScript/Vite réexécutés avec succès.
- Aucune campagne complète de 25 exercices ni nouvelle génération réelle d’animation lancée. Aucun gain ×10 ou gain global de vitesse démontré. Limites : contexte conservateur 4K/8K borné par le modèle, Swift/Rust moins riches que l’AST JS/TS, minuteries JS non virtualisées, qualité esthétique non certifiée par un score pixel. Solar Plus, entraînement de poids, push et installation de DMG hors périmètre. Bilan détaillé : `docs/CORTEX_V4_VALIDATION.md`.

## Cortex — Phase 1.2b readSymbol — 16 octobre 2026

- Cause confirmée dans le checkpoint `2026-10-16T18-59-05-750Z-1e107920` : le projet ne contenait que `index.html`, donc aucun symbole sémantique récupérable, mais le schéma proposait toujours `readSymbol` avec un identifiant libre. Ornith inventait un identifiant accepté par le JSON puis rejeté par la validation atomique.
- Le runtime inventorie désormais les symboles réellement présents dans les sources courantes et expose leurs identifiants exacts, liés à l’empreinte. Sans symbole utilisable, `readSymbol` et `searchSymbol` sont retirés du tour ; les lectures et éditions de fichier restent disponibles. Après une lecture intégrale au hash courant, ce même chemin n’est plus reproposé par `readFile`, tandis que les autres fichiers non lus restent accessibles.
- Test déterministe ajouté : absence de symboles HTML, repli vers lecture puis édition sans relecture identique, exposition d’un identifiant TS exact, lecture sémantique et reprise jusqu’à une vérification réussie. Les tests Context Recovery, multi-fichiers, V3.3 et V4.1 passent ; le build TypeScript/Vite et `git diff --check` passent.
- Une unique relance réelle `ui-description` avec `ornith-1.5:9b` a terminé **FAIL** en 111,878 s, 2 354 tokens et 3 réparations. Le défaut `readSymbol` a disparu. Le modèle a ensuite répété `readFile(index.html)` sur la même empreinte ; le garde-fou de schéma contre cette relecture a été ajouté et testé après cette campagne, sans seconde relance conformément à la limite d’une exécution. Rapport : `~/Library/Application Support/Solar/benchmarks/2026-10-16T19-08-02-677Z-484225f7/BENCHMARK_REPORT.md`.
- Limite restante : `scripts/cortex-contract.test.mjs` échoue encore sur son scénario distinct de récupération après saturation de contexte (`CORTEX_CONTEXT` au lieu du second appel simulé). Ce point n’a pas été masqué ni traité dans cette phase ciblée. Aucun commit ni push.

## Cortex V4.1 — Phase 1.3b : réparation structurelle du DOM — 16 octobre 2026

- Analyse préalable du benchmark `2026-10-16T21-12-57-997Z-5957c127` : sept incréments de réparation reconstitués avec limites de journalisation explicites. La réparation de l’étape 11 réussissait les onze contrôles, mais était annulée : `inspectUI` avait changé le viewport et donc les identités de preuve. `textarea,input,button` est une alternative CSS, pas trois obligations distinctes ; la source initiale utilisait une div avec rôle de bouton.
- Réparation générale, indépendante des fixtures : diagnostic de sélecteurs/attributs/fichiers, source HTML/JSX courante numérotée et protégée dans le contexte, schéma d’édition atomique sans retest inchangé ni outil CSS pour une absence DOM. Les avis vision attendent la résolution structurelle. Les inspections exploratoires ne modifient plus les paramètres des contrôles indépendants. La progression compare les défauts DOM, réévalue dès un essai sans progrès et conserve l’historique des restaurations ; garde-fou CSS étendu aux attributs JSX via AST.
- Nouveau test déterministe HTML/React rendu réellement par WebKit : sélecteurs génériques, attributs, priorité structure/style, édition inerte ou rejetée, cible dans template/branche non rendue, correction atomique puis confirmation dans le DOM, paramètres de vérification stables. Tests Context Engine/pre-V5, Context Recovery, First Working Artifact, multi-fichiers, contrats Cortex/V4.1, readSymbol, backend, réparation autonome et captures WebKit réussis. Build TypeScript/Vite et `git diff --check` réussis.
- Limites non masquées : deux anciens tests (`cortex-efficiency:29`, `cortex-patch-recovery:59`) échouent sur les restrictions du schéma de reprise après conflit ; mêmes échecs reproduits contre le snapshot source historique. Le smoke UI passe chat, pièce jointe, thèmes et mémoire, puis échoue sur l’ouverture de « Vérifications Cortex » ; fin de parcours non validée. Captures Playwright inspectées. Aucun validateur ni benchmark modifié ; modifications locales antérieures préservées.
- Unique benchmark réel demandé : **ui-reference / ornith-1.5:9b / Cortex PASS, 69 318 ms, 679 tokens de sortie, 0 réparation**, six contrôles indépendants réussis, cinq générations. Rapport : `~/Library/Application Support/Solar/benchmarks/2026-10-16T21-32-59-557Z-ca1bd1de/BENCHMARK_REPORT.md`. Les cinq sources modifiées sont identiques au snapshot mesuré. L’artefact initial avait déjà un vrai bouton ; la réparation DOM avec Ornith et la répétabilité 8/8 ne sont pas démontrées par cet essai unique. L’évolution visuelle facultative effectue encore trois tours avant de retenir la meilleure version vérifiée.
- Bilan détaillé avec chronologie et emplacements : `docs/CORTEX_V4_1_DOM_REPAIR.md`. Aucun commit ni push.

## Solar Cortex V4.1 — Phase 1.4 : stabilisation finale — 17 octobre 2026

- Audit des traces `2026-10-16T21-52-05-721Z-a0d32e1d` : export CommonJS absent pour `feature`, import circulaire et contrat `formatName` erroné pour `refactor-multifile`, source HTML/JS tronquée ou mal reprise et diagnostic de syntaxe insuffisamment ciblé pour `ui-description`. Les outils de vérification/lecture étaient parfois répétés sans mutation utile ; le rollback pouvait perdre la cause rejetée.
- Réparations générales : validation des exports/imports CJS/ESM dans les sources préparées, diagnostic des contrats d’exécution et des lignes de syntaxe, sources courantes et originales focalisées, restrictions d’actions selon la panne, rejet explicite des patches répétés ou HTML redémarré, maintien du motif de rollback, récupération de contexte bornée. Pour le DOM et le mouvement, les réparations privilégient l’édition effective et le déclencheur observable plutôt qu’une simple vérification ou un détour CSS.
- Tests déterministes ajoutés/étendus : contrat CJS/ESM, cycle, export, assertion runtime, syntaxe, DOM HTML/React, reprise HTML, édition rejetée/sans effet, rollback, Context Engine/Recovery, First Working Artifact et multi-fichiers. Vérification finale : **25/25 suites de tests réussies**, `npm run build` réussi (avertissement Vite de taille des chunks), `git diff --check` réussi.
- Benchmarks ciblés réels sans cache : `feature` PASS (61,467 s, 750 tokens, 2 réparations), `refactor-multifile` PASS (87,103 s, 947 tokens, 4 réparations), `ui-description` PASS (60,736 s, 1 131 tokens, 0 réparation), `swift-debug` PASS (50,981 s, 722 tokens, 2 réparations), `ui-reference` PASS (~65 s), `motion-simple` PASS (270,183 s, 4 041 tokens, 3 réparations). Des essais ciblés antérieurs ont aussi échoué ; ces PASS ne constituent pas une preuve de reproductibilité.
- Deux régressions complètes des huit exercices, toutes deux sans cache : `2026-10-17T08-22-02-922Z-edc2b623` **5/8** (échecs `swift-debug`, `refactor-multifile`, `ui-reference`) ; `2026-10-17T08-36-41-428Z-f28466fa` **5/8**, 548,502 s (échecs `refactor-multifile`, `ui-description`, `motion-simple`). Les corrections et ciblés ultérieurs n’ont pas été suivis d’une troisième régression complète ; **8/8 reproductible non démontré**. Rapports originaux sous `~/Library/Application Support/Solar/benchmarks/`.
- Aucun benchmark ni validateur modifié, aucun commit ni push. Modifications locales préexistantes conservées. Limites : variance réelle d’Ornith 9B, coût élevé des réparations de mouvement, échec possible des contrats multi-fichiers et des reprises HTML lors d’une campagne fraîche.

### Clôture locale sans inférence — 17 octobre 2026

- Relecture des correctifs Phase 1.4 déjà présents : contrats CommonJS/ESM et rollback, continuation HTML et premier artefact, édition ciblée et suppression des re-vérifications inchangées. Une seule retouche supplémentaire justifiée : distinguer l'échec `prefers-reduced-motion` d'une absence de mouvement normal pour guider la réparation sans casser l'animation validée. Test déterministe ajouté.
- Vérifications locales : 23/23 fichiers de tests Cortex/agent réussis, build TypeScript/Vite réussi, `git diff --check` réussi. Aucun Solar Bench, aucune inférence Ollama, aucun changement aux benchmarks/validateurs, aucun commit ni push. Le comportement final avec Ornith et le 8/8 reproductible restent non vérifiés après cette retouche.

### Validation finale utilisateur — 17 octobre 2026

- Campagne finale exécutée par l’utilisateur : **8/8 benchmarks PASS, sans cache**. Phase 1 de Solar Cortex V4.1 officiellement terminée.
