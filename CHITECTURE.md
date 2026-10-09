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

The local store will hold non-secret settings, providers (without API keys), conversations and messages. API tokens are referred to by key and the `SecretVault` contract is reserved for a future macOS Keychain adapter. Each provider implements the same future provider-client contract, keeping model discovery and chat streaming replaceable.
