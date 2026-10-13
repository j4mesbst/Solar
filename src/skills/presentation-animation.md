---
id: solar.presentation-animation
name: Presentation Animation
version: 1.0
category: presentation
priority: medium
scope:
  - powerpoint
  - keynote
  - staged-reveal
  - presenter-flow
triggers:
  - animate-slides
  - transitions
  - powerpoint-animation
  - presentation-motion
compatible_with:
  - solar.presentation-design
  - solar.artifact-builder
---

# Solar Skill — Presentation Animation

## Purpose

This Skill makes presentation motion support the speaker’s story.

Animation should:
- control attention;
- reveal information in sequence;
- explain relationships;
- prevent the audience from reading ahead;
- support transitions between ideas.

It should not turn the deck into a motion demo.

---

# 1. Default Rule

If animation does not improve comprehension, do not add it.

The most professional default is often:
- no object animation;
- or a short fade.

---

# 2. Animation Categories

## Entrance

Use to reveal content.

Preferred:
- fade;
- subtle appear;
- short wipe for directional processes.

Avoid:
- bounce;
- spin;
- fly-in from random directions.

## Emphasis

Use rarely.

Preferred:
- subtle color change;
- small scale;
- highlight;
- pulse only when necessary.

## Exit

Use only when removing content helps focus.

## Motion Path

Use only for:
- process;
- movement;
- system flow.

Do not use decorative motion paths.

## Morph / Matched Transition

Use when one visual logically transforms into the next.

Excellent for:
- zooming into part of a system;
- expanding a card;
- moving a product mockup;
- transforming a diagram.

---

# 3. Sequence Design

Typical sequence:

```text
slide enters
→ title visible immediately
→ key visual
→ supporting label
→ secondary evidence
```

For a process:

```text
step 1
→ connector
→ step 2
→ connector
→ step 3
```

For data:

```text
chart appears
→ highlighted series
→ annotation
→ conclusion
```

---

# 4. Timing

Use short timings.

| Motion | Typical |
|---|---:|
| fade | 150–300 ms |
| wipe | 200–400 ms |
| morph | 300–600 ms |
| highlight | 150–250 ms |

Avoid making the presenter wait.

Animation should complete before it becomes awkward to continue speaking.

---

# 5. Click Strategy

Prefer:
- one meaningful reveal per click;
- groups instead of individual micro-elements.

Avoid:
- 12 clicks to reveal one slide;
- every icon having separate timing;
- presenter having to memorize complex sequencing.

---

# 6. Build Strategy

For a complex slide:

1. show stable title;
2. reveal primary content;
3. pause for explanation;
4. reveal evidence;
5. reveal conclusion.

The sequence should mirror the speaker’s narrative.

---

# 7. Transition Strategy Between Slides

Use transitions sparingly.

Recommended:
- none;
- fade;
- morph where continuity exists.

Do not alternate transition styles randomly.

A deck should have one main transition language.

---

# 8. Progressive Disclosure

Use when:
- content is complex;
- reading ahead would hurt explanation;
- diagram has sequential logic.

Do not hide information that the audience needs to compare simultaneously.

---

# 9. Diagram Animation

For diagrams:

- reveal nodes in causal or logical order;
- reveal connectors with the node they explain;
- keep completed nodes visible unless focus requires removal;
- avoid animating all nodes independently.

---

# 10. Chart Animation

Preferred:
- chart base appears;
- key data series appears;
- annotation appears.

Avoid:
- each bar individually flying in;
- long counting animations;
- excessive axis animation.

---

# 11. Accessibility and Reliability

Deck must remain understandable if:
- animations do not play;
- exported to PDF;
- opened in a different presentation app.

Never make essential content exist only during a transient animation.

---

# 12. Anti-Patterns

Avoid:

- spinning;
- bouncing;
- random fly-ins;
- excessive zoom;
- animation on every slide;
- inconsistent transition types;
- long delays;
- auto-advance unless requested;
- animation that changes the intended reading order.

