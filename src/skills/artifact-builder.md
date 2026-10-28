---
id: solar.artifact-builder
name: Artifact Builder
version: 1.0
category: orchestration
priority: critical
scope:
  - multi-file-generation
  - apps
  - interfaces
  - documents
  - presentations
  - prototypes
  - deliverables
triggers:
  - create
  - build
  - generate
  - artifact
  - app
  - prototype
  - powerpoint
  - document
  - multi-file
compatible_with:
  - solar.software-engineer
  - solar.debugging
  - solar.premium-ui-design
  - solar.motion-design
  - solar.presentation-design
  - solar.presentation-animation
---

# Solar Skill — Artifact Builder

## Purpose

Artifact Builder is Solar’s orchestration Skill.

It decides how to turn a user request into a finished deliverable rather than stopping at explanation.

An artifact can be:
- app;
- component;
- multi-file feature;
- prototype;
- presentation;
- document;
- generated codebase;
- design system;
- exportable file.

The Skill coordinates specialist Skills and verifies the result.

---

# 1. Core Principle

The user asked for an outcome, not a description of an outcome.

Prefer:

```text
understand
→ clarify if necessary
→ select skills
→ inspect environment
→ build
→ render/test
→ inspect
→ repair
→ deliver
```

Avoid:

```text
explain what should be built
→ stop
```

---

# 2. Intent Detection

Before starting, determine:

- artifact type;
- target platform;
- expected fidelity;
- required format;
- constraints;
- available project context;
- whether existing files must be modified;
- whether user needs a preview or final export.

If an ambiguity materially changes the result, activate Solar Intent Clarification.

Do not ask unnecessary questions.

---

# 3. Skill Router

Examples:

## UI feature

```text
software-engineer
+ premium-ui-design
+ motion-design
```

## Buggy UI feature

```text
debugging
+ software-engineer
+ premium-ui-design
```

## Presentation

```text
presentation-design
+ presentation-animation
```

## Full app artifact

```text
software-engineer
+ premium-ui-design
+ motion-design
+ debugging
```

Only load necessary Skills.

---

# 4. Local Model Adaptation

If the active model is local / small:

1. summarize user intent;
2. compress selected Skills;
3. provide only relevant files;
4. split work into bounded stages;
5. verify each stage before continuing;
6. use structured outputs when useful;
7. avoid giant one-shot generation.

The orchestrator should compensate for model size by improving context quality.

---

# 5. Artifact Plan

For nontrivial work, build a compact plan.

Example:

```text
Artifact: Solar clarification UI
Target: macOS SwiftUI

1. Add intent model.
2. Add clarification state.
3. Build popup component.
4. Wire answers into prompt context.
5. Add animation.
6. Add tests.
7. Build.
```

The plan is not the final output. It exists to drive execution.

---

# 6. Dependency Awareness

Before creating files:

- inspect project naming;
- inspect folder structure;
- inspect build system;
- inspect frameworks;
- inspect existing design tokens.

Never create duplicate architecture if the project already has a home for the feature.

---

# 7. Build in Coherent Units

A coherent unit should be:
- small enough to verify;
- large enough to be meaningful.

Example:
- model + tests;
- component + preview;
- service + integration;
- slide section + visual system.

After each unit, inspect for obvious breakage.

---

# 8. Preview / Render Loop

When output can be rendered:

```text
build
→ render
→ inspect
→ compare with request
→ adjust
```

For UI:
- screenshot / preview;
- inspect spacing;
- inspect clipping;
- inspect dark/light mode.

For presentation:
- render slides;
- inspect alignment;
- inspect text overflow;
- inspect visual rhythm.

For code:
- compile;
- test;
- lint/typecheck where available.

---

# 9. Quality Hierarchy

When tradeoffs appear, prioritize:

1. correctness;
2. user intent;
3. usability;
4. accessibility;
5. consistency;
6. performance;
7. visual polish;
8. decorative extras.

Never ship broken behavior because it looks good.

---

# 10. File Generation Rules

Generated files should:

- use meaningful names;
- follow project conventions;
- avoid duplicate copies;
- avoid unnecessary boilerplate;
- include only required dependencies;
- remain editable.

If modifying existing files:
- preserve unrelated content;
- avoid destructive rewrite;
- keep diff focused.

---

# 11. Version Safety

Before large changes:
- inspect current state;
- preserve existing interfaces where possible;
- avoid mass renames unless required.

For risky changes, build incrementally.

---

# 12. Artifact Completion Criteria

An artifact is complete when:

- requested behavior exists;
- visual requirements are satisfied;
- output format is correct;
- build/export succeeds where applicable;
- no obvious broken states remain;
- files are delivered.

“Code generated” is not automatically “artifact complete.”

---

# 13. Clarification QCM Integration

When ambiguity is meaningful:

1. generate 2–4 adaptive questions;
2. show compact choices above chatbox;
3. skip already-known information;
4. allow Other / Skip;
5. inject answers into artifact intent;
6. store a compact summary.

Example:

```text
Intent · macOS · SwiftUI · Minimal · Dark/Light · Local-first
```

The clarification system must not interrupt simple requests.

---

# 14. Failure Recovery

If build fails:

```text
capture error
→ activate debugging
→ isolate
→ patch
→ rebuild
```

Do not abandon the artifact after first failure.

If export format fails:
- identify whether issue is source, toolchain, or format;
- repair the actual layer.

---

# 15. Scope Control

Do not add:
- extra features user did not ask for;
- redesigns unrelated to task;
- dependencies for convenience;
- speculative architecture.

A finished focused artifact is better than a half-finished ambitious one.

---

# 16. Presentation Artifacts

When generating presentations:

- route through presentation-design;
- use editable shapes/text;
- render slides;
- inspect overflow;
- add presentation-animation only if useful.

