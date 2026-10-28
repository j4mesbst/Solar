---
id: solar.debugging
name: Debugging
version: 1.0
category: engineering
priority: critical
scope:
  - bugs
  - crashes
  - build-errors
  - runtime-errors
  - regressions
  - performance
triggers:
  - bug
  - crash
  - error
  - broken
  - does-not-work
  - regression
  - failing-test
compatible_with:
  - solar.software-engineer
  - solar.artifact-builder
---

# Solar Skill — Debugging

## Purpose

This Skill gives Solar a disciplined debugging procedure.

The objective is to replace guess-and-patch behavior with evidence-driven diagnosis.

Core loop:

```text
observe
→ reproduce
→ isolate
→ hypothesize
→ test
→ patch
→ verify
→ regression-check
```

---

# 1. Start With the Symptom

Capture:

- expected behavior;
- actual behavior;
- when it occurs;
- whether it is deterministic;
- environment;
- relevant logs;
- recent changes.

Do not start changing code before understanding the failure.

---

# 2. Reproduce

Find the smallest reliable reproduction.

Document:

```text
starting state
→ action
→ failure
```

If reproduction is intermittent:
- record frequency;
- inspect timing;
- inspect concurrency;
- inspect external dependencies.

---

# 3. Classify the Failure

Possible categories:

- compile/type error;
- runtime exception;
- logic bug;
- UI state bug;
- rendering/layout bug;
- async race;
- network/API issue;
- persistence/data issue;
- configuration issue;
- performance issue;
- platform-specific issue.

Classification narrows investigation.

---

# 4. Read Errors Carefully

Compiler and runtime errors are evidence, not absolute truth about root cause.

Check:
- first meaningful error;
- surrounding errors;
- stack frame ownership;
- recent API changes;
- type inference cascades.

A reported line may be downstream of the real problem.

---

# 5. Isolate

Reduce scope.

Methods:
- disable half the path;
- inspect one layer at a time;
- replace external dependency with known value;
- reproduce with minimal input;
- inspect state transitions;
- compare working vs failing version.

Avoid changing five things at once.

---

# 6. Form a Testable Hypothesis

Good hypothesis:

`The old generation task is updating the view model after a newer task has replaced it.`

Weak hypothesis:

`SwiftUI is buggy.`

A hypothesis must predict an observable result.

---

# 7. Test the Hypothesis

Use:
- logging;
- debugger;
- assertion;
- temporary instrumentation;
- unit test;
- controlled reproduction.

If evidence contradicts the hypothesis, discard it.

Do not defend a favorite theory.

---

# 8. Patch the Root Cause

Prefer:
- smallest fix;
- explicit ownership;
- validation at boundary;
- stable state transitions.

Avoid symptom hiding.

Example:
- if stale tasks overwrite state, add cancellation/generation identity;
- do not merely delay UI updates.

---

# 9. Verify

Repeat original reproduction exactly.

Then test:
- nearby behavior;
- boundary cases;
- rapid repeated interaction;
- empty state;
- failure state.

A patch is not verified merely because it compiles.

---

# 10. Regression Test

When practical, convert the bug into a test.

A good regression test:
- fails before fix;
- passes after fix;
- describes user-visible behavior.

---

# 11. UI Debugging

Inspect:

- state ownership;
- conditional rendering;
- z-index/layers;
- layout constraints;
- intrinsic size;
- parent clipping;
- animation state;
- hit testing;
- focus.

For “view disappears” bugs:
- verify it is not clipped;
- verify opacity;
- verify z-order;
- verify frame;
- verify conditional state.

---

# 12. Async Debugging

Inspect:

- task cancellation;
- identity of active request;
- actor/thread;
- ordering;
- callbacks after deinit;
- stale closures;
- retries.

Log request IDs when multiple operations can overlap.

---

# 13. Networking

Check:

- URL;
- method;
- headers;
- auth;
- body encoding;
- status code;
- response schema;
- timeout;
- retry policy.

Do not treat every 401/403/500 as a parsing error.

---

# 14. Data / Persistence

Check:

- migration;
- optional/null handling;
- schema mismatch;
- encoding;
- stale cache;
- versioning;
- corruption handling.

Never “fix” data bugs by deleting user data unless explicitly justified.

---

# 15. Performance Debugging

Measure:
- CPU;
- memory;
- allocations;
- render frequency;
- I/O;
- network;
- model load time;
- prompt construction.

For Solar local models:
- separate model startup time from generation time;
- measure time-to-first-token;
- measure tokens/sec;
- inspect context size;
- inspect reload frequency.

---

# 16. Logging Rules

Logs should include:
- action;
- state;
- identifier;
- failure;
- timing.

Never log:
- API keys;
- auth tokens;
- sensitive user content unnecessarily.

Remove temporary noisy logs before completion.

---

# 17. Anti-Patterns

Never debug by:

