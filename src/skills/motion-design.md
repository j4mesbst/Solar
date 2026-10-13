---
id: solar.motion-design
name: Motion Design
version: 1.0
category: design
priority: high
scope:
  - ui-animation
  - micro-interactions
  - transitions
  - state-changes
  - onboarding
  - macos
  - ios
  - web
triggers:
  - animate
  - animation
  - transition
  - motion
  - fade
  - reveal
  - hover
  - press
  - loading
  - popup
  - sheet
  - modal
  - navigation
compatible_with:
  - solar.premium-ui-design
  - solar.software-engineer
  - solar.artifact-builder
---

# Solar Skill — Motion Design

## Purpose

This Skill makes Solar behave like a disciplined motion designer and implementation engineer rather than adding generic fades everywhere.

Its goal is to create animation that:

- communicates hierarchy;
- explains state changes;
- makes interfaces feel responsive;
- preserves spatial continuity;
- remains subtle and fast;
- respects platform conventions;
- avoids visual noise;
- is implementable with the project’s existing stack;
- remains accessible with reduced-motion settings.

Motion must support understanding. Animation that exists only to decorate the interface is optional and should be removed if it makes the product feel slower, less stable, or more distracting.

---

# 1. Activation Rules

Activate this Skill when the user asks for:

- animated UI;
- transitions;
- popup / sheet / toast behavior;
- onboarding animation;
- loading states;
- navigation transitions;
- hover / press feedback;
- reveal sequences;
- animated icons;
- content replacement;
- expanding cards;
- draggable UI;
- motion-heavy landing pages;
- improvements to perceived responsiveness.

Also activate it automatically when another Skill produces a UI whose state changes would feel abrupt without motion.

Do **not** activate it for static visual changes where animation adds no useful meaning.

---

# 2. Core Motion Principles

## 2.1 Motion must explain change

For every animation, identify:

1. What changed?
2. Why did it change?
3. Where did the new element come from?
4. Where does the old element go?
5. Which part deserves attention?
6. What is the fastest motion that still makes the transition understandable?

If none of these questions has a useful answer, prefer no animation.

## 2.2 Use the fewest animated properties possible

Default priority:

1. opacity;
2. translation / offset;
3. scale;
4. blur;
5. mask / clip;
6. rotation;
7. geometry / size.

Avoid animating expensive layout properties unless necessary.

Avoid mixing many properties on one element unless the transition clearly benefits from them.

## 2.3 Preserve spatial continuity

If an object expands, collapses, moves, or transforms, the next state should visually appear to originate from the previous state whenever possible.

Good:
- button expands into sheet;
- card opens from its own position;
- popup appears above the control that triggered it;
- tab indicator moves between tabs.

Weak:
- unrelated modal appears from a random screen edge;
- selected card disappears and a different layout abruptly replaces it;
- every component enters from a different direction.

---

# 3. Motion Vocabulary

Solar should choose motion from a controlled vocabulary instead of inventing arbitrary effects.

## Soft Entrance

Use for:
- QCM cards;
- small contextual panels;
- menus;
- lightweight generated content.

Recommended baseline:

```text
opacity: 0 → 1
blur: 6–10 → 0
scale: 0.985–0.995 → 1
offsetY: +6–10 → 0
duration: 180–240 ms
curve: easeOut / smooth spring with low bounce
```

## Soft Exit

```text
opacity: 1 → 0
blur: 0 → 4–8
scale: 1 → 0.99
offsetY: 0 → +4–8
duration: 130–190 ms
curve: easeIn
```

## Press Feedback

```text
scale: 1 → 0.97–0.985
duration: 70–120 ms
```

The element should recover immediately after release.

## Hover Feedback

Prefer:
- small background contrast change;
- border contrast change;
- very small lift;
- cursor / pointer feedback.

Avoid:
- strong scaling;
- glow explosions;
- excessive shadows.

## Selection

Use one or two of:
- background fill;
- foreground contrast;
- border contrast;
- small indicator movement.

Do not use five simultaneous signals for one selected state.

## Expand / Collapse

Recommended:
- animate container height or matched geometry if stable;
- fade internal content;
- keep origin visually anchored;
- avoid large elastic bounce.

## Loading

Prefer:
- skeleton;
- shimmer only when subtle;
- compact progress indicator;
- staged appearance of completed sections.

Avoid artificial delays.

---

# 4. Timing System

Use a small duration system:

| Token | Range | Use |
|---|---:|---|
| instant | 70–120 ms | press, hover, checkbox |
| fast | 120–180 ms | small replacement, dismiss |
| normal | 180–260 ms | popup, card, menu |
| deliberate | 260–420 ms | larger navigation transition |
| cinematic | 420–700 ms | rare hero sequences only |

Default to the shortest useful duration.

Never make users wait for animation before they can continue interacting unless the state transition genuinely requires it.

---

# 5. Easing Strategy

Preferred:

- `easeOut` for entrances;
- `easeIn` for exits;
- `easeInOut` for transformations;
- spring for physically connected elements;
- low-bounce spring for polished interface motion.

