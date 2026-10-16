# Solar — design contract

Solar keeps the conversation dominant: flat near-black surfaces, a restrained SF Pro/system font stack, monochrome icons and generous corners. No solar logo, glow or decorative gradient.

- Navigation: 60px fixed icon rail (52px on mobile) with Home, Plugins, Skills and bottom Settings; 224px smoothly retracting history. Below 800px the history becomes a dismissible overlay beside the rail. Rounded 36px rows, hover delete, context actions, pinned/recent sections and discrete favorite access. Solar keeps its original typeface at 25px in the main header. History opens on request and remembers its visibility.
- Chat: 760px reading width, assistant text without cards, understated rounded user bubbles, safe Markdown/GFM and horizontally scrollable code/tables.
- Composer: compact 680px maximum width and single-line textarea above an action row, adjustable 12–36px corners, paperclip at left, model/status dot and effort beside circular Send/Stop at right, automatically growing textarea capped at 200px. Text/code, extracted PDF/Word text and raster image attachments appear as removable preview chips; files can be imported, pasted or dropped. The overflow menu sits at top left; model and effort menus open above the composer. The effort popover uses a horizontal four-stop slider with drag preview and commit on release; The compact effort popup is about 94px tall, with distinct animated particles for each level and a warm Ultra accent. Both and the draft stay editable during generation. A request snapshots its inputs and later changes affect the next turn.
- Model popover: opens below the top-right control; search and provider groups, configured/discovered models only. Local preparation has a small status label; no simulated providers or tools.
- Search: Cmd/Ctrl K, 640px black palette, 25px corners, dark search field, keyboard result navigation, match highlighting, exact message jump. No AI or remote search.
- Contextual tools: compact paste chips only for large content; selection actions only after selecting assistant text. Original answers remain intact.
- Settings: full workspace width with independent category/content scrolling, searchable rounded icon/text category rows, providers, models, appearance, storage and preferences. Appearance offers Automatic, Light and Dark with a blue rounded selection border. Color, surface, text, border, selection/focus and per-mode palettes, font and radius controls are persisted. Settings navigation shares the canvas background. Automatic follows local time: light 06:00–20:00, dark 20:00–06:00; manual selection takes priority. Stored API credentials use a dummy password display, never the actual secret, with explicit replacement.
- Motion: short functional transitions. The supplied ToolGroup component is collapsed by default and reports real preparation/receipt status with duration above the separator and streamed result; completion fades gently. No assistant identity/model label or invented tool calls. reduced-motion preference disables animation.
- Browser surfaces: themed selection, focus rings, caret and scrollbars. Small-window layouts, light theme, empty/loading/error/disabled states are included.

Open Design's skill was read, but its local MCP service was unavailable in this session. Implementation used the approved brief and the design skill guides directly.

Plugins and Skills are minimal “Arrive bientôt” placeholders. Rail hover/keyboard focus animate separate SVG parts; clicking stops multipart animation and only applies a spring zoom/dezoom. Hover patterns include: house construction, tile assembly, wand and staggered sparks, heart echo, and expanding gear segments. Popovers enter and exit, attachment previews arrive, theme selection confirms, and copy/Stop/error feedback is brief and functional. Motion is finite and respects reduced-motion. Unavailable web/image-generation/microphone controls are absent from the composer. The response status shimmers while waiting, exposes provider-reported thinking as a phase label only, and switches to writing when visible text arrives. No duplicate waiting label or internal reasoning is displayed. The textarea keeps native editing/selection with a monochrome animated overlay caret and native reduced-motion fallback. Model display labels and first-turn titles use small provider-backed metadata requests; full model IDs remain untouched, manual titles are protected, and failures retain concise local fallbacks.


## 2026-10-10 additions

Keep the existing flat shell. First-chat composer is centered and approximately 118px tall / 730px wide maximum; after the first send it moves to the bottom and returns to an approximately 83px compact baseline. The transition lasts 550ms and respects reduced motion. Thinking uses a 17px shimmer and the real stream phase; completion reports retain their quiet compact style. Strengthened glow stays inside the effort control.

