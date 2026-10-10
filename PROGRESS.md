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
