# BUD-000 — Domain Reconciliation

**Status:** Draft for review
**Scope:** Budget domain only. Where this document touches Transactions, Categories, People/Groups, Bills, or Home, it describes boundary/interface concerns only — it does not re-audit those domains.
**Method note:** Section 1 and Section 3's "exists today" columns are repository evidence (grep/line-level, from BUD-000 Phases 1–4, audited against `App.jsx`, canonical file, 16,316 lines). Sections 2, 4, 5, and 6 mix that evidence with the stated product direction and are recommendations, not facts about the current system.

---

## 1. Current Domain Model (repository evidence only — no recommendations)

Budget, as implemented today, is not one domain — it is **five independently-built mechanisms that happen to share a UI page**, plus global state that doesn't belong to any of them.

**Household budget** — a flat annual number (`annualBudget`, default ₹600,000) plus an optional per-month override map (`monthOverrides`). Both are declared as global state in the app shell (`AppContent`, lines 761–767), not inside any Budget-specific boundary. `BudgetPage` is the only place that can write to them; `Home`, `OutlookPage`, and `BudgetPage` each independently recompute the same "resolve this month's value" formula in six separate places, with no shared function.

**Person budget** — `spendBudget` (base) and `spendBudgetOverrides[month]` (override) live as fields on the Person object, gated by module membership (`getPersonModules(p).includes("budget")`). Owned end-to-end by People (base) and BudgetPage (override) with clean, non-duplicated writes.

**Group budget** — same shape as person budget (`manualLimit` / `manualLimitOverrides[month]`), same ownership split, opt-in at creation.

**Category budget** — a single flat field, `cat.budget`, on the Category object. No override layer exists. Owned entirely by Settings.

**Event budget** — `ev.budget`, a flat field on the Event object, not yet traced beyond declaration.

**Orphaned mechanisms** (exist in code, own nothing, serve no live purpose):
- A legacy flat monthly budget (`monthBudget` state, ₹50,000 default, key `arth_budget`) whose derived values (`remaining`, `safePerDay`) are computed once and never read anywhere in the file.
- `perPersonBudgets`, a state object still written to localStorage and included in every cloud sync push/pull payload, never read for any computation.
- Two fully-built modals (`editingMonthBudget` and `budgetOverrideMonth`) for editing a household month override — both permanently unreachable; nothing in the codebase ever opens either one.