Work adds one rail action, dedicated sessions and a contextual 350px right panel (300px at medium widths). Close controls remain available inside panels on small windows. Artifact previews occupy the same context role; the Work project panel hides while an artifact is open. Chat retains its ordinary conversation UI. Web/performance/Smart details live in settings, with no permanent dashboard controls.

## Reference redesign — 10 October 2026

This section supersedes the earlier placeholder and composer geometry descriptions. Respect the four supplied reference screenshots: native Solar typography, flat light/dark surfaces, rounded settings rows, capsule search, editorial plugin lists rather than dashboard cards.

- Settings: 290px category column (260px medium); 49px capsule search; 46px icon/text rows with 17px corners. Selected rows use a quiet surface; categories, API settings, palettes and time-based themes remain functional. Shared Button/Input primitives come from the official shadcn New York v4 registry, with semantic tokens mapped to the existing appearance settings. Tabs use Radix/shadcn keyboard navigation; Badge labels upcoming capabilities.
- Plugins: contextual Personaliser column and a full-width searchable gallery, Public/Personnel tabs, two columns on desktop and one on mobile. All twelve entries are gray and unavailable, with explicit `(bientôt)` labels and disabled installation/settings actions. Nothing is installed or connected by this gallery. Local monochrome Simple Icons assets retain their license.
- Skills: same type, search, navigation and toolbar as Plugins. Recommandés and Installés each preserve 180px of empty space (140px mobile); no bundled skill cards. Installation is not yet implemented.
- Composer: 640px maximum during conversation and 690px maximum for a new chat; roughly 121px/145px baseline respectively, increasing for files, multiline text or live status. 30px outer corners, plus/file action, real Web toggle, existing model/status and effort, precise circular up arrow. No screen-control action. First-send descent is retained. Mobile includes 44px touch heights.
- Live status: a compact context strip in the composer shows the real current phase, elapsed seconds and Stop. The supplied 120-degree shiny text pattern runs at 2.2s, with reduced-motion fallback. The response activity disclosure uses the same component at 15px. Thirty contextual phrase variants are phase/intent driven; there is no timed rotation inventing tool activity. Private reasoning remains hidden. The animated caret is capped at 18px.
- Buttons: shadcn primitives reused in settings forms, appearance, onboarding, directory and composer. Native icon controls keep their existing semantics and motion. Focus, disabled states and color contrast are explicit; existing custom palette values remain authoritative.

Skills available during this session: frontend-design and ui-ux-pro-max (plus previously loaded chat-interface design guidance). The other requested named skills and shadcn/Context7 MCP tools were not exposed; official shadcn registry/docs and direct Playwright validation supplied the fallback.

## Refinement — 10 October 2026

This section supersedes the Personaliser column and gray catalog styling. Plugins/Skills occupy a single full-width directory. Brand colors are visible; only upcoming installation + controls are disabled. Ajouter opens an accessible native dialog: Markdown instructions create persistent, individually enabled personal skills used in subsequent requests; personal plugins are explicitly HTTPS shortcuts, not fictitious service/API connections. The public integrations remain upcoming.

The composer is one borderless surface at rest and while editing, with fine 23px plus/globe icons and a clear circular arrow. Model name, tiny connection dot, muted effort and chevron form a compact row. Live operation icons use colored, rounded app tiles. A centered Chat/Work capsule appears above each empty conversation. Réponse en cours and duration are larger and centered; expanded real observed stages appear immediately under the separator. No private reasoning, invented commands or delayed fake progress.

Artifact outputs appear as rounded title/version/local-storage cards opening the contextual preview. Complete ordinary Markdown/JSON outputs are adapted when an explicitly requested artifact lacks the Solar envelope. HTML previews use an opaque sandbox and restrictive CSP, without network/storage access. Work validates its folder/file/cloud requirements before consuming a draft. Browsers without directory handles can import a read-only folder and export proposals; native/direct-handle projects retain approval, write and undo.