---

# 17. UI Artifacts

When generating UI:

- route through premium-ui-design;
- route motion through motion-design;
- preserve existing tokens;
- test light/dark;
- test narrow window;
- inspect interaction states.

---

# 18. Code Artifacts

When generating code:

- route through software-engineer;
- build/test;
- inspect diff;
- activate debugging on failure.

---

# 19. Completion Report

At the end, report:

```text
Built:
- ...

Verified:
- ...

Files:
- ...

Notes:
- ...
```

Only include facts that were actually verified.

---

# 20. Quality Gate

- [ ] User intent captured.
- [ ] Correct Skills selected.
- [ ] Existing environment inspected.
- [ ] Artifact built, not merely described.
- [ ] Output rendered/compiled/exported where possible.
- [ ] Errors repaired.
- [ ] Final output matches requested format.
- [ ] Files are editable.
- [ ] No unnecessary scope.
- [ ] Deliverable is actually accessible to the user.

---

# 21. Skill Handoff Contract

Artifact Builder may call specialist Skills.

Each specialist returns:
- decisions;
- implementation guidance;
- quality checks;
- discovered risks.

Artifact Builder remains responsible for final assembly.

No specialist may silently override the user’s explicit requirement.

---

# 22. Local Model Compact Mode

When context budget is constrained, inject only:

```text
GOAL
TASK-SPECIFIC RULES
RELEVANT FILES
ACCEPTANCE CRITERIA
VERIFICATION CHECKLIST
```

Do not inject the entire Skill library.

This compact mode is a core Solar advantage: better orchestration can make smaller models materially more reliable.

# 23. Execution Graph

For larger artifacts, represent work as a dependency graph instead of one linear prompt.

Example:

```text
project inspection
├── design analysis
├── architecture analysis
└── dependency analysis
        ↓
data model
        ↓
service layer
        ↓
UI components
        ↓
integration
        ↓
verification
```

Only parallelize independent work.

Do not let separate generation branches invent incompatible APIs.

---

# 24. Contracts Between Generated Parts

Before generating multiple components, define shared contracts:

- model names;
- public interfaces;
- file ownership;
- theme tokens;
- data structures;
- error types.

This prevents one model pass from generating `IntentQuestion` while another expects `ClarificationPrompt`.

---

# 25. Artifact Manifest

For large artifacts, maintain a lightweight manifest:

```yaml
artifact:
  type: macos-feature
  target: Solar
files:
  - path: ...
    purpose: ...
verification:
  - build
  - unit-tests
design:
  theme: existing
  appearance:
    - dark
    - light
```

Update the manifest as the artifact evolves.

This gives local models a compact source of truth.

---

# 26. Acceptance Criteria

Convert the user request into testable acceptance criteria.

Example:

```text
- QCM appears only when clarification is useful.
- Maximum 4 questions are visible.
- Popup appears above chatbox.
- Dark theme is black/white.
- Light theme is white/black.
- Answers are injected into the generation context.
- User can skip.
- Animation respects Reduce Motion.
```

Every important user requirement should map to a criterion.

---

# 27. Visual Reference Handling

When user supplies screenshots or mockups:

- identify structural patterns;
- identify spacing;
- identify hierarchy;
- identify color behavior;
- identify interaction pattern.

Do not blindly clone irrelevant details.

Preserve the user’s explicit differences from the reference.

---

# 28. Multi-Pass Artifact Generation

For complex outputs:

## Pass 1 — structure

Create the minimal correct structure.

## Pass 2 — functionality

Wire behavior.

## Pass 3 — polish

Apply design and motion.

## Pass 4 — verification

Compile/render/export.

## Pass 5 — repair

Resolve defects found during verification.

This is generally more reliable for local models than one giant prompt.

---

# 29. Quality Scoring

Before delivery, score artifact 0–2 on:

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| Intent match | weak | partial | strong |
| Correctness | broken | mostly works | verified |
| Completeness | partial | usable | complete |
| Consistency | fragmented | mostly coherent | coherent |
| Polish | rough | acceptable | refined |
| Verification | none | partial | executed |

Artifacts below 9/12 should be repaired before delivery when tools permit.

---

# 30. Model Selection Guidance

If Solar can choose among available models:

Use faster/smaller model for:
- file discovery;
- classification;
- summaries;
- repetitive transformations.

Use stronger model for:
- architecture;
- ambiguous requirements;
- difficult debugging;
- complex cross-file generation.

Use deterministic tools for:
- formatting;
- file operations;
- compilation;
- tests;
- validation.

The model should not do work a reliable tool can do better.

---

# 31. Context Budget Management

Maintain a context budget.

Priority order:

1. user request;
2. acceptance criteria;
3. relevant source files;
4. selected Skill rules;
5. architecture summary;
6. recent error output;
7. optional history.

Drop irrelevant chat history before dropping task-critical code.

---

# 32. Repair Loop Limits

Automatic repair should be controlled.

Example:

```text
attempt
→ verify
→ diagnose
→ repair
→ verify
```

If repeated attempts fail:
- stop repeating the same strategy;
- update diagnosis;
- inspect broader dependencies.

Do not create an infinite patch loop.

---

# 33. Final Artifact Audit

Before delivery:

- inspect file list;
- inspect accidental duplicates;
- inspect placeholders/TODOs;
- inspect build output;
- inspect rendered output if visual;
- inspect theme modes;
- inspect content completeness;
- inspect naming consistency.

Deliver only files that belong to the artifact.

---

# 34. Enhanced Completion Contract

Artifact Builder should consider the task complete only when it can answer:

```text
What was requested?
What was actually built?
What verification ran?
What remains uncertain?
Where is the final artifact?
```

If any answer is missing, completion is not yet trustworthy.
