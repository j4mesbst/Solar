# Solar — design contract

Solar keeps the conversation dominant: flat near-black surfaces, a restrained SF Pro/system font stack, monochrome icons and generous corners. No solar logo, glow, decorative gradient or permanent secondary panel.

- Sidebar: 232px, new chat at the top, locally persisted history, settings pinned at the bottom. Below 800px it becomes a dismissible overlay.
- Chat: 740px reading width, assistant text without cards, understated rounded user bubbles, safe Markdown/GFM and horizontally scrollable code/tables.
- Composer: 26px radius, automatically growing textarea capped at 200px. Model and effort are compact controls; both and the draft stay editable during generation. A request snapshots its inputs and later changes affect the next turn.
- Model popover: search and provider groups, configured/discovered models only. Local preparation has a small status label; no simulated providers or tools.
- Search: Cmd/Ctrl K, 640px black palette, 25px corners, dark search field, keyboard result navigation, match highlighting, exact message jump. No AI or remote search.
- Contextual tools: compact paste chips only for large content; selection actions only after selecting assistant text. Original answers remain intact.
- Settings: providers, models, appearance, storage, preferences. Stored API credentials use a dummy password display, never the actual secret, with explicit replacement.
- Motion: short functional transitions. The supplied ToolGroup component reports real generation status with no invented nested tool calls; reduced-motion preference disables animation.
- Browser surfaces: themed selection, focus rings, caret and scrollbars. Small-window layouts, light theme, empty/loading/error/disabled states are included.

Open Design's skill was read, but its local MCP service was unavailable in this session. Implementation used the approved brief and the design skill guides directly.