Appearance adds bounded raster wallpaper imports and independent rail/chat transparency controls. Chat has stronger black/white than the icon rail. Browser glass reveals the selected wallpaper. macOS configuration enables a transparent window with native under-window vibrancy; CSS adjusts the opacity per region. This is a vibrancy implementation, not a claim to reproduce every macOS 26 Liquid Glass material. Native transparency uses Tauri's macOS private API feature and therefore is unsuitable for an App Store build without a different native approach.

Solar Web upgrades an unconfigured SearXNG default to keyless DuckDuckGo HTML search. Vite forwards only the fixed search host; native requests use the HTTP plugin. Static browser hosting needs a proxy. Human-verification challenges are reported honestly and are not bypassed; configured Brave/Ollama/SearXNG remain alternatives. Sources and snippets actually retrieved are provided to the model.

## Wallpaper / Work polish — 10 October 2026

This section supersedes full-shell wallpaper, automatic Work inspector opening, centered 19px progress, and lavender artifact tiles. Three bundled user-supplied landscapes (coast, beach, dunes) have paired light/dark WebP images. Appearance cards show the two halves; stored presets follow the resolved theme, including the existing 06:00–20:00 automatic schedule. Custom raster uploads remain supported. Only the chat canvas receives the wallpaper; rail, history, directories and settings keep their theme surfaces.

Work opens with the reference's centered heading, 760px/150px rounded composer, plus, actual model/effort and themed send circle. Project, Files and Plugins form a quiet shelf beneath it. No dictation or automatic-approval control. The project inspector is an explicitly opened, dismissible modal with focus trapping and restoration. New proposals show a shelf indicator and never open the inspector automatically; actual review, approval and undo remain required.

Home and Skills use rounded vector paths; all rail icons become white on dark capsules on hover/selection, including in light mode. Existing multipart hover choreography and click spring remain. Live response progress is left-aligned at 14px with inline 13px seconds. Artifact tiles are monochrome and theme-aware. Slide requests recognize diapo/diaporama/exposé and get a genuine editable 16:9 PPTX with a dark cover, restrained content layouts, type hierarchy, columns when needed and page numbering. Preview follows the same visual language.

The exact requested shadcn init command was run with default answers. Its existing-components.json overwrite prompt defaults to No; the CLI stopped without changing the existing Vite/React shadcn installation. No Next migration or preset application is claimed.

## Accounts / connections / composer — 10 October 2026

The user's latest instruction removes all wallpaper controls and bundled wallpaper images; old settings are ignored for rendering. Light/dark/custom palettes and native glass controls remain. The overflow menu beside Solar is removed. A clear + in the header offers New chat when history is collapsed, and a separate account icon opens the account dialog.

New chat opens an unsaved canvas. Changing model/effort does not create history; the first valid submitted message creates the conversation. Existing model/effort choices carry forward. Importing plugin content only populates a new draft.

Artifact previews offer expand/reduce and Escape, with a large 16:9 preview, accessible focus cycling and inert background controls while enlarged. GitHub and Gmail have active catalog actions and brand artwork. The implementations read actual authenticated APIs: GitHub PAT / repository README, Gmail readonly OAuth / selected email. Connections must validate identity before being displayed as connected. Other catalog entries remain upcoming.

Accounts use a common configured Supabase Auth project with email/password, confirmation, recovery, session refresh and logout; they are not local-only profiles. Signup is explicitly unavailable without the public project URL/key. Account storage namespaces apply before lazy-loading App, and account changes reload before mounting a different store. Guest data is preserved. This is online identity with local per-account history, not cloud history synchronization. Gmail's Google browser authorization also requires the shared OAuth client ID; native supports an advanced readonly token in this release.

The supplied solar-chatbox.css is integrated additively: 28px glass surface, theme-derived colors, stronger focus border, round + with quarter-turn/press motion, disabled gray arrow and ready pop. Model/effort and response rendering remain intact. ComposerStatus uses the existing AnimatedShinyText and sc-swap: 15 thinking / 10 writing phrase variants, French and English props, 2.2–3 second nonrepeating changes within an observed phase. Connection/wait/search labels remain factual. Terminal states linger 2.2 seconds (done) or 1.4 seconds (stopped), then close through the supplied grid transition. No tool activity or private reasoning is invented. Stop sits in the banner; the arrow stays disabled during a request. Bottom anchoring preserves the textarea/buttons while the banner expands upward, apart from the separate first-message descent animation. Reduced-motion and keyboard semantics are preserved.

