# Arth Engineering Documentation Index

## Core Documents (Read First)

1. **`DOCS_INDEX.md`** — this file. Navigation guide for all engineering
   documentation.
2. **`CODING_STANDARDS.md`** — engineering principles, both extraction
   checklists (screen-level and function-level), and lessons learned.
3. **`ARCHITECTURE_DECISIONS.md`** — ADR-lite log of intentional design
   choices and why they were made.
4. **`DEPENDENCY_MAP.md`** — current dependency measurements,
   classifications, and extraction status.

## Design Documents

Describe planned architecture and implementation approaches — not yet
fully built, or built but still evolving.

- **`USE_ARTH_DATA_DESIGN.md`** — the shared data layer's design spec.
  Design only, not yet implemented.
- **`COMPONENT_INVENTORY.md`** — UI primitives audit: what's real, what's
  shared styling but not a component, what's still duplicated.
- **`EXTRACTION_CHECKLIST.md`** — the 8-point checklist every screen
  extraction must pass.

## Product

- **`ARTH_SCOPE.md`** — what's in scope for V1 vs. deferred to V2.
- **`RELEASE_NOTES.md`** — user-facing history: what's new, improved,
  fixed, known limitations.
- **`SCREEN_ARCHITECTURE.md`** — per-screen status and implementation
  notes.

---

## Living Documents

Evolve continuously during development — expect to edit these often.

- `CODING_STANDARDS.md`
- `DEPENDENCY_MAP.md`
- `COMPONENT_INVENTORY.md`
- `REGRESSION_CHECKLIST.md`
- `TECH_DEBT.md`

## Historical Record

Record *why* and *when* — append to these, don't rewrite history in them.

- `ARCHITECTURE_DECISIONS.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`

---

## Document Ownership

| Document | Purpose |
|---|---|
| `CODING_STANDARDS.md` | Rules |
| `DEPENDENCY_MAP.md` | Measurements |
| `CHANGELOG.md` | Completed work (developer-facing) |
| `RELEASE_NOTES.md` | Completed work (user-facing) |
| `TECH_DEBT.md` | Known defects, deferred engineering work |
| `ARCHITECTURE_DECISIONS.md` | Design rationale |
| `REGRESSION_CHECKLIST.md` | Release verification |
| `COMPONENT_INVENTORY.md` | UI primitive audit |
| `USE_ARTH_DATA_DESIGN.md` | Data layer design |
| `SCREEN_ARCHITECTURE.md` | Per-screen status |
| `ARTH_SCOPE.md` | Product scope |
| `EXTRACTION_CHECKLIST.md` | Extraction process |

---

## Current Milestone

**Name:** Domain Layer Phase 1

**Status:** 🟡 Awaiting runtime regression — engineering-complete,
product-complete pending the Cards table in `REGRESSION_CHECKLIST.md`
being run against the live app. Not yet confirmed as of this writing.

**Completed**
- Shared domain module (`domain/shared/remainingShare.js`)
- Bills period calculations (`domain/bills/periodCalculations.js`)
- Cards summaries (`domain/cards/summaries.js`)
- Design System v1 (`BottomSheet`, `EmptyState`, `StatCard`)
- Goals extraction (`screens/GoalsScreen.jsx`)
- Events extraction (`screens/EventsScreen.jsx`)

**Next**
1. Runtime regression on Cards (blocking — see Status above)
2. Bills refunds domain (`computeRefundTotalsByBill`, `getNetBillAmount`) — Pass 2
3. Bills dependency re-measurement (post Pass 2)
4. UI/UX polish sprint

**Blocked by**
- Runtime regression checklist (Cards) — not yet run/confirmed

---

## Documentation Maintenance Rules

Every architectural extraction should update:
- `CHANGELOG.md`
- `DEPENDENCY_MAP.md`
- `COMPONENT_INVENTORY.md` — if applicable (a UI primitive was touched)
- `ARCHITECTURE_DECISIONS.md` — if an intentional design decision was made
- `REGRESSION_CHECKLIST.md` — if runtime behavior requires verification

`TECH_DEBT.md` should only be updated for known defects or deliberately
deferred engineering work — never for intentional decisions (those go in
`ARCHITECTURE_DECISIONS.md` instead).

## Reading order for someone new to the project

1. `ARTH_SCOPE.md` — what Arth is
2. `SCREEN_ARCHITECTURE.md` — what's built
3. `ARCHITECTURE_DECISIONS.md` — why it's built this way
4. `CODING_STANDARDS.md` — how to add to it correctly
5. Everything else, as needed
