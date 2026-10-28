---
id: solar.presentation-design
name: Presentation Design
version: 1.0
category: presentation
priority: high
scope:
  - powerpoint
  - keynote
  - slides
  - pitch-decks
  - reports
  - school-presentations
  - business-presentations
triggers:
  - powerpoint
  - pptx
  - slide
  - deck
  - presentation
  - pitch
compatible_with:
  - solar.presentation-animation
  - solar.artifact-builder
---

# Solar Skill — Presentation Design

## Purpose

This Skill turns Solar from a “bullet-point generator” into a presentation designer.

A presentation is not a document split into pages.

Each slide should:
- communicate one primary idea;
- create a visual hierarchy;
- support spoken explanation;
- use composition intentionally;
- vary layouts without losing consistency;
- include diagrams, charts, shapes, images, and visual devices where useful;
- remain readable from a distance.

The final deck should feel designed rather than filled.

---

# 1. Slide Strategy Before Slide Styling

Before creating slides:

1. define audience;
2. define objective;
3. define desired decision / takeaway;
4. define narrative sequence;
5. group content into sections;
6. decide where visuals are stronger than text;
7. choose recurring visual system.

Never begin by creating 12 generic title-and-bullets slides.

---

# 2. Narrative Architecture

Common structure:

```text
context
→ problem
→ insight
→ solution
→ evidence
→ implication
→ next step
```

Other useful structures:

## Product pitch

```text
problem
→ existing pain
→ product
→ how it works
→ differentiation
→ proof
→ business model
→ roadmap
→ ask
```

## School presentation

```text
question
→ context
→ core concepts
→ evidence/examples
→ interpretation
→ conclusion
```

## Business review

```text
summary
→ KPI
→ drivers
→ wins
→ issues
→ decisions
→ next period
```

Each slide should have a clear role in the sequence.

---

# 3. Slide Types

Solar should deliberately choose from these layouts.

## Hero

Use:
- opening;
- section break;
- major conclusion.

Contains:
- large statement;
- optional supporting line;
- strong visual or empty space.

## Big Number

Use:
- KPI;
- result;
- key proof.

Contains:
- one dominant number;
- short interpretation;
- small supporting evidence.

## Split Screen

Use:
- before/after;
- problem/solution;
- compare two concepts;
- text + image.

## Comparison

Use:
- alternatives;
- competitors;
- scenarios;
- tradeoffs.

Prefer clear columns or matrix.

## Timeline

Use:
- chronology;
- roadmap;
- process stages.

## Process

Use:
- 3–6 steps;
- workflow;
- lifecycle.

## Diagram

Use:
- system relationships;
- architecture;
- causal model;
- flows.

## Data Story

Use:
- chart;
- headline insight;
- annotation.

The chart is evidence. The headline states what the viewer should learn.

## Grid

Use:
- portfolio;
- feature categories;
- examples.

## Cards

Use sparingly for:
- distinct objects;
- metrics;
- categories.

## Quote

Use:
- strong external voice;
- customer insight;
- memorable statement.

## Full Bleed Visual

Use:
- image-led storytelling;
- major visual transition.

## Closing Statement

Use:
- final message;
- clear next action.

---

# 4. One Slide = One Main Message

Every slide must have a sentence-level takeaway.

Bad title:
`Market Overview`

Better:
`Demand is shifting toward smaller, faster deployment cycles`

A title should often communicate the insight rather than the topic.

---

# 5. Text Density

Default limits:

- title: 4–12 words;
- subtitle: 1–2 lines;
- body: compact;
- bullets: avoid unless list structure is truly useful;
- paragraphs: rare;
- detailed notes: speaker notes, not slide body.

Replace dense text with:
- diagram;
- annotated image;
- timeline;
- process;
- matrix;
- comparison;
- quote;
- chart;
- cards.

---

# 6. Composition

Use a grid.

Typical layout:
- safe margins;
- consistent title zone;
- content zone;
- footer / page indicator when needed.

Maintain alignment across slides.

Prefer:
- optical balance;
- strong anchors;
- whitespace;
- intentional asymmetry.

Avoid:
- randomly centered objects;
- nearly aligned objects;
- inconsistent slide margins.

---

# 7. Design Elements Library

Solar may use these as building blocks:

