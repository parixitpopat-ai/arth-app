# BUD-001 — Budget Modernization Plan

**Status:** Draft for review
**Depends on:** ADR-035 (Allocation Engine, Frozen), ADR-036 (Financial Calendar, Frozen)
**Precedes:** BUD-001A (Implementation Review), BUD-002 (UX Modernization), BUD-003 (Implementation Brief)

---

## 1. Executive Summary

**Current state:** Budget is not one module — it's five independently-built mechanisms (household, person, group, category, event) sharing a UI page, backed by fields bolted onto Person/Group/Category objects, a household budget living as global app-shell state, six duplicate implementations of the same monthly-value formula, two dead modals, and two entirely orphaned mechanisms (legacy `monthBudget`, `perPersonBudgets`). None of this was discovered as a plan going in — it's what BUD-000's Repository Audit through ADR Review found and confirmed, phase by phase, against the actual source.

**Target state:** Budget consumes two platform capabilities — the Allocation Engine (ADR-035) for both planning targets and analytical attribution, and the Financial Calendar (ADR-036) for period definitions — rather than owning either. Budget itself owns: Budget Policy (household config), Budget Periods (as Financial Calendar consumers), and the read-models built on top of Planning Allocations (Variance, Health, Forecast, Safe-to-Spend — computed, never stored, per Aggregate Identification).

**Major architectural changes:**
- Every flat budget field currently living on Category/Person/Group/household-shell (`cat.budget`, `p.spendBudget`, `g.manualLimit`, `annualBudget`, `monthOverrides`) migrates into Planning Allocation records owned by the Allocation Engine.
- Every transaction-level split (`catAllocations`, `t.people`) migrates into Analytical Attribution records, same owner.
- Six duplicate reads of the monthly-budget formula collapse into one Allocation Engine query.
- Two dead mechanisms (legacy `monthBudget`, `perPersonBudgets`) are deleted, not migrated.
- Two dead modals are deleted; a single new Planning Allocation editor replaces both.

**Scope:** This plan covers migrating Budget's existing mechanisms onto ADR-035/036 and rebuilding Budget's own UI on top of the resulting model. It does not cover building out Goals, Trips, Projects, or Liabilities as Allocation Engine consumers — those are future work, explicitly out of scope (Section 8).

---

## 2. Dependency Map

```
Budget
│
├── ADR-035 Allocation Engine          — required, both Planning Allocation and Analytical Attribution
├── ADR-036 Financial Calendar         — required, every period Budget references
├── Transactions                       — source of fact for Attribution and for spend-vs-plan variance
├── Categories                         — dimension identity; cat.budget field removed once migrated
├── People                             — dimension identity; p.spendBudget field removed once migrated
├── Groups                             — dimension identity; g.manualLimit field removed once migrated
├── Accounts                           — Financial Calendar's Billing Cycle period type reads this; Budget itself doesn't touch Accounts directly
├── Bills                              — isCashOnlyNotBudget classification (ADR-024 compliance, confirmed clean in BUD-000A) stays a Budget/Outlook concern, unaffected by this migration
├── Notifications                      — Budget Alert's shared boundary (threshold logic stays Budget-owned, delivery/dismissal stays Notifications-owned, per Aggregate Identification)
├── Home                               — consumes Budget's read-models (Safe-to-Spend, Variance, Health); Home's own duplicate monthBudget calculations are removed as part of this migration, not left in place
├── Goals (future)                     — will consume Allocation Engine directly once GOAL-000 runs; not a Budget dependency
└── Reports (future)                   — will consume Allocation Engine directly; not a Budget dependency
```

**Note on Home:** Home is listed because two of the six duplicate monthly-budget-formula implementations found in BUD-000's Mutation Census live in Home (lines ~7628, ~10852). Removing those and replacing them with a call to Budget's read-model is in scope for this plan, even though it touches Home's code — it's a consequence of retiring the duplication, not a Home redesign.

---

## 3. Migration Strategy

Every current mechanism, mapped. Nothing left unmapped.

