# Solar

Solar is a local-first macOS AI chat app built with Tauri v2, React and TypeScript. It supports Ollama and configured OpenAI-compatible providers, including GonkaRouter, plus Anthropic. Chat and Work share the same model/provider/rendering services.

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
npm run test:evolution
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

The native app uses Tauri Store and Keychain, and a native HTTP client for configured provider requests. Native compilation and Rust tests have passed on macOS GitHub Actions. Interactive native workflows and real provider credentials still require verification on a Mac.

## Ollama

An existing running local Ollama instance is detected automatically. Solar links to the Ollama installer and can download recommended models only when requested in onboarding. Custom configured Ollama URLs are retained. Default local and GonkaRouter requests use fixed Vite proxies in browser development; other custom endpoints may require browser CORS configuration. Native requests use the HTTP plugin.

See `SOLAR_SPEC.md`, `ARCHITECTURE.md`, `DESIGN.md`, `ROADMAP.md` and `PROGRESS.md`.


## Chat, Work and artifacts

New chats start with a larger centered composer, which moves down on the first send. Thinking appears only when the provider reports that phase; internal reasoning stays hidden. Conversation titles summarize the first exchange and preserve manual edits.

Work has its own sessions and a collapsible project/review panel. Choose a directory, select up to ten text files and explicitly authorize sending their contents to a cloud model. Request modifications, inspect Before/After, then Accept or Reject. Writes check the original contents first. Undo checks that no later edits would be overwritten. Native Work refuses symlinks and paths outside the explicitly selected root. Existing proposals must be regenerated after reopening a directory or restarting. No generated code is automatically executed. Browser Work requires the File System Access directory picker; otherwise use the macOS app.

Request a presentation/document/table/code file/diagram to open an artifact panel. Edit or ask the model to modify the existing artifact. Export PPTX, PDF, DOCX, CSV/XLSX, source code, or Mermaid SVG/MMD. A structured response is required; invalid or incomplete JSON shows an error instead of a fictitious artifact. Export engines load on demand. Documents use standard Latin PDF fonts; other scripts need additional fonts.

## Web, Smart and local performance

Configure **Settings → Solar Web**: Auto/Always/Off, SearXNG (JSON enabled), Brave, or Ollama Web Search. A local SearXNG instance avoids a mandatory paid provider. External queries require consent; Brave/Ollama require a dedicated key. Browser previews additionally depend on the search server’s CORS settings. Native requests use Tauri HTTP. Sources and errors come from retrieved results, with a bounded in-memory cache. No engine is silently configured for you.

Solar Smart classifies common tasks with local rules, uses short instructions, and retains manual model/effort control. Disable it under Preferences. Structured artifacts and Work proposals receive a larger output budget (8 192 tokens) to hold complete files, while retaining the effort instruction.

Performance profiles explicitly set Ollama context and residency: Eco 2 048 / unload after response / no preload; Balanced 4 096 / five minutes; Performance 8 192 / fifteen minutes. Hardware and real response timings are shown only in settings. GPU tuning, terminal execution and active MCP integrations are not claimed.

The first-open wizard supports multiple providers, optional setup, real Ollama discovery and voluntary model downloads. Download progress is the current layer’s received bytes, not simulated elapsed time. Cancellation preserves Ollama’s downloaded layers for a later retry. Existing installations keep their providers and bypass the new wizard.

## Extended verification

```bash
npm run test:ui:evolution
npm run test:ui:thinking
```

These use Playwright with controlled provider responses. The Work UI test uses a controlled directory handle; native disk writes and dialogs require macOS verification. `.github/workflows/validation.yml` runs frontend contracts/build and native macOS Cargo tests after an authorized publication. No macOS/Rust test is claimed to have run in the Linux editing environment.

See [PROGRESS.md](PROGRESS.md) for the current implemented/partial/future checklist, changed files, dependencies and publication status.

### Reference interface redesign

Plugins now has a searchable, themed directory of upcoming connections; all installation actions are disabled. Skills has empty Recommended/Installed sections. These pages do not install tools. The composer has attachment, configured Web search, model and effort controls, with genuine phase status and a Stop action.

Shared primitives use shadcn/ui (New York v4), Tailwind 4 and Radix. `components.json`, the `@/` alias and `src/lib/utils.ts` are configured for future additions. The application icons are checked in under `src-tauri/icons` so a clean native checkout can compile. Regenerate them with `npm run tauri -- icon src-tauri/icons/source.svg`. Selected plugin SVGs are local Simple Icons assets; see `public/plugin-icons/LICENSE.txt`.

The reference-layout browser check is `npm run test:ui:redesign`; it covers both themes, narrow windows, gallery search/tabs, disabled integrations, empty Skills, Web search and composer geometry. As with the existing UI checks, set `SOLAR_UI_NODE_MODULES` to a Playwright installation and `SOLAR_UI_CHROMIUM` when using an external Chromium binary.

Native validation: after adding the required application icons, GitHub Actions run `38042138605` passed both frontend and macOS compilation/Rust tests. Interactive native dialogs and disk workflows still require a hands-on Mac check.


### Derniers réglages

- Plugins/Skills : Ajouter permet de créer des raccourcis HTTPS personnels ou d’importer des instructions Markdown. Les skills activés sont transmis au modèle ; les raccourcis ne constituent pas une connexion API. Les applications du catalogue restent à venir.
- Web : le globe autorise la recherche vers le moteur choisi. DuckDuckGo est disponible sans clé dans npm run dev et dans l’application native. Les vérifications humaines ne sont pas contournées ; Brave, Ollama Web Search et SearXNG configuré restent disponibles. Une version Web statique nécessite un proxy.
- Work : ouvre un dossier et coche les fichiers avant de transmettre le contexte. Sans accès direct aux dossiers (Safari), l’import est en lecture seule et les propositions s’exportent en JSON. L’application macOS permet d’appliquer et d’annuler les modifications après validation.
- Apparence : importe un fond PNG/JPEG/WebP et règle séparément la transparence de la barre des tâches et du chat. Le fond est redimensionné et enregistré localement. La configuration macOS ajoute une fenêtre transparente avec vibrancy ; l’API privée macOS impose une adaptation pour une distribution App Store.
- Vérification complémentaire : node scripts/ui-refinement.cjs avec les mêmes variables Playwright que les autres suites UI.