**Cross-cutting rules with no clear home:**
- Carry-forward: when enabled, current month's effective budget = base monthly + max(0, previous month's budget − previous month's spend), where "spend" excludes any transaction with a `groupId`. Implemented identically in two places (Home, BudgetPage).
- Alert thresholds (80% warning, 100%+ escalation) exist only for person budgets, generated in the app shell, duplicating BudgetPage's own threshold display logic by hand.
- A cash-only exclusion rule (SIPs, CC statements, generic "Credit Card" bills don't count as budget-relevant spend) is implemented in exactly one place — `OutlookPage`'s forecast card — and nowhere else that computes spend-vs-budget.

**What today's model fundamentally is:** four parallel "amount vs. actual" trackers (household, person, group, category) sharing no common structure, resolution logic, or state boundary, bolted onto Person/Group/Category objects as incidental fields rather than existing as their own concept.

---

## 2. Target Domain Model (product intent)

Per stated product direction, Budget becomes the household's **financial planning and control domain** — not a monthly-limit display, but the system that expresses *intent* against which Transactions (which record *fact*) are measured.

Core principles as given:
- **Transactions record facts; Budget records intent.** Budget never creates or owns a transaction; it defines what was planned, and reads transactions to see what happened.
- **Budget owns planning, allocation, review, forecasting, and financial control** as a connected set of capabilities, not four unrelated screens.
- **Categories are referenced, not owned.** A category is an identity (name, icon) that Budget can target with an allocation; the amount is Budget's concern, not the category's.
- **Hierarchical, multi-dimensional allocation.** Budget supports allocations against household, category, person, goal, project, trip, liability — not a fixed list of four silos.
- **One transaction may contribute to multiple budget dimensions simultaneously** — e.g. a single expense could count against a category allocation, a person's allocation, and a trip allocation at once, rather than being attributed to exactly one bucket.
- **Budget becomes the primary financial planning workspace.** Home remains the operational, glanceable dashboard; Budget is where planning and review actually happen.

This is a materially different shape from today's model: today, "budget" means four flat numbers with optional monthly overrides. The target model treats budgeting as a **planning and allocation system with its own lifecycle** — periods, allocations, variance, forecast, and health as connected concepts, not incidental page features.

---

## 3. Gap Analysis

| Capability | Status | Evidence |
|---|---|---|
| **Household-level planning (a target amount)** | Exists today | `annualBudget`/`monthOverrides`, lines 761–766 |
| **Category-level allocation** | Implemented differently | `cat.budget` is a flat field on Category, no period concept, no override layer (Settings, lines 12238/12291) |
| **Person/Group-level allocation** | Implemented differently | Fields on Person/Group objects rather than independent allocation records (8744, 8753, 12476, 12482) |
| **Goal-based allocation** | Missing entirely | No goal-related budget state found anywhere in the file. (Note: `GOAL-000` hasn't run yet per your roadmap — this gap is expected, not a defect.) |
| **Project/Trip-based allocation** | Missing entirely | No project or trip budget state found. Trips exist as a domain elsewhere in the app but carry no budget-allocation link. |
| **Liability-based allocation** | Implemented differently, narrowly | EMIs/liabilities are only *excluded* from budget spend via `isCashOnlyNotBudget` (OutlookPage only) — there's no allocation *toward* a liability, only a rule that keeps it out of the discretionary-spend bucket. |
| **Multi-dimensional transaction contribution** | Missing entirely | Every transaction today carries a single category attribution and a single person/group attribution (per ADR-030's frozen transaction shape, per your memory notes) — there's no mechanism for one transaction to feed more than one budget dimension at once. |
| **Budget Period as a first-class concept** | Implemented differently | Periods are implicit — a calendar month string (`viewMonth`) or a fiscal year — not a modeled entity. No support for custom or non-calendar periods. |
| **Variance analysis** | Partially implemented, duplicated | Computed correctly but independently in at least 6 places (Phase 3), with two different null-handling semantics (`||` for household vs `??` for person/group) that produce different results for an explicit-zero override. |
| **Budget health** | Partially implemented | `healthColor`/`healthLabel` logic exists only inside BudgetPage's dashboard tab (line ~12551) — not a reusable concept, not exposed to Home. |
| **Forecasting** | Partially implemented, scattered | "Next month" forecasting exists in both `Home` and `OutlookPage` independently; no single forecast concept feeds both. |
| **Financial control / alerts** | Partially implemented, narrow | Alerting exists only for person budgets (80%/100% thresholds); no equivalent for household, group, or category budgets. |
| **Carry-forward** | Exists today, duplicated | Identical logic in two places (Home line 7660, BudgetPage line 12528) |
| **Budget Snapshot / history** | Missing entirely | No historical/point-in-time record of a budget or its performance exists — `monthOverrides` is a live, mutable map, not a snapshot log. |
| **Review workflow** | Partially implemented | BudgetPage's "Where Money Went" panel is a review surface, but it's category-only and doesn't cover person/group/household in the same view. |

---

## 4. Candidate Domain Objects

Domain-level only — no schema, no class design.

- **Budget** — the aggregate root: a household's overall financial plan for a period.
- **Budget Allocation** — an amount of intent assigned to a target dimension (category, person, group, goal, project, trip, liability) for a period. This is the object that today is scattered across `cat.budget`, `p.spendBudget`, `g.manualLimit`.
- **Budget Period** — a time window (calendar month, fiscal year, or eventually custom) that an allocation and its variance are measured against. Today this is implicit string-keying (`viewMonth`), not a modeled concept.
- **Budget Variance** — the computed comparison of actual (from Transactions) against an allocation, for a period. Today this exists as six independent inline calculations rather than one derived concept.
- **Budget Health** — a derived status (on track / cutting it close / over) from a variance. Today exists only inside BudgetPage's dashboard tab.
- **Budget Forecast** — a projection of where a period will land given current pace. Today split between Home and OutlookPage with no shared source.
- **Budget Alert** — a threshold-crossing notification tied to a variance. Today exists only for the person dimension.
- **Budget Snapshot** — a frozen, point-in-time record of a completed period's allocation vs. actual, for historical review. Does not exist today in any form.
- **Transaction Contribution** (or Allocation Link) — the mechanism by which one transaction can count toward more than one Budget Allocation at once. This has no analogue in the current system at all — it's the single largest structural gap, and it intersects the transaction shape frozen by ADR-030.

---

## 5. Ownership Boundaries

| Domain | Relationship to Budget |
|---|---|
| **Transactions** | Budget **consumes** transaction facts (amount, date, category/person/group attribution) to compute variance. Budget never creates, edits, or owns a transaction. This is already true today and should stay true. |
| **Accounts** | Budget **consumes** account balances / credit outstanding where relevant to forecasting (e.g. cash-position-aware safe-to-spend). Budget does not own account state. |
| **Categories** | Category **owns identity** (name, icon, color). Budget **owns the allocation that targets a category** — `cat.budget` should move out of Category and become a Budget Allocation record referencing a category, not a field on it. |
| **People / Groups** | Same pattern as Categories: People/Groups own identity and membership; Budget owns the allocation targeting a person or group. `p.spendBudget`/`g.manualLimit` move out of the Person/Group objects. |
| **Goals** | Not yet auditable — `GOAL-000` hasn't run. Recommend treating "Budget allocates toward a Goal" as the working assumption, but deferring any commitment until Goals has its own ownership analysis, consistent with how you've sequenced the roadmap. |
| **Events** | Same pattern as Categories — Event owns identity, Budget would own an allocation targeting it. `ev.budget` migrates out of Event. |
| **Investments** | Stays separate. SIPs are already classified cash-only/non-budget (CBR-BUD-11) in the one place that rule currently exists. Budget should consume committed SIP amounts as fixed known outflows for forecasting purposes, without owning any investment data. |
| **Liabilities** | Budget consumes liability due-amounts as fixed committed obligations for forecasting; it does not own liability terms, EMI schedules, or interest calculations — that stays with the liability/EMI mechanism. |
| **Home** | Home becomes purely a **consumer** of Budget's read-model (safe-to-spend, variance, health) for its operational cards. Home should stop computing its own copy of the monthly-budget formula — this is the most direct, concrete fix implied by the target model, and it's already something the repository evidence flags as duplicated. |

---

## 6. Risks

**Legacy state that could mislead a rebuild**
- The dead `monthBudget`/`remaining`/`safePerDay` mechanism (₹50,000 default) sits right next to the live `annualBudget` state with a confusingly similar name. A less careful pass could mistake it for a second source of truth rather than dead code — worth deleting outright before modernization work begins, not just ignoring.
- `perPersonBudgets` is still in every user's cloud snapshot. It's safe to stop writing/reading it, but removing it from the sync payload is a cloud-schema change that touches every existing user's stored data — treat as a migration step, not a quiet code deletion.

**Orphaned UI**
- The two dead month-override modals should be explicitly retired (not silently left in place, and not casually "fixed" by wiring them back up) — the target model's allocation editor will replace this functionality entirely, so resurrecting the old one first would be wasted work.

**Duplicated logic as a migration hazard**
- Six independent copies of the monthly-value formula, two copies of carry-forward, and inconsistent `||` vs `??` null-handling between household and person/group resolution are all real, currently-live behavior. A cutover to a single canonical resolver needs to explicitly decide which semantic wins (particularly the zero-override question) — this is a business-rule decision, not just a refactor, since it can change what number a user sees.

**Orphaned business rule**
- The cash-only exclusion rule (SIP/CC-statement/Credit-Card) lives only in OutlookPage today. If it's meant to apply universally under the target model, its natural home is arguably Bills (since it's a classification of bill *type*), with Budget consuming it — not reimplementing it a second time inside the new Budget domain.

**Coupling to a frozen, unrelated ADR**
- The target model's core new capability — one transaction contributing to multiple budget dimensions — directly intersects the transaction data model frozen by **ADR-030**, which your own memory already flags as having an open, unresolved reconciliation item (People/splitPeople vs. the new PersonShare design). This means BUD-000's biggest structural gap can't be closed in isolation — it's coupled to that open TRX-adjacent item, and the migration plan should treat it as a dependency, not a parallel, independent workstream.

**Scale of the data migration itself**
- Moving `cat.budget`, `p.spendBudget`, and `g.manualLimit` out of their current host objects and into first-class Allocation records is a live-data schema migration across every user's cloud-synced state, not a code-only refactor. This deserves its own explicit migration plan with a rollback path, in line with the engineering discipline already established for TRX/ACC/HOME.

---

*This document is intended to feed Aggregate Identification, ADR Review, and the modernization/migration plan for BUD-000. Holding for review before continuing.*
