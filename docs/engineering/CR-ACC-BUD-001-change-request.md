# CR-ACC-BUD-001 — Reconcile Budget/Allocation Architecture with Canonical Implementation Patterns

**Status:** Open
**Type:** Change Request (per `engineering-method-ownership-driven-modernization.md` — a targeted architecture reconciliation, not a full re-audit)
**Raised:** during WP-1 implementation, upon discovering the real ACC-000/001/002/AQ-003 governance chain and the `AggregateRoot`-based `Account`/`Transaction` implementation pattern, previously unknown to the Budget architecture stream.
**Scope discipline:** this CR does not reopen domain conclusions. It exists solely to answer one question: *how should Allocation be implemented so it is consistent with the platform's established patterns* — not *is Allocation the right domain*.

---

## 1. What remains valid (not reopened by this CR)

Per the method's "evidence beats symmetry" principle and the domain-level evidence already gathered:

- Budget is the planning-and-control domain (BUD-000, BUD-000A).
- Hybrid Allocation — Financial Allocation (planning, reconciling) and Analytical Attribution (classification, non-reconciling) as two distinct concepts — remains supported by repository evidence (the `cat.budget`/`catAllocations` and `p.spendBudget`/`t.people` split, confirmed independently across multiple grep passes).
- Allocation and Financial Calendar as platform capabilities, consumed by Budget rather than owned by it, remains architecturally sound (consistent with ADR-021's Manage/Engine "nouns vs. verbs" precedent, which the real ACC-000 also cites).
- BUD-000 (Repository Audit, Component Audit, Mutation Census, Business Rule Extraction), BUD-001 (Modernization Plan), BUD-002 (UX Specification), BUD-003 (Work Packages) — repository-derived evidence and domain-level conclusions in these documents are **not invalidated** and are **not retired**.

## 2. What is in scope for this CR

The **technical realization** of Allocation, specifically:

1. **Which Budget/Allocation operations are read models** (pure, parameterized, no `AggregateRoot` — the `domain/cards/summaries.js` precedent, which the real ACC-000 explicitly praised as *"already-extracted, clean, parameterized domain logic"*)?
2. **Which are aggregates** (extend `AggregateRoot`, expose commands, raise domain events — the `Account`/`Transaction` precedent)?
3. **Which operations emit domain events**, and what should those events be named/shaped as, consistent with `AccountCreated`/`AccountUpdated`/`AccountArchived`/`AccountDeleted`'s naming convention?
4. **Which remain pure projections indefinitely** — e.g., is `getPlanningAllocation`/`getAttributedTotal` (PR-1's actual functions) correctly modeled as permanent read-only projections, the way `getCardSummary` is, or do they need an aggregate behind them once writes are introduced?

## 3. Renumbering (mechanical, not a design change)

`ADR-035` is occupied by the real, frozen **"Behavior vs. Classification"** decision. My prior `ADR-035-allocation-engine.md` and `ADR-036-financial-calendar.md` are renumbered:

| Old (collision) | New |
|---|---|
| `ADR-035-allocation-engine.md` | `ADR-036-allocation-engine.md` |
| `ADR-036-financial-calendar.md` | `ADR-037-financial-calendar.md` |

**Confirmed free at time of writing** (`find docs -iname "ADR-036*"` returned nothing) — should be re-confirmed against the live repo before either file is committed, given this thread's own track record this session of assuming freed numbers without a final check.

## 4. What is paused, and what is not

- **WP-1 is unaffected and remains complete.** Its adapter functions (`getHouseholdPlanningAllocation`, `getCategoryPlanningAllocation`, `getPersonPlanningAllocation`, `getGroupPlanningAllocation`, `getCategoryAttributedTotal`, `getPersonAttributedTotal`) are read-only, parameterized, pure — the same shape as the praised `summaries.js` precedent. No behavior change, no persistence touched, per its own original scope. This CR does not require rewriting PR-1.
- **WP-3 (Budget Storage Migration) and any future write-path work are paused** pending this CR's resolution. WP-3 already assumed Planning Allocations would be written through *some* canonical path — that path needs to be the `AggregateRoot` pattern (or an explicitly justified departure from it, per "evidence beats symmetry," not by default) before migration work proceeds.
- **WP-2 (Financial Calendar) may proceed** in parallel if it is genuinely read-only/period-calculation (mirrors `summaries.js`'s pattern) — this should be explicitly confirmed as part of this CR's resolution, not assumed.

## 5. What this CR does not decide

- The exact shape of a future `Allocation` aggregate (if one is needed) — that's the CR resolution's job, following ACC-001's precedent of a dedicated aggregate-definition document, not decided inline here.
- Whether Financial Calendar needs any aggregate at all, versus being permanently read-only like `summaries.js` — open, needs evidence-based resolution.
- Any change to Budget's domain model (Sections 1–7 of the original BUD-000 Domain Reconciliation, Aggregate Identification, or the Hybrid Allocation decision) — explicitly out of scope, per Section 1 above.

## 6. Resolution path

Following the same method used for Accounts:
1. Read `AggregateRoot.js` and `Transaction.js` in full (not yet done for this CR — required before drafting a resolution).
2. Determine read-model vs. aggregate boundary for each Allocation/Financial Calendar operation (Section 2's four questions).
3. Produce a short aggregate-definition document (ACC-001-equivalent) for whichever parts of Allocation need one — only if evidence supports it, not by default.
4. Amend `ADR-036-allocation-engine.md`/`ADR-037-financial-calendar.md` to reflect the resolved technical shape.
5. Resume WP-3 only after this is resolved.

---

**Status: Open.** Blocks WP-3 and any future write-path work. Does not block WP-1 (complete) or WP-2 if confirmed read-only.