---

# 13. Quality Gate

- [ ] Animation follows narrative order.
- [ ] No unnecessary effect.
- [ ] No excessive clicks.
- [ ] Timing remains fast.
- [ ] Slide still works as a static image.
- [ ] Presenter can predict the sequence.
- [ ] Animation style is consistent.
- [ ] Charts and diagrams remain understandable.
- [ ] Exported PDF remains coherent.

---

# 14. Handoff

Always combine with `solar.presentation-design`.

If the presentation design is weak, fix the slide before adding motion.

# 15. Storyboard Before Animation

For a slide with multiple stages, Solar should first define a storyboard:

```text
STATE A — what the audience sees initially
STATE B — what changes after click 1
STATE C — what changes after click 2
STATE D — final stable composition
```

Each state should remain visually valid on its own.

The animation is the bridge between states, not the content itself.

---

# 16. Presenter Cognitive Load

Animation should reduce the presenter’s cognitive load.

Before creating a sequence, ask:

- How many clicks does the presenter need?
- Is the next click predictable?
- Can the presenter easily recover if they click too early?
- Does the animation force exact timing with speech?
- Can the presenter skip ahead without breaking the slide?

Prefer robust sequences over clever sequences.

---

# 17. Section Transitions

Use section transitions to communicate a meaningful shift.

Good section transition:
- background changes once;
- section number appears;
- one large statement;
- clean fade/morph into next section.

Avoid inserting a flashy transition merely because a new section begins.

---

# 18. Building Complex Reveals

For complex content:

```text
base structure
→ focus layer
→ evidence layer
→ conclusion layer
```

Example for a product architecture slide:

1. show the overall architecture;
2. highlight one subsystem;
3. reveal its data flow;
4. show the outcome/benefit.

Do not reveal unrelated pieces in parallel.

---

# 19. Morph Design Rules

Morph works best when:

- the same object exists on consecutive slides;
- position/scale changes have semantic meaning;
- the audience should perceive continuity.

For a morph sequence:
- keep object identity consistent;
- avoid drastic unrelated changes;
- do not morph text into unrelated text;
- ensure final composition is clean even without motion.

---

# 20. Animation Tokens

A presentation may define a compact motion system:

```text
transition.default = fade
transition.continuity = morph
entrance.primary = fade
entrance.directional = wipe
emphasis.default = contrast highlight
duration.fast = 0.2s
duration.normal = 0.35s
duration.morph = 0.5s
```

Use these consistently across the deck.

---

# 21. Content-Aware Animation Recipes

## KPI

```text
headline visible
→ metric appears
→ contextual benchmark appears
→ interpretation appears
```

## Before / After

```text
before visible
→ divider / transition
→ after appears
→ key delta highlighted
```

## Competitive Matrix

```text
matrix appears
→ user's product column highlighted
→ 2–3 meaningful differences annotated
```

## Timeline

```text
timeline base
→ milestone group 1
→ milestone group 2
→ final destination
```

## Architecture

```text
system boundary
→ main components
→ connections
→ highlighted flow
```

---

# 22. Animation for Dense Slides

If a slide is dense:

- do not animate every object;
- group related content;
- reveal by logical cluster;
- keep stable reference elements visible.

The audience should not need to reconstruct the slide after each click.

---

# 23. Export Compatibility

Before relying on a presentation animation:

- consider PowerPoint version;
- consider Keynote compatibility;
- consider PDF export;
- consider browser-based viewers.

If compatibility is uncertain, prefer simple effects.

Critical information must always exist in the final static state.

---

# 24. Presentation Animation Scoring

Score each animated slide from 0–2:

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| Narrative support | decorative | somewhat useful | clearly improves explanation |
| Predictability | confusing | acceptable | obvious |
| Speed | slow | tolerable | immediate |
| Consistency | unique/random | mostly consistent | system-consistent |
| Static fallback | broken | understandable | fully coherent |

A slide scoring below 7/10 should be simplified before delivery.
