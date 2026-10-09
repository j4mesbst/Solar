# Progress

## Verified in this workspace

- GitHub access to `j4mesbst/Solar` has been confirmed.
- Node.js and npm are available.
- The Vite development preview will be verified after dependencies install.

## Prepared, not yet verified

- Tauri v2/Rust source and macOS window configuration.
- Tauri Store plugin declaration and a provider-neutral `SecretVault` interface. The native Keychain adapter is intentionally deferred until its implementation dependency is chosen and tested on macOS.
- Native macOS build: this workspace does not have Rust installed, so it cannot compile the native bundle here.
- Providers, model discovery, persistence adapters and chat execution: interfaces only; no live implementation is claimed.

## Local start commands

```bash
npm install
npm run dev
# native macOS (Rust + Xcode required): npm run tauri dev
```