- random edits;
- adding arbitrary delays;
- suppressing exceptions;
- restarting until it works and calling it fixed;
- rewriting subsystem without evidence;
- trusting only one error line;
- ignoring reproducibility.

---

# 18. Debugging Report

When useful, summarize:

```text
Symptom:
...

Root cause:
...

Fix:
...

Verification:
...

Regression risk:
...
```

Do not invent certainty.

---

# 19. Quality Gate

- [ ] Failure reproduced or evidence gathered.
- [ ] Failure category identified.
- [ ] Hypothesis was testable.
- [ ] Root cause distinguished from symptom.
- [ ] Fix is minimal.
- [ ] Original reproduction passes.
- [ ] Nearby flows checked.
- [ ] Temporary instrumentation removed.
- [ ] Regression test added where reasonable.
- [ ] No destructive workaround.

---

# 20. Handoff

Combine with `solar.software-engineer` for implementation.

Use `solar.motion-design` when issue involves transitions.

Use `solar.premium-ui-design` when issue is visual consistency rather than correctness.

# 21. Differential Debugging

When there is a known working version, compare it with the failing version.

Inspect:

- changed dependencies;
- changed configuration;
- changed data;
- changed environment;
- changed code paths.

Use version control history when available.

A small meaningful difference is usually more valuable than a large code review.

---

# 22. Binary Search Strategy

For regressions across many commits or changes:

1. identify a known-good state;
2. identify a known-bad state;
3. test the midpoint;
4. repeat.

Use this when it is faster than inspecting every change manually.

---

# 23. Invariant-Based Debugging

Define invariants that should always be true.

Examples:

```text
There can be only one active generation task.
Every conversation message has a stable identifier.
The selected model must exist before generation begins.
UI state updates must occur on the expected actor/thread.
```

Instrument these invariants with assertions or tests.

When an invariant breaks, investigate the first point where it stops being true.

---

# 24. Boundary Debugging

Many bugs occur at boundaries:

- UI ↔ view model;
- app ↔ API;
- model ↔ persistence;
- Swift ↔ C library;
- frontend ↔ backend;
- local model ↔ prompt adapter.

When the symptom is confusing, inspect boundaries before internal algorithms.

Verify:
- inputs;
- outputs;
- types;
- ownership;
- timing.

---

# 25. Minimal Reproduction Extraction

For difficult bugs, create the smallest reproduction that preserves the failure.

Remove:

- unrelated UI;
- unrelated dependencies;
- unrelated data;
- optional effects.

If the bug disappears, reintroduce pieces until it returns.

The goal is not to permanently rewrite the app into a minimal example. The goal is to identify the condition that triggers the bug.

---

# 26. Heisenbugs and Timing Issues

For bugs that disappear when logging/debugging:

- avoid assuming the bug is gone;
- inspect race conditions;
- inspect thread scheduling;
- inspect task cancellation;
- inspect timing-sensitive state.

Prefer deterministic instrumentation such as identifiers and timestamps.

---

# 27. Memory Bugs

Look for:

- retained closures;
- reference cycles;
- unbounded caches;
- model instances never released;
- repeated observers;
- large conversation contexts retained forever.

For Solar local-model workflows, distinguish:

- intentional model memory residency;
- accidental duplicate model instances;
- prompt/context memory growth.

---

# 28. Performance Regression Procedure

When performance regresses:

```text
establish baseline
→ reproduce workload
→ measure
→ locate dominant cost
→ change one factor
→ measure again
```

Do not optimize from intuition alone.

Track metrics such as:

- launch time;
- time-to-first-token;
- tokens/sec;
- peak memory;
- CPU;
- render frame time;
- context-building time.

---

# 29. Debugging Generated Code

Generated code has recurring failure modes:

- nonexistent APIs;
- wrong package versions;
- missing imports;
- stale documentation assumptions;
- mismatched method signatures;
- forgotten state wiring;
- duplicated files;
- placeholder logic presented as complete.

Always verify generated code against the actual repository and compiler.

---

# 30. Confidence Levels

Use internal confidence levels:

```text
confirmed — reproduced and verified
strong hypothesis — evidence supports it, not yet verified
possible — plausible but untested
unknown — insufficient evidence
```

Do not describe “possible” as “confirmed.”

---

# 31. Stop Conditions

Stop debugging and reassess when:

- three patches fail without improving evidence;
- the reproduction is no longer reliable;
- investigation has drifted into unrelated modules;
- new evidence contradicts the current theory.

Return to observation and isolation instead of stacking more guesses.

---

# 32. Enhanced Quality Gate

- [ ] Root cause evidence exists.
- [ ] Working/failing behavior was compared where possible.
- [ ] Boundaries were inspected.
- [ ] Relevant invariants were identified.
- [ ] Timing/concurrency considered where applicable.
- [ ] Performance claims measured.
- [ ] Confidence level matches evidence.
- [ ] No workaround hides a deeper known failure.
