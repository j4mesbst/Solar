# Progress

## Verified in this workspace

- GitHub access to `j4mesbst/Solar` has been confirmed.
- Node.js and npm are available.
- `npm install` and `npm run build` completed successfully.
- The Vite development preview responded successfully at `http://127.0.0.1:1420`.
- Provider settings UI, form validation and manual model management compile successfully.
- The `/models` request adapter handles success, unauthorized, unavailable and invalid-response cases without logging the secret.
- `npm run test:providers` passed for validation and mocked `/models` success/error paths.
- Browser development now proxies Gonka Router `/models` requests through Vite to avoid its CORS restriction; successful and failed connection tests persist a green or red provider status dot.
- New conversations reuse the selected provider, model and effort from the active (or latest) conversation. Provider forms and model lists start empty until the user refreshes or adds a model.
- Chat streaming, request construction and unauthorized errors are covered by a non-sensitive contract test.
- `npm run test:chat` passed: real SSE chunk parsing, `stream: true` request construction and unauthorized error normalization.
- Browser preview starts and responds on `http://127.0.0.1:1420` after the chat update.

## Prepared, not yet verified

- Tauri v2/Rust source and macOS window configuration.
- Tauri Store plugin declaration and native Keychain commands are prepared; they still require a macOS/Tauri build to verify against the real Keychain.
- Gonka Router’s real endpoint, a real API key, and live model discovery were not tested in this workspace.
- A real Gonka streamed response, Stop against a real network request, and Keychain persistence across a native-app restart require your configured macOS app and API key.
- Browser preview state (including the preview key vault) is scoped to one browser tab: it survives reloads but is cleared when that tab session ends; it is never written to localStorage.
- Native macOS build: this workspace does not have Rust installed, so it cannot compile the native bundle here.
- Providers, model discovery, persistence adapters and chat execution: interfaces only; no live implementation is claimed.

## Local start commands

```bash
npm install
npm run test:providers
npm run test:chat
npm run build
npm run dev
# native macOS (Rust + Xcode required): npm run tauri dev
```