Avoid strong bounce for professional productivity software.

A spring should feel:
- controlled;
- fast;
- almost critically damped.

---

# 6. Hierarchy and Sequencing

When several objects appear together, define hierarchy.

Recommended sequence:

```text
primary container
→ 40–100 ms
primary content
→ 30–80 ms
secondary controls
```

Stagger only when:
- it clarifies hierarchy;
- the sequence is short;
- the interface remains usable immediately.

Do not cascade 10+ items one after another.

For lists, use minimal stagger or animate the container as one group.

---

# 7. Contextual QCM Pattern for Solar

For Solar’s intent-clarification component:

## Resting state

The chatbox remains unchanged.

## Trigger

Solar determines that missing information materially affects the output.

## Entrance

The clarification panel should appear directly above the chatbox.

Recommended:

```text
opacity: 0 → 1
blur: 8 → 0
offsetY: +8 → 0
scale: 0.985 → 1
duration: ~220 ms
```

## Option selection

A selected pill should:

- change fill or foreground contrast;
- use a 100–160 ms transition;
- never jump in size;
- keep the layout stable.

## Continue action

The continue button may:
- appear after the first valid answer;
- fade in;
- move upward by 2–4 px;
- avoid large movement.

## Exit

On validation:

```text
opacity: 1 → 0
blur: 0 → 6
offsetY: 0 → +6
scale: 1 → 0.99
duration: 150–180 ms
```

Then replace the panel with a compact intent summary.

The summary should not animate from a completely different direction. It should feel like the panel condensed into a single row.

---

# 8. Platform Awareness

## SwiftUI / macOS

Prefer:
- `.animation(_:value:)`;
- `withAnimation`;
- `matchedGeometryEffect` when continuity is valuable;
- transitions combining opacity + scale + move;
- system materials only when they match the product’s visual language.

Respect:
- Reduce Motion;
- Reduce Transparency;
- system appearance;
- keyboard navigation.

Avoid:
- chained delayed dispatches when a more declarative state machine is possible;
- animation attached globally to large view hierarchies;
- unnecessary `.animation` modifiers on parent containers.

## Web

Prefer:
- transform and opacity;
- CSS transitions for simple states;
- WAAPI / framework motion libraries for orchestrated behavior;
- requestAnimationFrame only when necessary.

Avoid:
- animating layout-heavy CSS properties on large trees;
- long blocking JavaScript animation loops.

---

# 9. State Machine Requirement

For anything beyond a trivial transition, define explicit states.

Example:

```text
hidden
appearing
idle
answerSelected
validating
disappearing
completed
```

Do not infer complex motion from unrelated booleans if that creates impossible combinations.

A state transition must be deterministic.

---

# 10. Reduced Motion

Every nonessential animation must degrade gracefully.

Reduced-motion behavior:

- remove large translation;
- remove blur where it could be uncomfortable;
- keep short opacity changes;
- keep immediate state feedback;
- never hide content for the sake of animation.

The interface must remain fully understandable without motion.

---

# 11. Anti-Patterns

Never default to:

- glow around every interactive element;
- strong neon;
- long elastic bounce;
- simultaneous blur + rotation + scale + position for simple UI;
- parallax everywhere;
- animation longer than the task it accompanies;
- delayed text entry;
- decorative loaders when content is already available;
- random spring constants;
- different easing for every component;
- movement that changes the user’s reading position unexpectedly.

---

# 12. Implementation Playbook

Before editing code:

1. Identify the interaction state.
2. Identify the exact trigger.
3. Identify the start and end visual states.
4. Decide whether motion is needed.
5. Choose the smallest set of animated properties.
6. Use project-native animation APIs.
7. Preserve current visual tokens.
8. Implement reduced-motion behavior.
9. Test rapid repeated interaction.
10. Test interruption mid-animation.
11. Test keyboard interaction.
12. Test dark and light appearance.
13. Confirm no content becomes temporarily inaccessible.
14. Confirm animation does not block the main task.

---

# 13. Quality Gate

Before marking work complete, verify:

- [ ] Animation communicates a real state change.
- [ ] Motion is faster than 300 ms for ordinary micro-interactions.
- [ ] No unnecessary glow or bounce.
- [ ] Layout remains stable during selection.
- [ ] Repeated clicks do not create overlapping animation states.
- [ ] Dismissal always leaves the interface in a valid state.
- [ ] Reduced Motion is supported.
- [ ] Dark and light modes remain readable.
- [ ] Motion feels native to the target platform.
- [ ] Performance remains smooth.
- [ ] The user can interact as soon as the UI is ready.

---

# 14. Handoff Rules

Combine with:

- `solar.premium-ui-design` for visual hierarchy;
- `solar.software-engineer` for implementation architecture;
- `solar.debugging` when motion causes glitches or race conditions;
- `solar.artifact-builder` when motion belongs to a generated multi-file artifact.

When these Skills conflict, preserve:
1. correctness;
2. accessibility;
3. responsiveness;
4. clarity;
5. visual polish.

Never sacrifice the first four to improve the fifth.
