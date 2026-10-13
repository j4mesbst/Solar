---
id: solar.premium-ui-design
name: Premium UI Design
version: 1.0
category: design
priority: high
scope:
  - product-ui
  - macos
  - ios
  - web
  - desktop
  - design-systems
  - dark-mode
  - light-mode
triggers:
  - redesign
  - interface
  - dashboard
  - app
  - ui
  - ux
  - layout
  - style
  - minimal
  - premium
compatible_with:
  - solar.motion-design
  - solar.software-engineer
  - solar.artifact-builder
---

# Solar Skill — Premium UI Design

## Purpose

This Skill gives Solar a disciplined design method for creating premium, restrained, coherent interfaces.

The objective is not “make it look AI-generated and futuristic.” The objective is:

- hierarchy;
- restraint;
- clarity;
- consistency;
- excellent spacing;
- strong typography;
- predictable interaction;
- visual calm;
- native platform quality.

Solar should prefer deliberate simplicity over decorative complexity.

---

# 1. First Principle: Structure Before Styling

Before changing colors, shadows, radii, gradients, or effects:

1. identify the primary user task;
2. identify the highest-priority action;
3. identify navigation;
4. identify persistent vs contextual controls;
5. identify content hierarchy;
6. identify information density;
7. remove unnecessary visual competition.

A beautiful interface built on weak hierarchy is still a weak interface.

---

# 2. Design Diagnosis

Before editing an existing UI, inspect:

- current layout;
- spacing rhythm;
- typography;
- component reuse;
- theme tokens;
- radii;
- border usage;
- surface hierarchy;
- state colors;
- icon set;
- navigation pattern;
- platform conventions.

Do not introduce a new design language if the project already has one.

Prefer extending existing tokens.

---

# 3. Visual Hierarchy

Every screen should clearly answer:

1. Where am I?
2. What is the most important thing?
3. What can I do next?
4. What is secondary?
5. What can be safely ignored?

Use hierarchy in this order:

1. position;
2. size;
3. spacing;
4. typography weight;
5. contrast;
6. color;
7. decoration.

Do not use bright color as the first hierarchy tool.

---

# 4. Spacing System

Use a consistent spacing scale.

Recommended base:

```text
4
8
12
16
20
24
32
40
48
64
```

Prefer multiples of 4.

Use:
- 4–8 for tight internal groups;
- 12–16 for component padding;
- 20–24 between related sections;
- 32–48 between major groups;
- 64+ for large page-level separation.

Whitespace is a structural element.

Do not fill every empty area.

---

# 5. Radius System

Use few radius values.

Example:

```text
small: 8
medium: 12
large: 16
xl: 20–24
pill: 999
```

Avoid giving every element a different corner radius.

Nested elements should generally have equal or smaller radii than their parent.

---

# 6. Surface Hierarchy

In dark mode, avoid “black + five random gray cards.”

Use a deliberate ladder:

```text
background
surface-1
surface-2
interactive
selected
```

In light mode:

```text
background
surface-1
subtle-border
interactive
selected
```

Favor contrast through tone before adding shadows.

---

# 7. Border Strategy

Borders should be quiet.

Use them for:
- separating similar tones;
- focus;
- selection;
- grouping.

Avoid:
- thick outlines around everything;
- high-contrast borders on every card;
- double borders;
- inconsistent opacity.

A premium interface often uses fewer borders than a generic one.

---

# 8. Typography

Typography should carry more of the design than decoration.

Define:

- display;
- page title;
- section title;
- body;
- secondary body;
- metadata;
- caption.

Use few weights.

Recommended:
- regular;
- medium;
- semibold.

Avoid:
- excessive bold;
- tiny low-contrast text;
- random letter spacing;
- using uppercase everywhere.

Line length should remain readable.

---

# 9. Color

Color is an information channel.

Use it for:
- state;
- emphasis;
- status;
- brand identity.

Do not use color merely because the screen “looks empty.”

For Solar-specific black / white modes:

## Dark

- near-black background;
- white primary text;
- subdued gray secondary text;
- subtle gray borders;
- selected controls may invert to white;
- accent color optional and rare.

## Light

- white / near-white background;
- near-black primary text;
- medium gray secondary text;
- subtle gray borders;
- selected controls may invert to black.

The interface should still feel complete with zero accent color.

---

# 10. Minimalism Rules

Minimal does **not** mean:
- tiny;
- empty;
- low-contrast;
- featureless;
- hidden.

Minimal means:
- only necessary elements;
- clear hierarchy;
- low visual noise;
- deliberate grouping;
- obvious interaction.

Do not hide important actions merely to keep the screen clean.

---

# 11. Component Design Rules

## Buttons

Primary:
- visually obvious;
- one per local action group;
- clear label.

Secondary:
- lower contrast;
- no competition with primary.

Icon-only:
- only when icon meaning is obvious;
- include accessibility label;
- use tooltip where appropriate.