## Solar / Solar Code and supplied cloud scene — 10 October 2026

The header Solar wordmark is a dropdown trigger: Solar (Créer, apprendre et explorer) and Solar Code (Développer, déboguer et livrer), with the selected checkmark. Existing chat/work storage values remain compatible. The centered Chat/Work switch and redundant Work rail icon are removed. Keyboard navigation, Escape and focus return use Radix/shadcn; the React 18 button primitive forwards its DOM ref.

Default chat and rail dark backgrounds are true black (#000000); light uses #ffffff / #fdfdfd. Explicit custom colors and native glass remain user choices. Conversation cards inherit the flat chat background, without the former gray reading surface.

The supplied Solar Composer.html is preserved byte-for-byte in public/references. Its shaders, palettes, zoom/roll/fade equations, spring curves and timing constants are copied to the scene engine. The original visual CSS is scoped to the chat scene. New chat restarts the sky and intro; first valid send starts the dive, FLIP at 2.9 s and response reveal at 3.5 s. Provider requests run normally during the transition; no demo responses or fabricated tool operations are used. Existing conversations immediately open on the flat canvas. The user's 640px/28px glass composer retains the native textarea, +, original arrow and status motions, with actual model/effort controls added. Banner phrases follow observed provider events. Attachment insertion/removal and word entry reuse the supplied keyframes. Reduced motion and the non-WebGL fallback are respected; shader resources and observers are released on unmount.

The tool menu controls attachment reading, Web search and Code modification proposals. Terminal and a dedicated calculator remain clearly unavailable; they are not silently simulated. Work approval, writing and undo are unchanged.

## Compact chrome and distinct generation modes — 10 October 2026

The icon rail is 44px. Desktop header is 24px (formerly 64px), with a rounded rail/header join; mobile keeps a 44px header and touch targets. History uses a theme-derived translucent surface and 20px backdrop blur. The Solar mode menu is 250px with compact 16px titles and 11px descriptions. Native Solar typography and the supplied sky animation remain.

Solar Code shows left-aligned response progress, inline tabular seconds, a close divider and readable observed activity rows. Only actual pending command rows shimmer; no shell executor is currently enabled and no command or private reasoning is fabricated. Solar normal omits the progress panel, source pills and composer status banner, uses the supplied MIT Kokonut motion text adapted to observed phases plus small loading dots, and fades incoming words. Stop moves to the send circle in this mode. Grounding metadata remains stored and retrieved source context still reaches the model.

The Code welcome composer is geometrically centered including its project shelf, even with attachments or multiline drafts. AnimatedTextarea restores the monochrome blur/fade caret with native editing and a reduced-motion native caret. Normal response rendering refreshes at 32ms rather than 100ms and uses the existing first-message FLIP reveal instead of waiting an additional 600ms for reply reveal. Effort instructions and token budgets remain unchanged; model latency is not guaranteed.

### Header and normal-mode loading — 2026-10-10, latest reference
The Solar/Solar Code dropdown belongs to the expanded conversation sidebar heading. The main chat header contains a 26px rounded split-panel toggle, a subtle vertical separator and the current title in native 20px type; its height is 52px. Collapsing history leaves the toggle available. Normal-mode waiting uses the supplied Kokonut AI Text Loading design: 30px bold gradient text, vertical 20px enter/exit and 2.5-second shine, cycling observed provider-phase labels every 1.5 seconds. No loading dots. Reduced motion removes translation and shine. The initial conversation animation runs once even when the first two responses arrive quickly. Draft transfer routes typing to the newly created conversation immediately and never clears newer text after an asynchronous save.

### Quiet progress, monochrome composer and optional skills — 10 October 2026
Normal loading is 16px, left aligned where the answer will appear. Observed-phase alternatives rotate every 10 seconds; real phase changes are not fabricated. The composer is solid #000 or #fff with no border, ring or translucent green tools; connected/preparing dots in the composer are monochrome with accessible status labels. The rail grows to 64px, with 48px hit targets and 28.5px icons (1.5×), offset down by 16px. Remove the jump-to-bottom button entirely; preserve scroll control through the conversation viewport. Solar Code has no keyboard hint below the composer.
The account dialog uses native typography, a restrained Solar wordmark, a compact close control, spacious 48px labeled fields, password visibility controls and one full-width monochrome action. Preserve real Supabase flows and setup/error messaging.
Skills no longer starts with an empty recommended area: offer Artefact Pro, Code Max, Recherche Pro, Clarté Plus, Document Expert and Data Analyst as optional installable instructions. Persist installation and enabled state per account; match built-in skills to the current task and keep custom instructions compatible. Skills add guidance, not executable tools. Code review is internal and does not invent test execution or add a second completion request. Both modes refresh streamed text at 32ms; preserve effort and output budgets.

### macOS single-band chrome — 11 October 2026

On macOS, Solar uses one and only one 78px top band. It contains the native traffic lights at x22/y21 and the Solar header controls in the same visual surface; no second title/header strip is permitted. The app uses macOS overlay title-bar mode with its native title hidden, never simulated traffic lights. The icon rail is 52px and the expandable history is 210px on desktop. Rail icons are compact 16px, monochrome rounded vectors; the selected state is a muted gray in light appearance and a quiet charcoal in dark appearance, never a harsh black or white capsule. Existing finite hover/click motion remains functional and reduced-motion safe.

### Floating sidebar — 11 October 2026

This section supersedes the permanent icon rail. With the sidebar closed, the only Solar control in the macOS top band is the 18px split-panel toggle beside the native traffic lights; no account, new-chat, title or utility button is shown there. Opening it displays a 232px floating, bordered, translucent panel over the chat surface. The panel starts below the traffic-light space and exposes exactly New Chat, New Projects, Search, Hub and Settings, followed by the existing chat history. Its iconography is small (18px), monochrome, finite on hover and respects reduced motion. The supplied blue Solar illustration is the macOS app icon. The optional Mode Présentation skill lives in `public/skills/mode-presentation.txt`; when installed, it directs presentation requests to a single standalone HTML artifact with keyboard navigation, print layout and no invented facts.

### Alignement chrome et Hub — 11 October 2026

The transparent macOS control band overlays the chat scene instead of reserving a white header: there is no second visual strip and the scene fills the window from its top edge. Native traffic lights use x22/y28; the 18px sidebar control is centered on the same 64px band. Hovering any sidebar action triggers its supplied finite SVG motion across the complete row, with keyboard focus and reduced-motion fallbacks. Hub opens Plugins and Settings closes the drawer before their full-page views render. Plugins and Settings keep one theme-derived surface; Plugins includes a Skills tab adjacent to Public and Personnel. Errors are brief feedback and clear after three seconds.

### Final macOS chrome adjustment — 11 October 2026

The native under-window material is disabled, and the document, shell, workspace and header remain transparent above the scene: no white title-bar strip remains. Traffic lights sit at x30/y47, matching the sidebar control vertically. The second sidebar action is Solar Code and starts the existing Work/Code conversation mode. The sidebar has one functional blur-and-fade transition for both directions, while reduced motion keeps it immediate. Chat transport/storage errors remain recorded internally but are not rendered as interruption banners. Settings has no search field and uses compact, pill-shaped navigation controls. Skills keeps Public, Personnel and Skills controls visible so Public/Personnel return to Hub.

### Chat normal, dossier par défaut et alignement final — 11 octobre 2026

- Un seul bouton d’ouverture/fermeture est rendu dans l’en-tête supérieur, au même emplacement quand le panneau est ouvert ou fermé; il demeure au-dessus du panneau flottant. Les boutons macOS natifs ne changent pas de position.
- New Chat ouvre toujours l’espace normal, quelle que soit la page visitée précédemment. Solar Code garde son espace de développement et ses sélecteurs de projet/fichiers dédiés; ils ne s’affichent pas dans le chat normal.
- Le dossier de référence du chat normal se choisit dans Paramètres > Stockage puis doit être validé. Le chemin est mémorisé dans la configuration locale native et peut être remplacé ou retiré. La validation autorise explicitement l’envoi au modèle des fichiers sûrs et pertinents lorsqu’une demande parle du dossier; les autres messages normaux n’incluent pas son contenu. Le mode normal reste en lecture seule.
- Les raccourcis clavier disparaissent des libellés du panneau. Hub et Skills partagent les onglets `Public`, `Skills`, `Installés`; depuis Skills, Public et Installés ramènent à l’onglet correspondant du Hub. Les titres Paramètres, Plugins et Skills sont alignés.
- L’attente normale affiche un seul point animé. Solar Code conserve son statut « Réponse en cours ». Le Markdown du chat normal encapsule le texte par mots avec des clés stables pendant le flux; chaque nouveau mot se révèle en 450 ms et le bloc monte en 700 ms. Aucun effet n’est joué sur l’historique déjà terminé; le mouvement réduit désactive ces effets.
- Les erreurs visibles expirent en trois secondes. Le panneau reste monochrome et ses animations de fondu/flou respectent le mouvement réduit.

### Sidebar et flux de mots — 11 octobre 2026

La sidebar flottante existante conserve son aspect et s’ouvre sur 272px, puis se ferme à 0px. Son ouverture/fermeture utilise `cubic-bezier(0.22, 1, 0.36, 1)`, un décalage/fondu/flou de la carte et une cascade séquencée des actions, du titre Conversations et des éléments d’historique. ⌘B / Ctrl+B et le bouton d’en-tête offrent les mêmes états. `prefers-reduced-motion` rend ces transitions immédiates.

Dans le chat normal, l’animation concerne uniquement les mots qui arrivent : composants mémorisés par token, clés d’index stables, texte groupé par frame et aucune animation sur le bloc parent. Le rendu Markdown reste identique après la fin du flux. Les paramètres commencent sur Apparence, puis Fournisseurs. Les contrôles macOS et le bouton de sidebar restent alignés et ont été remontés de 2px.

### Modèles Solar, Solar Code et Skills — 13 octobre 2026

Paramètres > Modèles propose Solar 4B (Qwen3-4B), Solar 9B (Ornith-1.5-9B) et Solar 12B (Gemma 3 12B IT). Les deux derniers sont identifiés comme recommandés pour Solar Code; l’acceptation des conditions Gemma est explicitement demandée avant le téléchargement. L’exécution locale reste interne au catalogue Solar; Ollama n’est pas proposé comme fournisseur ajoutable.

Skills expose les sept packs Markdown versionnés fournis pour cette livraison, avec déclencheurs, compatibilités, catégories, activation et modes Auto/Manuel. Le routeur les sélectionne selon la demande, le contexte de conversation, les pièces jointes, Solar Code et la classe du modèle; il réduit le contenu injecté selon le budget local/cloud. Ces packs sont des consignes, pas des outils ou intégrations exécutables.

Solar Code choisit une stratégie interne Fast/Balanced/Deep sans remplacer le sélecteur d’effort, limite l’historique selon le modèle et la mémoire disponible et garde la demande courante. Les demandes ambiguës seulement peuvent afficher jusqu’à quatre questions contextuelles compactes, avec choix, réponse libre et option de passer; les réponses sont injectées à l’envoi. Les tests de contrat couvrent routage, budgets, stratégies et clarification. Une vérification dans une vraie fenêtre macOS reste nécessaire pour confirmer les téléchargements locaux et les parcours natifs.

Pour les modèles locaux dans Solar Code, le projet sélectionné est indexé par chemins. Solar choisit ensuite un petit ensemble de fichiers pertinents, avec les fichiers cochés comme priorité facultative; les fichiers ne sont plus tous envoyés simplement parce qu’ils sont cochés. Le moteur prépare des modifications structurées et vérifiées statiquement, présentées dans le panneau Projet avant toute écriture. L’approbation, l’annulation et les protections natives du projet demeurent en place. Le chat normal, les fournisseurs cloud, les artefacts et l’apparence gardent leurs parcours existants.

### Compte, démarrage et mouvement rapide — 11 octobre 2026

Paramètres > Compte est une page intégrée, pas une boîte de dialogue : elle réutilise le parcours Supabase e-mail/mot de passe, création, réinitialisation, confirmation et déconnexion. Le statut de configuration est visible, les sessions sont natives au stockage sécurisé macOS ou au stockage web. Les conversations et clés demeurent locales ; le compte ne promet aucune synchronisation. Le premier lancement propose facultativement le dossier de référence, qui sert au contexte de fichiers et reste modifiable dans Paramètres > Stockage ; l’historique Solar continue à être stocké dans sa base locale.

L’ouverture/fermeture du panneau conserve flou, fondu et cascade, mais la carte et ses actions usuelles apparaissent en moins de 650 ms; les longues listes restent sous une seconde pour une cinquantaine d’éléments. Les trois contrôles natifs macOS et le bouton de panneau remontent ensemble de 2px sans changer leur alignement. Le mouvement réduit reste immédiat.

### Solar Cortex — 13 octobre 2026

Le catalogue conserve sa liste minimaliste et les tokens d’apparence. Télécharger dévoile une commande Terminal sélectionnable/copirable, plus le téléchargement intégré facultatif. Ornith 1.0 reste conservé et identifié comme ancien. Actualiser recharge réellement les modèles.

Solar Code utilise Cortex pour Ornith 1.5 9B, avec les quatre niveaux d’effort existants, un historique d’opérations réel, un rapport de vérification repliable et un bouton Reprendre pour les tâches incomplètes. Une tâche suspendue n’est pas présentée comme réussie. Les modifications restent des propositions à approuver. Performance offre l’activation et la suppression de la mémoire technique locale. Aucun tableau de bord supplémentaire ni changement de chrome/typographie.

Le chat normal répond directement aux échanges sociaux sans activer les Skills d’anciens sujets ni lancer un plan; les références conversationnelles utiles restent disponibles pour les autres demandes. Le correctif de rendu des frames React préserve le Markdown et l’animation existants.

### Projet Solar Code persistant et validation Cortex — 14 octobre 2026

Dans Paramètres > Stockage, le dossier validé est le projet par défaut de Solar Code : il est restauré comme espace de travail au prochain lancement, sans demander une nouvelle sélection. Les conversations, brouillons et checkpoints Cortex restent dans le stockage local de Solar et ne sont jamais écrits dans ce dossier. Le chat normal ne peut y lire que des extraits pertinents lorsqu’il est explicitement question du projet.

Pour Ornith 1.5, Cortex utilise des actions JSON où chaque action exige ses champs nécessaires. Si un modèle local relit un fichier puis tente de terminer sans mutation, Cortex demande une proposition de patch exacte au tour suivant. Une proposition est terminée après un patch et les vérifications réellement réussies, sans attendre un marqueur décoratif du modèle. Les captures WebKit temporelles se règlent sur la durée demandée et l’examen vision fournit des écarts observables et une correction courte à la boucle de réparation. Le contexte local reste à 4K en mémoire basse et 8K par défaut ; 12K n’est pas activé automatiquement sans validation matérielle explicite.

### Solar Cortex V3.1 — statut discret et continuité — 14 octobre 2026

Le rapport Cortex reste un élément repliable de Solar Code, jamais un tableau de bord. Il expose uniquement des faits issus de l’exécution : étape, dernière opération, nombre de générations et durée finale. Une exécution longue conserve son checkpoint et peut être reprise, mais l’interface ne prétend ni garantir un traitement pendant la veille macOS, ni mesurer en continu le swap ou la pression système. Les propositions continuent à nécessiter l’approbation utilisateur avant toute écriture.
