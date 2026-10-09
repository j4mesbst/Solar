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
