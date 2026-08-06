# CR-ACC-BUD-001 — Reconcile Budget/Allocation Architecture with Canonical Implementation Patterns

**Status:** Resolved (see §7) — Planning Allocation aggregate need confirmed; Category Attribution path recommended, undecided (non-blocking); Person Attribution fully resolved against real repository evidence, including a confirmed one-line bug fix needed in PR-1.
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

---

## 7. Resolution (based on `AggregateRoot.js`, `Transaction.js`, `TransactionPersonShare.js`, `Money.js` — read in full)

### Evidence summary

- `AggregateRoot` is minimal: `id`, `_raise()`, `pullEvents()`. No validation baked in — each subclass owns its own invariants and factory pattern. Adopting it is a light commitment, not a heavy framework.
- `Transaction` establishes the full pattern: closed enum via constructor guard, static factory (`.post()`), instance commands (`.edit()`, `.delete()`) each raising a typed event, plus an additional named cross-aggregate contract (`SettlementTarget`, per ADR-033) implemented as extra methods (`outstanding()`, `applySettlement()`).
- `Money` is a frozen value object: rejects negative amounts, rejects non-finite input, rounds to 2 decimals. Exists specifically to replace scattered `Number(x||0)` coercion — the same category of duplication BUG-TRX-001 caused for business logic.
- `TransactionPersonShare` is a frozen value object with two structurally-enforced invariants (`settled` always derived from `remainingAmt`, `settledAmt` never exceeds `amount`) and an immutable-update pattern (`applySettlement()` returns a new instance).

### Resolution per question

**1. Which Budget/Allocation operations are read models?**
Planning Allocation reads (household/category/person/group resolution) and Category/Person Attribution totals — all pure, parameterized, no mutation. Matches the `domain/cards/summaries.js` precedent exactly. **Confirmed pattern to follow; no aggregate needed for the read side itself.**

**2. Which are aggregates?**
A new **Planning Allocation aggregate** is needed, modeled directly on `Account`'s shape: closed dimension-type enum (household/category/person/group, extensible later per ADR-035A) as a constructor guard, static factory, `update()`/`delete()` commands, `Money`-typed amounts (not raw numbers), each command raising a typed event. This is the one place evidence clearly calls for new aggregate work, not reuse of anything existing.

**3. Which emit domain events, and what should they be named?**
Following `Transaction`'s (`TransactionPosted`/`Edited`/`Deleted`) and `Account`'s (`AccountCreated`/`Updated`/`Archived`/`Deleted`) naming convention: `PlanningAllocationSet`, `PlanningAllocationUpdated`, `PlanningAllocationRemoved`. Exact naming is implementation detail for whoever writes the aggregate — pattern is fixed, literal names are not frozen here.

**4. Which remain pure projections indefinitely?**
Category/Person Attribution totals, and all four Planning Allocation read functions from PR-1 — **once** the aggregate in #2 exists to validate what's being read. Not standalone before that; today they read unvalidated raw fields (`annualBudget`, `cat.budget`), which is fine for WP-1's read-only scope but not a permanent state.

### Person-dimension Attribution — RESOLVED, verified against real `App.jsx`

`t.people` is confirmed to belong to Transaction (matches the `TransactionPersonShare` shape). The blocking question — whether attribution mode determines budget-countability — is now answered directly from repository evidence, not inferred:

**Confirmed repository behavior:**
- Real mode values in production: `"owes"` and `"spent_on"`. **`"on_me"` does not exist anywhere in `App.jsx`** — it was an assumption baked into the sandbox-built `TransactionPersonShare.js` (`VALID_MODES = ["owes", "owes_by_me", "on_me"]`) that does not match the actual repository vocabulary. That aggregate's enum needs correcting before it's trusted as canonical.
- `mode: "owes"` = a receivable owed back to the user (code comment: *"they owe me back — save as receivable"*). Explicitly **excluded** from "my" spend by the app's own `myShare` formula (`amount − sum(mode==="owes")`).
- `mode: "spent_on"` = genuine attributed spend, no debt (code comment: *"for them, no collection — save in people as spent_on"*). Never excluded from spend anywhere in the file.

**Canonical Business Rule (evidence-based, ready for CBR registration):** A person's Analytical Attribution for Budget purposes counts `mode: "spent_on"` entries only; `mode: "owes"` entries are excluded, since they represent a temporary receivable, not attributable household spend.

**Confirmed defect this resolves:** PR-1's `getPersonAttributedTotal` currently sums *all* `t.people` entries regardless of mode — contradicts the rule above. Not yet shipped to any consumer (WP-1 was read-only, unwired), but needs a one-line fix (filter to `mode==="spent_on"`) before this function is trusted for real Budget consumption.

**No longer blocks anything.** Person Attribution's design is settled.

### Category-dimension Attribution — confirmed gap, two viable paths, not decided here

No existing aggregate owns a category-split shape. Two options, neither picked by this CR:
- **(a)** Extend `Transaction` with a `categoryAllocations` array following the exact `TransactionPersonShare`/`Money` pattern (parallel value object, same invariant discipline).
- **(b)** A separate concept entirely, outside `Transaction`.

Recommend (a) on parsimony grounds — it reuses a proven pattern rather than inventing a second one — but this is a recommendation, not a resolution; whoever owns `Transaction`'s domain should weigh in before it's built either way.

### Consequence for PR-1

Confirmed compliance gap, not a defect in what shipped: PR-1's adapter functions use plain `Number()` arithmetic; the real pattern requires `Money`-typed values. Not a problem for WP-1's stated scope (read-only, no persistence) — but any future write path, and arguably the read functions too, should be updated to return/accept `Money` instances once the Planning Allocation aggregate exists, for consistency with `Transaction`/`Account`.

### Status change

CR-ACC-BUD-001 moves from **Open** to **Partially Resolved** — Planning Allocation's aggregate need is settled; Category Attribution has a recommended-but-undecided path; Person Attribution is blocked on one product-level confirmation (`mode` semantics). WP-3 remains paused until the two open items above are closed.
