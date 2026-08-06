# BUD-CLOSE-001 — Budget Modernization Closure

**Status:** Design stream closed. Engineering active.

---

## Scope Completed

BUD-000 · BUD-000A · ARCH-001 · ADR-036 · ADR-037 · BUD-001 · BUD-001A · BUD-002 · BUD-003

## Architecture Decisions (frozen)

- **ADR-036** — Allocation Engine (Hybrid model: Planning Allocation + Analytical Attribution, platform capability)
- **ADR-037** — Financial Calendar (platform capability)

No prior ADR amended. ADR-025 Rule 2 stands as-is, refined in scope by ADR-036, not contradicted.

*(Numbering corrected 2026-08-06: these were originally drafted as ADR-035/036, then renumbered to ADR-036/037 after colliding with the real Behavior-vs-Classification decision, which took ADR-035 — see `CR-ACC-BUD-001` §3. This closure record previously still cited the old numbers.)*

## Planning Deliverables (complete)

- **BUD-002 — Budget UX & Product Specification v1.0 — Frozen 2026-08-06.** Ten parts (Product Intent, Information Architecture, Navigation, User Journeys, Screen Specifications, Component Catalogue, Design Rules, Engineering Mapping, Acceptance Criteria, Future Expansion). No prior BUD-002 was ever found to exist in the repository or in any recoverable session history — this is a first-class specification, not a recovery. Built from Design Input #1 (an exploratory Claude Design mockup, uploaded 2026-08-06) for visual tokens only, never for information architecture, since the mockup predates ADR-036/037. Seven items remain open and are tracked in BUD-002 §F.5 (type/spacing scale confirmation, motion, iconography, responsive behavior, accessibility visual treatment, one shadow tier) — none block WP-4/WP-5 implementation.

## Deferred Items (approved backlog — BUD-003 §"Deferred Streams")

- ADR-035A Addendum (Event/Vehicle dimension promotion, if ever required)
- UX-001 — Planning Allocation Editor design (owned by Product/Design; now scoped by BUD-002 Part D.2 and Part E's component catalogue, still requiring its own visual/interaction pass)
- DS-1 Reports Integration
- DS-2 AI Integration
- DS-3 Event Dimension
- DS-4 Vehicle Dimension
- DS-5 Telemetry
- DS-6 Category Month Overrides
- DS-7 Budget Templates
- DS-8 Budget Cloning
- DS-9 Advanced Forecasting (beyond Release 1's Budget Projection)

**Proposed, not yet backlog** (BUD-002 §I.2 — require a BUD-003 amendment before they're real DS items): Budget History / Snapshots; Scenario Planning / What-if Analysis.

## Engineering Status (as of 2026-08-06 — supersedes the stale "not yet started" state this document previously carried)

```
WP-1  Allocation Engine Integration    In Progress — PR-1 merged (adapter interfaces, tests passing)
WP-2  Financial Calendar Integration   Not Started
WP-3  Budget Storage Migration         Not Started
WP-4  Budget UI Modernization          Not Started — unblocked; BUD-002 now provides a complete spec
WP-5  Insights Migration               Not Started
WP-6  Legacy Cleanup                   Not Started
WP-7  Regression & Release             Not Started
```

**CR-ACC-BUD-001 — Resolved**, not open. Planning Allocation aggregate need confirmed; Person Attribution fully resolved against real repository evidence (CBR registered, one-line bug fix applied); Category Attribution path recommended but explicitly marked non-blocking. `budget-v1-engineering-dashboard.md` still shows this CR as "⚠️ open" and WP-3 as blocked by it — **that dashboard entry is stale and needs correcting alongside this document** (see the accompanying dashboard patch). This closure record no longer treats WP-3 as CR-gated; whatever is actually holding WP-3 back should now be re-evaluated against WP-1/WP-2 completion alone, per the original entry criteria below.

## Entry Criteria for Engineering (met)

- [x] Design stream complete (BUD-000 → BUD-003, all frozen/complete)
- [x] Budget work packages approved (WP-1 – WP-7, BUD-003)
- [x] BUD-002 provides a complete implementation reference for WP-4/WP-5

*(Original entry criteria referenced "ACC Validation complete / signed off" as a gate — that framing predates WP-1 actually starting and conflated ACC's own, separate validation stream with Budget's. ACC's production-data validation remains a real, tracked item elsewhere (see ACC-001/ACC-002 status), but is not treated here as a blocking dependency for Budget engineering specifically, since WP-1 has already been in progress without it.)*

## Exit Criteria for Release 1 (unchanged)

- [ ] Budget Release complete
- [ ] Legacy code removed (WP-6)
- [ ] Migration complete (WP-3, all seven phases)
- [ ] Rollback window closed

---

**This document is the index.** For detail, see the ten artifacts listed under Scope Completed plus BUD-002, plus the live `budget-v1-engineering-dashboard.md` for engineering status going forward — nothing in this closure record substitutes for them, it only points to them.
