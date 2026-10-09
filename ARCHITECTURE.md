# Architecture

Solar uses Tauri v2/Rust, React/TypeScript and Vite. Features share the existing `SolarStore` and `SecretVault` boundaries.

- `domain/types.ts`: provider-neutral conversations, messages, models, settings, drafts and compact pasted contents.
- `services/storageCore.ts`: transactional, serialized mutations; only publish in-memory changes after persistence succeeds. Deleting a conversation deletes its messages/draft; late streaming writes cannot resurrect it.
- `services/store.ts`: schema v3. Native: Tauri Store `solar.v3.json` in app data. Browser: `solar.data.v3` in localStorage. Legacy provider/model/settings keys and current-tab history are imported once; original keys remain as a backup. Unsupported schemas cause an error and are not overwritten.
- `hooks/useDraft.ts`: separate drafts per stable conversation ID, 250ms debounce, flush on switch/background/close, native close waits for persistence. Browser close writes a synchronous recovery snapshot. Attachments retain their original contents. A sent snapshot clears only after user/assistant messages are recorded and does not overwrite a newer draft.
- `services/nativeVault.ts`: native Keychain commands; browser credential storage is isolated from chat records in `solar.preview-vault.v2`. Browser storage is not encrypted Keychain storage. No application API credentials are copied into conversations or diagnostics.
- `services/transport.ts`: native HTTP plugin avoids WebView CORS; browser fetch uses Vite's fixed GonkaRouter and default-local Ollama proxies. Custom endpoints are respected and may require CORS in browser preview.
- `services/providerApi.ts`: OpenAI-compatible `/models` or Ollama `/api/tags`; validated results have provider-qualified IDs. Manual entries remain intact.
- `services/ollama.ts`: nonblocking detection, short timeout, refresh without duplicates, availability reconciliation, memory-aware preparation via `/api/ps` and an empty `/api/chat` request with five-minute keep-alive. No downloads or forced unloading.
- `hooks/useModelPreparation.ts`: debounce, cancellation, one preload at a time, stale-result protection, no preloads during primary/contextual generation.
- `services/chatApi.ts`: shared abortable streaming path for OpenAI-compatible SSE and Ollama NDJSON. Model, effort, provider and history are captured for each request. Partial reasoning tags are buffered, legitimate repeated tokens retained, explicit full-message snapshots handled separately. Truncated/malformed/empty streams have error states.
- `services/search.ts` + `components/ui/search-palette.tsx`: local in-memory title/message index, case/accent-insensitive matching, snippets, recent/relevance ordering and message navigation.
- `services/pastedContent.ts` + `components/ui/pasted-content.tsx`: 1500-character/30-line compaction, local preview/remove/expand, full content in model input.
- `hooks/useTextActions.ts` + `components/ui/selection-actions.tsx`: capture a single assistant passage, transform with the currently selected model through the shared streaming service, isolated result, copy/insert/stop. Selected text is user data under a separate transformation system instruction. Original messages are not edited. Contextual and primary inference are mutually exclusive; drafting/model selection remain available.

Effort levels currently control response instructions and output budgets (512/1024/3072/4096), not a claimed universal native reasoning parameter. No browsing/agent execution or adaptive Solar model is implemented.
