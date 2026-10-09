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
- [x] Five contextual text actions on selected assistant text, isolated streaming result
- [x] Targeted storage/search/paste/stream/provider tests and real-browser smoke suite

- [x] Real streaming scroll suspension and return-to-latest
- [x] Compact taller composer, top-right model/options controls and horizontal effort slider
- [x] Animated fixed navigation rail, Favorites heart and Plugins/Skills placeholders
- [x] Rich GFM/code/math rendering with table/code copy and safe links
- [x] Local automatic titles with manual rename protection
- [x] Persistent pinned conversations and favorite replies
- [x] Temporary memory-only chats excluded from disk, draft recovery, search and exports
- [x] Settings-only single/all Markdown/text export in browser
- [x] Timed SSE browser regression and new feature contracts

- [x] Full-width searchable settings and scheduled automatic appearance at 06:00/20:00
- [x] Multi-part vector icon motion, animated popup exit, practical feedback and reduced motion
- [x] Raster image import/paste/drop/preview, persisted drafts and native Ollama/OpenAI-compatible image payloads
- [x] Browser checks for clock boundaries, manual theme override, image requests and provider rejection

- [x] Prompt-style composer, native editing with animated caret, PDF/Word text extraction
- [x] Provider-backed compact model labels and capitalized three-word conversation titles
- [x] Real stream activity phases with shimmer and protected hidden reasoning
- [x] Hover vector motion, spring click feedback and animated effort capsule
- [x] Per-mode color palettes, borders, focus colors, font and corner controls

## Required macOS/live checks

- [ ] Build/run native bundle with Rust/Xcode and verify native export save dialog/cancel/write
- [ ] Verify Tauri Store migration and native close/reopen draft restoration
- [ ] Verify Keychain create/read/replace/delete with OS permissions
- [ ] Verify installed Ollama discovery, real first-token latency, low-RAM behavior and Stop
- [ ] Verify a live GonkaRouter connection and model response with the user's configured credential

- [ ] Verify real image analysis with a configured vision-capable cloud and local model

## Future

- [ ] Adaptive Solar model/hardware sizing and explicit native effort capability mapping
- [ ] Model downloads and progress
- [ ] Anthropic-native protocol, web search and real agent tools
- [ ] Database/index tuning for very large archives, robust multi-window synchronization
- [ ] Optional accounts/cloud sync
