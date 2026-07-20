# Arth — Documentation Index

12 living documents, organized by the question each one answers. When
in doubt about where a new fact belongs, find the category first — one
fact, one home, no overlap (checked against this list as of Domain
Layer Phase 1).

## Product

- **`ARTH_SCOPE.md`** — what's in scope for V1, what's explicitly
  deferred to V2. Read this first if you're unsure whether something
  should be built at all.
- **`RELEASE_NOTES.md`** — user-facing history: what's new, improved,
  fixed, and any known limitations. Written for someone who doesn't
  care how the code works.

## Architecture

- **`ARCHITECTURE_DECISIONS.md`** — ADR-lite log of major *decisions*
  and why they were made (Goals before Timeline, domain layer before
  `useArthData()`, etc.). Not a place for defects — see `TECH_DEBT.md`
  for those.
- **`SCREEN_ARCHITECTURE.md`** — per-screen status: what's built, what's
  extracted, what's deferred to V2, with implementation notes.
- **`USE_ARTH_DATA_DESIGN.md`** — the shared data layer's design spec.
  Design only, grounded against real field names — not yet implemented.
- **`DEPENDENCY_MAP.md`** — coupling metrics: what's been measured,
  audited, and extracted, screen by screen and function by function.
  The evidence behind every extraction decision.

## Engineering Process

- **`CODING_STANDARDS.md`** — conventions, plus the two extraction
  checklists (screen-level "Definition of Extractable," function-level
  "Function Extraction Checklist") and lessons learned from applying
  them.
- **`EXTRACTION_CHECKLIST.md`** — the 8-point checklist every screen
  extraction must pass before it's considered done.
- **`REGRESSION_CHECKLIST.md`** — what needs runtime verification against
  the live app after each pass. Static analysis and a clean build prove
  code correctness; this is the separate gate for behavior correctness.

## Current State

- **`COMPONENT_INVENTORY.md`** — UI primitives audit: what's real and
  reusable, what's shared styling but not a component, what's still
  duplicated and where.
- **`CHANGELOG.md`** — technical/developer-facing history, one entry per
  shipped batch. The `RELEASE_NOTES.md` of this list, but for engineers.

## Maintenance

- **`TECH_DEBT.md`** — tracked defects found during implementation
  (e.g. TD-001, the duplicate UPI-sharing implementation). Deliberately
  separate from `ARCHITECTURE_DECISIONS.md` — a defect isn't a decision.

## Reading order for someone new to the project

1. `ARTH_SCOPE.md` — what Arth is
2. `SCREEN_ARCHITECTURE.md` — what's built
3. `ARCHITECTURE_DECISIONS.md` — why it's built this way
4. `CODING_STANDARDS.md` — how to add to it correctly
5. Everything else, as needed
