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

The local store will hold non-secret settings, providers (without API keys), conversations and messages. API tokens are referred to by key and accessed through `SecretVault`; the native Tauri implementation uses the `keyring` crate and macOS Keychain. The browser preview uses an in-memory vault and never persists the key. Each provider implements the same future provider-client contract, keeping model discovery and chat streaming replaceable.

## Provider flow

`Settings → ProviderForm → SecretVault → providerApi → /models → SolarStore`.

Remote models are marked `source: remote`; user-added IDs are marked `source: manual` and are not removed during refresh.