## Pills / chips

Use for:
- compact choices;
- filters;
- tags;
- contextual QCM options.

Do not use them for long paragraph content.

Selection should change contrast without changing size.

## Cards

A card needs a reason to exist.

Use cards when:
- the content is a distinct object;
- the card is interactive;
- content needs grouping.

Do not put every paragraph inside a rounded rectangle.

## Sidebars

For productivity apps:
- keep persistent navigation stable;
- use compact icons where meaning is learned;
- reveal labels when necessary;
- keep selection state obvious.

## Chatbox

Should feel:
- central;
- calm;
- low friction.

Avoid:
- excessive buttons inside input;
- multiple bright controls;
- thick borders;
- visual competition with generated content.

---

# 12. Dark / Light Symmetry

Dark and light themes should be designed separately, not mechanically inverted.

Check:
- contrast;
- border visibility;
- surface separation;
- material behavior;
- shadows;
- selected states;
- disabled states.

A shadow that works in light mode may be useless in dark mode.

A border that works in dark mode may be too strong in light mode.

---

# 13. Glass / Material

Use glass only when:

- it communicates layering;
- background content meaningfully exists behind it;
- transparency remains readable;
- performance is acceptable.

Do not use glass because it looks “premium.”

If the product direction is flat black/white, prefer opaque surfaces and restrained translucency.

---

# 14. Visual Density

Determine one density mode:

- spacious;
- balanced;
- dense.

Do not mix densities randomly.

For Solar:
- chat mode: spacious / balanced;
- work/code mode: balanced / dense;
- popups: compact.

---

# 15. Responsive Behavior

For every layout, define:

- minimum width;
- ideal width;
- collapse behavior;
- sidebar behavior;
- toolbar wrapping;
- content truncation;
- scroll ownership.

Never rely on a single screenshot width.

---

# 16. Interaction States

Every interactive component needs:

- default;
- hover;
- pressed;
- selected;
- focused;
- disabled;
- loading where relevant.

Do not implement only default and selected.

---

# 17. Accessibility

Must support:

- keyboard navigation;
- visible focus;
- sufficient contrast;
- semantic labels;
- dynamic text where platform supports it;
- reduced transparency;
- reduced motion;
- screen reader discoverability.

Premium visual design that excludes keyboard or accessibility users is not premium.

---

# 18. Anti-Patterns

Avoid:

- gradients by default;
- purple/blue AI glow;
- giant hero cards in productivity software;
- icons from mixed families;
- arbitrary shadows;
- oversized corner radii everywhere;
- excessive blur;
- decorative noise;
- emoji as permanent product icons;
- inconsistent padding;
- centering everything;
- putting every feature on the first screen;
- low-contrast gray-on-gray text.

---

# 19. Solar Visual Profiles

These are optional presets, not hard-coded themes.

## Solar Minimal

- black/white;
- restrained gray;
- no glow;
- flat surfaces;
- strong spacing;
- subtle borders.

## Solar Flat

- opaque surfaces;
- compact spacing;
- low shadow;
- high clarity.

## Solar macOS

- platform-native toolbar behavior;
- familiar sidebar hierarchy;
- native typography;
- window-aware spacing;
- restrained material.

## Solar Liquid

- selective material;
- transparency only on navigation or floating controls;
- content remains mostly opaque;
- blur does not reduce readability.

## Solar Dense

- code/work mode;
- reduced padding;
- strong grouping;
- high information density;
- persistent utility controls.

---

# 20. Implementation Playbook

When asked to redesign:

1. inspect the current UI;
2. identify its existing token system;
3. identify user’s primary task;
4. simplify hierarchy;
5. establish spacing;
6. establish typography;
7. establish surface hierarchy;
8. reduce decorative effects;
9. standardize components;
10. implement states;
11. test dark mode;
12. test light mode;
13. test narrow window;
14. test keyboard interaction;
15. check consistency across related screens.

---

# 21. Quality Gate

- [ ] Primary task is obvious.
- [ ] No unnecessary decorative effect.
- [ ] Spacing follows a consistent rhythm.
- [ ] Typography uses a small coherent scale.
- [ ] Dark mode works independently.
- [ ] Light mode works independently.
- [ ] Selected states do not shift layout.
- [ ] Components reuse existing tokens where possible.
- [ ] No random colors.
- [ ] No mixed icon families.
- [ ] Controls have hover / focus / disabled states.
- [ ] Layout works outside the reference screenshot size.
- [ ] Accessibility is preserved.
- [ ] UI still feels intentional with accent color removed.

---

# 22. Handoff Rules

Combine with:
- `solar.motion-design` for transitions;
- `solar.software-engineer` for component architecture;
- `solar.artifact-builder` when generating a complete interface;
- `solar.debugging` when layout issues appear.

When aesthetics conflict with usability, usability wins.
