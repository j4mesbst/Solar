# Solar interface workflow

For every interface change, read and respect `DESIGN.md` first. Preserve the Solar wordmark and native typography, the existing light/dark/custom appearance settings, and the real chat/provider/storage behavior.

Apply the user's installed skills automatically when available:

- `frontend-design`, `ui-ux-pro-max`: visual direction, typography, palettes and interaction quality.
- `frontend-skill`, `tailwind-design-system`: reusable components and consistent semantic tokens.
- `vercel-react-best-practices`, `vercel-composition-patterns`: React composition and performance.
- `vercel-react-view-transitions`: functional transitions with reduced-motion support.
- `web-design-guidelines`: final UX/accessibility audit.
- `playwright`: open the app, inspect screenshots and verify behavior before completion.
- `design-md`: keep the design contract current.

Prefer shadcn/ui primitives in `src/components/ui`, with the configured aliases and palette tokens. Use the shadcn MCP and current documentation via Context7 when exposed. If a named skill or MCP is unavailable, verify that it is absent, say so briefly, and use available design guidance and official documentation. Never claim to have used an unavailable tool or skill. Do not ask the user to select a workflow.

Validate light/dark modes, small windows, keyboard/focus, disabled and error states, reduced motion, file attachments, and controls during generation. Run meaningful affected checks and inspect the rendered app. Phase labels must represent actual operations; never invent tool calls or expose private reasoning. Plugins in the gallery remain unavailable until their real integrations are implemented; Skills starts empty.

Update `PROGRESS.md` with a French task report and material limitations. Preserve local changes and remote history when publishing; check the current remote head and do not force-push. Never commit API keys, credentials or private user content.