| Current implementation | Target |
|---|---|
| `annualBudget` (App.jsx ~761) | Planning Allocation, Household dimension, Fiscal Year period |
| `lastFYTarget` (~764) | Planning Allocation, Household dimension, previous Fiscal Year period |
| `monthOverrides` (~766) | Planning Allocation, Household dimension, Calendar Month period |
| `budgetCarryForward` (~763) | **Stays Budget-owned** — a computation rule Budget applies across Planning Allocations from consecutive periods, not itself an Allocation Engine concept. Currently duplicated (Home ~7660, BudgetPage ~12528); collapses to one implementation inside Budget's read-model layer. |
| `p.spendBudget` | Planning Allocation, Person dimension |
| `p.spendBudgetOverrides[month]` | Planning Allocation, Person dimension, Calendar Month period |
| `g.manualLimit` | Planning Allocation, Group dimension |
| `g.manualLimitOverrides[month]` | Planning Allocation, Group dimension, Calendar Month period |
| `cat.budget` | Planning Allocation, Category dimension |
| `catAllocations` (per-transaction) | Analytical Attribution, Category dimension — completeness rule (sums to transaction total) preserved per ADR-035 Invariant 4 |
| `t.people` (per-transaction) | Analytical Attribution, Person dimension |
| Legacy `monthBudget`/`remaining`/`safePerDay` (~761-767, ~1817) | **Deleted.** Confirmed dead in BUD-000 Phase 1 — no migration target, no consumer. |
| `perPersonBudgets` (~762) | **Deleted.** Confirmed write-only/dead in BUD-000 Phase 1. Removing from the cloud sync payload is itself a schema change — see Risk Register. |
| Two dead modals (`editingMonthBudget`, `budgetOverrideMonth`) | **Deleted**, replaced by one new Planning Allocation editor (WP-4). Not resurrected in their current form. |
| Six duplicate monthly-value reads (AppContent ×2, Home ×2, OutlookPage, BudgetPage ×2) | Collapse to one Allocation Engine query (`getPlanningAllocation`/`getAttributedTotal`, per ADR-035 §7) |
| `budgetAlerts` generator (AppContent ~1732) | Threshold logic stays Budget-owned, reads from Planning Allocations via Allocation Engine instead of directly from `p.spendBudgetOverrides`/`p.spendBudget`; delivery/dismissal unchanged (Notifications) |

**Not migrated, carried as an explicit BUD-001A decision item:** `ev.budget` (Event budget) and `t.vehicleId` (vehicle attribution) exist in the repository but **Event and Vehicle are not in ADR-035's frozen dimension list** (Category, Person, Group, Trip, Goal, Project, Liability, Account). This is not treated as an ADR-035 gap to be quietly closed — the repository evidence available (a field exists; a field is populated) doesn't establish whether Event/Vehicle are genuine long-term analytical dimensions or module-local metadata that only looks like a dimension because it shares a shape with `cat.budget`. That's a different, harder question than what this plan can answer. If Event/Vehicle are ever promoted to Allocation dimensions, that happens through an **ADR-035A Addendum** — a deliberate, separate decision — never by editing ADR-035 directly. Until then, WP-3 does not migrate `ev.budget` or vehicle attribution; both remain in their current, module-local form.

---

## 4. Work Packages

- **WP-1 — Allocation Engine** (ADR-035 implementation). Build the Planning Allocation and Analytical Attribution storage/query/event layer. Blocks everything else.
- **WP-2 — Financial Calendar** (ADR-036 implementation). Build Period definitions, Fiscal Year configuration, Calendar Month wrapping of existing string keys. Blocks WP-3.
- **WP-3 — Budget Storage Migration.** Execute the Section 3 mapping against live, cloud-synced user data: move `cat.budget`/`p.spendBudget`/`g.manualLimit`/`annualBudget`/`monthOverrides` into Planning Allocations; move `catAllocations`/`t.people` into Analytical Attributions; delete the two dead mechanisms and two dead modals. Highest-risk package — see Risk Register and Rollback.
- **WP-4 — Budget UI.** Rebuild BudgetPage on top of WP-1/WP-3: single Planning Allocation editor (replacing the two dead modals with one working implementation), Variance/Health/Forecast read-models computed against the Allocation Engine instead of BudgetPage's own inline duplicate logic.
- **Deferred Stream DS-1 — Reports Integration** and **Deferred Stream DS-2 — AI Integration** — out of scope for this plan (Section 8), listed here only to show where they attach once they exist. Not numbered as work packages — WP-x is reserved for executable Release 1 engineering work (canonical list in BUD-003); DS-x is reserved for approved future work intentionally excluded from the current release. Never reused across documents.

**Sequencing:** WP-1 → WP-2 → WP-3 → WP-4, per this plan. DS-1/DS-2 are not scheduled by this plan or by BUD-003 — see BUD-003's Deferred Streams section for the full DS list.

---

## 5. Risk Register

