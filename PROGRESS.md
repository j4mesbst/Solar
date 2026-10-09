# Progress — 2026-10-09

## Completed implementation

The approved Solar design and the six additional features are implemented in the existing Tauri/React project. No repository history has been rewritten.

- Flat dark/light interface, larger consistent corners, macOS system typography, restrained icons, collapsible sidebar, pinned settings and independently scrolling chat.
- Drafting and changing model/effort while generating; each request keeps its captured settings, later edits apply to the next turn.
- Markdown/GFM, code copy, horizontal code/table scrolling, real generation status via the supplied ToolGroup component, safe reasoning-tag buffering and stream error handling.
- Persistent schema-v3 conversations/messages/drafts/attachments; transactional writes; migration from legacy browser settings and current-tab history. Browser localStorage adapter and native Tauri Store adapter.
- Cmd K local history search: titles/messages, accent/case-insensitive matching, snippets/highlights, arrow/Enter/Escape interaction, focus restoration and exact-message jump.
- Nonblocking Ollama detection, manual selector refresh, distinct model IDs, preserved cloud providers and removed-model availability states.
- Debounced local preparation with stale-result cancellation, one preload at a time, `/api/ps` resident-model check and five-minute expiry. No cloud preloading, model download or forced unloading.
- Compact smart paste from 1500 characters or 30 lines: preview, removal, conversion to textarea text, draft persistence, full unmodified attachment content in model input.
- Simplify/Expand/Correct for selected assistant text: shared real-provider streaming service, separate result, copy/insert/stop, original response retained, captured text treated as data. Primary and contextual generation do not overlap.
- Stored API key masked using a dummy display, read-only until explicit replacement; saving unchanged never stores the dummy. Native Keychain errors are distinguished from absent credentials.

## Checks actually run

- `npm run test:providers`: passed. Validation, model mapping, auth/error paths, Ollama keyless `/api/tags`.
- `npm run test:chat`: passed. SSE/NDJSON, request settings, auth, repeated tokens/whitespace, split reasoning tags, full-message snapshots, malformed/truncated streams and cancellation.
- `npm run test:features`: passed. Store recreation/restart, separate drafts and exact attachments, write failures, serialized mutations, deletion/late-stream guard, offline accent-insensitive search/highlights, compact-paste thresholds/full input.
- `npm run build`: passed. TypeScript and Vite production bundle.
- Browser smoke suite with controlled provider responses: passed against the real application. Verified editable draft and controls during generation, next-request settings, isolation when switching/new chat, Markdown/code/tables, all three selection actions, copy/insert, compact paste preview/full send, draft/attachment restoration after reload, Cmd K search/Enter message jump/Escape, masked stored key, light/dark theme, automatic local discovery, rapid-change preload debounce, removed-model reconciliation and responsive sidebar/settings at 390×700.
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
