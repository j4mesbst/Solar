# Solar — implemented V1

Solar is a local-first macOS AI chat application with local Ollama and configured OpenAI-compatible providers, including GonkaRouter. The shipped frontend uses a flat dark/light visual system with a collapsible sidebar and a readable chat.

## Implemented

- Provider management, API credential masking/replacement, connection status and model discovery/manual IDs.
- Safe Markdown/GFM, code/table scrolling and copying, streaming/interruption/error states.
- Editable draft/model/effort during generation; changes apply to the next request.
- Locally persisted conversations/messages/drafts/compact attachments with schema-v3 migration.
- Cmd K offline history search, keyboard navigation, excerpts and exact-message jump.
- Automatic Ollama detection and nonblocking, conservative model preloading.
- Smart paste and contextual Simplify/Expand/Correct actions through the real provider service.
- Appearance, models, providers, storage and preferences pages.

## Boundaries

Browser data is remembered for the same browser and origin. Native data uses Tauri Store; native secrets use macOS Keychain. Browser credential preview storage is not encrypted. Effort profiles adjust response depth/output budget; native reasoning support is not inferred from a model name. Context limits remain provider-controlled: pasted content is sent in full and a provider rejection is surfaced.

## Deferred

Adaptive Solar model, model downloads, hardware sizing recommendations, real web search/tools/agents, Anthropic-specific adapter, accounts, cloud sync, export and a large-history database.

Native macOS behavior and live providers require validation on macOS; browser tests use controlled network fixtures against the actual application code.
