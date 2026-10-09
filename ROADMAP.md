# Roadmap

## Implemented and verified in browser/contract tests

- [x] Tauri/React foundation and stable store/vault contracts
- [x] OpenAI-compatible discovery and streamed chat, Ollama tags/chat
- [x] Flat dark/light design, collapsible sidebar, five settings pages
- [x] Draft/model/effort changes during generation with next-turn semantics
- [x] Schema-v3 local persistence, migrations and per-conversation draft/attachment storage
- [x] Cmd K offline title/message search and result navigation
- [x] Automatic Ollama discovery, namespaced IDs and removed-model states
- [x] Debounced memory-aware local preload, no cloud preload/download/unload
- [x] Smart paste preview/remove/expand and full-content model input
- [x] Simplify/Expand/Correct on selected assistant text, isolated streaming result
- [x] Targeted storage/search/paste/stream/provider tests and real-browser smoke suite

## Required macOS/live checks

- [ ] Build/run native bundle with Rust/Xcode
- [ ] Verify Tauri Store migration and native close/reopen draft restoration
- [ ] Verify Keychain create/read/replace/delete with OS permissions
- [ ] Verify installed Ollama discovery, real first-token latency, low-RAM behavior and Stop
- [ ] Verify a live GonkaRouter connection and model response with the user's configured credential

## Future

- [ ] Adaptive Solar model/hardware sizing and explicit native effort capability mapping
- [ ] Model downloads and progress
- [ ] Anthropic-native protocol, web search and real agent tools
- [ ] History export, database/index tuning for very large archives, robust multi-window synchronization
- [ ] Optional accounts/cloud sync