| Risk | Notes |
|---|---|
| **Live migration on cloud-synced data** | `cat.budget`/`p.spendBudget`/`g.manualLimit`/`annualBudget` currently live on every user's synced Category/Person/Group/household objects. Moving them to Planning Allocation records changes the cloud schema for every existing user, not just new ones. |
| **Cloud sync timing** | BUD-000's investigation into the CC-biller migration (separate stream, same repository) already found a real one-time-effect timing bug where migrations firing on mount can miss data that hydrates from cloud asynchronously afterward. WP-3's migration effect needs to be checked against this exact failure mode before shipping — precedent exists in this same codebase. |
| **Legacy compatibility during rollout** | Users on an old build and users on the new build may have the same account mid-rollout. `catAllocations`/`t.people` need to keep working for read purposes until every client is migrated, per ADR-035 Section 8's phased approach. |
| **Performance** | Collapsing six duplicate reads into one Allocation Engine query changes render-path performance characteristics (fewer redundant `useMemo` recomputations, but a new query layer's own cost is unmeasured). Needs benchmarking before/after, not assumed to be net-positive by design alone. |
| **Duplicate reads during transition** | If WP-4 (Budget UI) ships before WP-3 (storage migration) is fully rolled out to all users, BudgetPage would need to read from both the old fields and the new Allocation Engine simultaneously — a real risk of reintroducing exactly the duplication this whole program exists to remove, if the sequencing isn't respected. |
| **Rollback capability** | Addressed by Section 6's seven-phase approach — WP-3 does not start without this sequence already agreed, not worked out mid-migration. |
| **Dimension-list gap (Event/Vehicle)** | Flagged in Section 3. If WP-3 proceeds without resolving this, `ev.budget` and vehicle attribution either get silently dropped (data loss) or migrated against an unapproved dimension addition (governance violation). Needs resolution before WP-3, not during. |

---

## 6. Rollback

Formalized as the migration strategy for WP-3, not a fallback bolted on afterward:

```
Phase 1 — Create Allocation Engine            (WP-1, already a prerequisite)
    ↓
Phase 2 — Populate Allocation records         (write new records from legacy fields; legacy fields untouched)
    ↓
Phase 3 — Dual-write                          (new writes go to both old fields and new records)
    ↓
Phase 4 — Validate                            (per-user comparison: legacy-derived Variance == new-derived Variance)
    ↓
Phase 5 — Switch reads                        (UI reads from Allocation Engine; legacy fields still present, still correct, just unread)
    ↓
Phase 6 — Freeze legacy                       (legacy fields stop receiving writes; explicit, observable state, not implicit)
    ↓
Phase 7 — Delete legacy                       (only after Phase 6 has held for a defined period with no rollback triggered)
```

**Can users return to the old model?** Yes, through Phase 6. Any phase failure triggers a return to the previous phase's read/write configuration, not a forward fix-in-place — rollback means moving one phase backward, not patching the new path under pressure. Phase 7 is the only irreversible step, and it is gated on Phase 6 holding cleanly, not on Phase 4's validation alone — validation passing once is not the same as the dual-write period having actually proven stable in production.

---

## 6A. Migration Principles

Short, and binding on every phase in Section 6:

1. No user data loss.
2. No breaking cloud synchronization.
3. No irreversible migration step until every prior step has held in production.
4. Legacy reads remain available until validation completes.
5. Every migration step must be independently reversible, except the final deletion.
6. Every work package is deployable independently — WP-1/WP-2 do not require WP-3/WP-4 to ship, and vice versa isn't assumed either.

## 7. Acceptance Criteria

- **WP-1 (Allocation Engine):** Planning Allocation and Analytical Attribution can be created, queried, and updated per ADR-035's conceptual API; automated tests cover the invariants in ADR-035 Section 6 (reconciliation, non-reconciliation, orthogonality), following the TRX-002A precedent of automated tests being a real deliverable, not optional.
- **WP-2 (Financial Calendar):** Fiscal Year, Calendar Month, and Quarter period types return correct boundaries against known dates; existing `"YYYY-MM"` string keys resolve correctly through the new wrapper without behavior change.
- **WP-3 (Storage Migration):** Each of the seven phases in Section 6 has its own pass/fail gate before the next phase begins; Phase 4 (Validate) confirms pre-migration and post-migration Variance calculations produce identical numbers for a real sample of user accounts; Phase 6 (Freeze legacy) is observable and dated, not inferred; Phase 7 (Delete legacy) requires its own explicit sign-off separate from Phase 4's validation passing.
- **WP-4 (Budget UI):** The two previously-dead month-override modals are fully removed from the codebase; a single working Planning Allocation editor replaces them and is reachable from the UI (closing the "unreachable dead modal" finding from BUD-000 Phase 3 for real, not just architecturally); Home's and OutlookPage's duplicate monthBudget-formula code is deleted, not left alongside the new query.
- **Deploy verification:** per established project discipline, `grep -n` confirmation post-replace, brace-balance/duplicate-state/hooks-order checks before delivery, same as every prior modernization stream.

---

## 8. Out of Scope

Explicit, per your instruction:

- Goals UI and Goal-dimension Allocation Engine integration (GOAL-000 hasn't run yet)
- Trip, Project, and Liability dimension onboarding to the Allocation Engine
- AI recommendations built on Allocation/Attribution data
- Reports redesign or Reports' consumption of Analytical Attribution
- Tax planning
- Investment planning
- Resolving the Event/Vehicle dimension-list gap's underlying ADR question (this plan surfaces it; a separate lightweight decision resolves it — see Section 3)

These consume ADR-035/036 later, on their own schedule, once their own module audits (or lightweight scoping) determine how. None of them block Budget's own migration, and Budget's migration should not be gated on any of them being ready first.

---

## Roadmap

```
ADR-035 ✅
ADR-036 ✅
    ↓
BUD-001 — Modernization Plan (this document)
    ↓
BUD-001A — Implementation Review
    ↓
BUD-002 — UX Modernization
    ↓
BUD-003 — Implementation Brief
    ↓
Engineering
```
