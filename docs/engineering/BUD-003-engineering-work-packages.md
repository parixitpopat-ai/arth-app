# BUD-003 — Engineering Work Packages (Release 1 Backlog)

**Status:** Ready for engineering
**Not a specification** — architecture, migration design, and UX are already fixed by ADR-035, ADR-036, BUD-001, and BUD-002. This document is tickets only.

---

## Backlog

| ID | Work Package | Depends On | Est. | Notes |
|---|---|---|---|---|
| UX-001 | Planning Allocation Editor design | — | M | **Owned by Product/Design, not Engineering.** No existing mockup (BUD-002 confirmed this explicitly). Engineering does not start WP-4's editor work until this is approved. |
| WP-1 | Allocation Engine foundation | ADR-035 | L | Planning Allocation + Analytical Attribution storage/query/event layer, per ADR-035 §4–7. |
| WP-2 | Financial Calendar | ADR-036 | M | Period definitions, Fiscal Year config, Calendar Month wrapper over existing `"YYYY-MM"` keys, per ADR-036 §4–7. |
| WP-3 | Budget storage migration | WP-1, WP-2 | XL | The seven-phase migration from BUD-001 §6 (Create → Populate → Dual-write → Validate → Switch reads → Freeze legacy → Delete legacy). Highest-risk package — see BUD-001 Risk Register before starting. |
| WP-4 | Budget UI modernization | WP-1, UX-001 | L | BudgetPage rebuild per BUD-002 Parts A–C. Blocked on UX-001, not just on WP-1. |
| WP-5 | Budget Insights migration | WP-4 | M | Insights → Month/Person/Summary views (existing mockup screens) switched to Allocation Engine as their data source, per BUD-002 Part C. |
| WP-6 | Remove legacy budget code | WP-3 | M | Delete: legacy `monthBudget`/`remaining`/`safePerDay`, `perPersonBudgets`, the two dead modals, and the six duplicate monthly-value-formula implementations found in BUD-000's Mutation Census (AppContent ×2, Home ×2, OutlookPage, BudgetPage ×2). Only after WP-3 Phase 7 (Delete legacy) has run — do not delete code ahead of the data migration that makes it safe to delete. |
| WP-7 | Regression testing | WP-1 through WP-6 | M | Full regression pass; per project standard, includes brace-balance/duplicate-state/hooks-order checks and `grep -n` deploy verification, plus automated tests for ADR-035's invariants (per BUD-001 Acceptance Criteria, WP-1). |

**Sequencing:** UX-001 and WP-1/WP-2 can run in parallel (independent). WP-3 needs both WP-1 and WP-2 complete. WP-4 needs WP-1 and UX-001. WP-5 needs WP-4. WP-6 needs WP-3 fully complete (not just started — see WP-6 note). WP-7 runs last, against everything.

---

## Deferred Streams — explicitly not Release 1

**Governance rule, effective from this document forward:** `WP-x` = executable engineering work for the current release (this document is the canonical, stable numbering — engineers reference these in commits, PRs, and release notes). `DS-x` = approved future work, intentionally excluded from the current release. IDs are never reused across documents or across releases.

| ID | Deferred Stream |
|---|---|
| DS-1 | Reports Integration |
| DS-2 | AI Integration |
| DS-3 | Event Dimension (blocked on the ADR-035A Addendum decision carried forward from BUD-001A — not resolved, not assumed either way) |
| DS-4 | Vehicle Dimension (same — blocked on the same undecided ADR-035A question) |
| DS-5 | Telemetry (none exists in Budget today per BUD-000's audit; adding it is a product decision, not assumed here) |
| DS-6 | Category Month Overrides (flagged during BUD-002 as intentionally excluded — flat-only category budgets remain flat-only) |
| DS-7 | Budget Templates |
| DS-8 | Budget Cloning |
| DS-9 | Advanced Forecasting beyond the Budget-scoped Projection defined in BUD-000A (distinct from ADR-024's Forecast Status, per that naming note) — carried forward from the original list in this document; not in the reference list you provided, kept here so it isn't silently lost. |

These are valid ideas. **They are not part of Budget Modernization Release 1.** Nothing above blocks WP-1 through WP-7. If any of these becomes a priority, it gets its own ticket and its own scoping — it does not get quietly absorbed into an existing Release 1 work package.

---

## Final Roadmap

```
Architecture
──────────────
BUD-000 · BUD-000A · ARCH-001 · ADR-035 · ADR-036

Planning
──────────────
BUD-001 · BUD-001A · BUD-002

Execution
──────────────
BUD-003 (this document)
    ↓
UX-001 ─┐
WP-1 ───┼──→ WP-3 ──→ WP-6 ─┐
WP-2 ───┘         │          ├──→ WP-7 ──→ Release 1
                  WP-4 ──→ WP-5 ┘
```
