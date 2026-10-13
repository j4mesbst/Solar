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
