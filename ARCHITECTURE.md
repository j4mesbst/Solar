# Architecture

```text
React UI
  └─ services/contracts.ts  ← stable application boundary
       ├─ mockStore.ts      ← temporary preview adapter
       └─ native adapters   ← next: Tauri Store / Keychain / commands
            └─ Rust (src-tauri)
```

## Boundaries

- `src/domain`: pure, provider-neutral data types.
- `src/services`: interfaces and adapters. UI does not depend on Ollama, Anthropic, or a specific database.
- `src/ui`: presentation only.
- `src-tauri`: native lifecycle and future commands. The native layer is the only layer allowed to expose Keychain operations.

## Persistence plan

The browser preview remembers provider settings and the preview API key for this browser at the same Solar address. Conversations and messages remain scoped to the current browser tab, so a new tab starts without chat history. API tokens are referred to by key and accessed through `SecretVault`; the native Tauri implementation uses the `keyring` crate and macOS Keychain. Each provider implements the same future provider-client contract, keeping model discovery and chat streaming replaceable.

## Provider flow

`Settings → ProviderForm → SecretVault → providerApi → /models → SolarStore`.

Remote models are marked `source: remote`; user-added IDs are marked `source: manual` and are not removed during refresh.

## Chat flow

`Conversation → user message (saved) → /chat/completions with stream=true → assistant chunks (saved) → completed/interrupted/error`.

The OpenAI-compatible SSE parser accepts `data: { choices: [{ delta: { content } }] }` events and `[DONE]`. An `AbortController` cancels the actual network request when Stop is pressed. Effort is stored on the conversation but not sent until a documented Gonka parameter applies to the selected model.