```text
section numbers
thin divider lines
pill labels
metric cards
quote marks
caption bars
progress indicators
timeline connectors
small icons
image masks
mini legends
callout cards
highlight rectangles
annotation lines
status dots
index numbers
background typography
corner labels
chapter markers
comparison chips
```

Use only elements that support the content.

Do not decorate every slide with all available elements.

---

# 8. Image Usage

Images should:
- have a clear purpose;
- be cropped intentionally;
- align to the grid;
- use consistent treatment;
- avoid tiny unusable thumbnails.

Possible treatments:
- full bleed;
- edge-aligned crop;
- masked rounded rectangle;
- split composition;
- background with overlay;
- image + caption.

Avoid generic stock imagery when a diagram or real product visual communicates more.

---

# 9. Charts

The chart must answer a question.

Workflow:

1. identify the key insight;
2. choose simplest chart type;
3. remove visual clutter;
4. highlight relevant series;
5. label important values directly;
6. add one concise interpretation.

Avoid:
- unnecessary legends;
- 3D charts;
- too many colors;
- decorative gradients;
- showing every decimal;
- charts that require 30 seconds to decode.

---

# 10. Diagram Design

For systems and processes:

- use consistent node shapes;
- use minimal connector styles;
- label relationships clearly;
- group related nodes;
- avoid crossing connectors where possible;
- use alignment and spacing before extra colors.

A diagram should become easier to understand when viewed from several feet away.

---

# 11. Typography

Use a deliberate scale.

Example:

```text
hero: very large
slide title: large
section title: medium-large
body: readable
caption: small but clear
```

Avoid:
- tiny text;
- more than 2–3 font families;
- excessive bold;
- underlining as decoration.

Use the template’s existing fonts when a template exists.

---

# 12. Color Strategy

Use:
- one dominant background direction;
- one neutral text system;
- one accent;
- optional status colors.

Do not use a new accent color on every slide.

For premium black/white decks:
- use white/black as dominant;
- gray for hierarchy;
- one accent only when it adds meaning.

---

# 13. Consistency Without Repetition

Consistency:
- title placement;
- margins;
- type scale;
- color tokens;
- footer behavior.

Variation:
- composition;
- image scale;
- diagram style;
- chart placement;
- visual rhythm.

Do not produce 15 identical cards-on-grid slides.

---

# 14. Slide Rhythm

A good deck alternates density.

Example:

```text
dense analytical slide
→ simple statement slide
→ visual slide
→ process slide
→ data slide
→ section break
```

This improves pacing and comprehension.

---

# 15. Presentation-Specific Anti-Patterns

Never default to:

- title + 5 bullets;
- giant text box pasted from a report;
- random icons;
- clipart;
- overdecorated backgrounds;
- tiny charts;
- meaningless stock imagery;
- more than one major message per slide;
- different typography on every slide;
- fake dashboard screenshots;
- unreadable data tables.

---

# 16. PowerPoint Build Rules

When generating PPTX:

- use actual shapes and editable text where possible;
- keep visual hierarchy editable;
- avoid flattening entire slides into images;
- preserve aspect ratio;
- align objects precisely;
- keep important content inside safe bounds;
- inspect for overlap;
- inspect for clipping;
- inspect speaker notes if used;
- use theme-consistent colors;
- reuse master-like layout logic.

---

# 17. Design Workflow

For each slide:

1. state the slide takeaway in one sentence;
2. choose the best slide type;
3. decide what should be visual;
4. sketch composition;
5. place the dominant element;
6. add supporting content;
7. align to grid;
8. remove unnecessary elements;
9. verify readability;
10. compare with surrounding slides for rhythm.

---

# 18. Quality Gate

Before completing the deck:

- [ ] Every slide has one main takeaway.
- [ ] No slide is a paragraph dump.
- [ ] Layouts vary intentionally.
- [ ] All objects align to a common system.
- [ ] Font sizes remain readable.
- [ ] Colors are consistent.
- [ ] Images are purposeful.
- [ ] Charts state a clear insight.
- [ ] Diagrams are understandable.
- [ ] No content is clipped.
- [ ] No objects overlap accidentally.
- [ ] Repeated elements are consistent.
- [ ] Deck has visual pacing.
- [ ] Final slide ends with a strong conclusion or action.

---

# 19. Handoff

Combine with:
- `solar.presentation-animation` for staged reveals;
- `solar.artifact-builder` for generating complete PPTX files.

When animation and layout conflict, preserve layout clarity first.
