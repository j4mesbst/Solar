# Solar — V0 foundation

## Intent

Solar will be a local-first macOS AI chat application. V0 creates its safe, extensible shell; it does **not** yet connect to any model.

## Chosen stack

- **Tauri v2 + Rust:** small native macOS app, direct access to native storage and Keychain.
- **React + TypeScript + Vite:** fast, typed interface layer with a pleasant local browser preview.
- **Tauri Store + a future Keychain adapter:** app data is local; API secrets will belong in macOS Keychain, never in chat data or source control.

## V0 scope

- Typed domain models: providers, models, conversations, messages, settings.
- Storage and secret-vault contracts, ready for native adapters.
- Temporary dark interface with sidebar, conversation surface and disabled model composer.
- Native shell configuration and local browser preview.

## Prompt 02 — Gonka Router and model providers

- Settings now has a provider-management page with OpenAI-compatible protocol as the first option.
- Providers store metadata locally; secrets use the native `SecretVault` boundary and macOS Keychain adapter.
- `/models` discovery accepts standard OpenAI-compatible `{ data: [{ id }] }` responses and keeps manual models.
- No Gonka model IDs are hardcoded. Ollama remains an architecture option only; it is not implemented here.

## Explicitly deferred

Chat inference, Ollama connection, Anthropic/OpenAI providers, agents, subscriptions, model downloads and syncing.
