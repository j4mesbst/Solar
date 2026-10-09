# Solar

Solar is a local-first macOS AI chat app built with Tauri v2, React and TypeScript. It supports Ollama and configured OpenAI-compatible providers, including GonkaRouter.

## Start the browser preview

From the repository folder containing `package.json`:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:1420`. Keep the same address to retain browser data. Conversations, messages and drafts now persist locally across reloads/restarts. Existing tab-scoped history is migrated on first launch of this version.

## Update an existing checkout

Stop the server with Ctrl+C, then:

```bash
cd ~/Documents/Solar
git pull --ff-only origin main
npm install
npm run dev
```

If Git reports local changes or diverging commits, inspect them before continuing. Do not discard local work to update.

## Checks

```bash
npm run test:providers
npm run test:chat
npm run test:features
npm run build
```

The contract suites require Node.js with TypeScript stripping support (22.6+). An optional browser smoke suite exercises the actual UI with controlled provider responses:

```bash
npm install --no-save playwright
npx playwright install chromium
npm run test:ui
```

Playwright is a testing tool, not a runtime dependency. `SOLAR_UI_NODE_MODULES`, `SOLAR_UI_CHROMIUM` and `SOLAR_UI_SCREENSHOTS` can point the suite to an existing testing installation/executable/output directory. Screenshots otherwise go to `/tmp`.

## Native macOS

After installing Rust and the Xcode command-line tools:

```bash
npm run tauri dev
```

The native app uses Tauri Store and Keychain, and a native HTTP client for configured provider requests. Native builds and real provider credentials must be verified on macOS; they are not claimed to have been tested in the Linux workspace.

## Ollama

An existing running local Ollama instance is detected automatically. Solar does not install Ollama or download models. Custom configured Ollama URLs are retained. Default local and GonkaRouter requests use fixed Vite proxies in browser development; other custom endpoints may require browser CORS configuration. Native requests use the HTTP plugin.

See `SOLAR_SPEC.md`, `ARCHITECTURE.md`, `DESIGN.md`, `ROADMAP.md` and `PROGRESS.md`.
