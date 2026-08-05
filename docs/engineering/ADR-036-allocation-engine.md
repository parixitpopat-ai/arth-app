## ADR-036 — Allocation Engine

**Status: Frozen (domain/intent), OPEN for technical-shape amendment (see CR-ACC-BUD-001)**

**Renumbered from ADR-035** — that number is occupied by the real, frozen "Behavior vs. Classification" decision, discovered after this document was originally drafted. See CR-ACC-BUD-001 for the reconciliation this triggered: this ADR's domain conclusions (Hybrid model, platform-capability ownership) stand; its technical realization (Section 7's conceptual API, unexamined against the real `AggregateRoot` pattern) is under review.

---

### 1. Context

BUD-000 (Budget module audit) set out to answer a narrower question — what does the Budget domain own — and in the course of Repository Audit through ADR Review surfaced a broader one. Two independent, already-live mechanisms in the repository turned out to be instances of the same unnamed concept:

- `cat.budget` / `p.spendBudget` / `g.manualLimit` / `annualBudget` — flat target amounts, set by a user as a plan, living on the entity they describe (Category, Person, Group) or on the household shell.
- `catAllocations` / `t.people` — per-transaction maps recording what a specific transaction actually contributed to a category or a person, living only inside the transaction.

These were built independently, at different times, by different features, with no shared name and no awareness of each other. BUD-000's Mutation Census additionally found the household-budget resolution formula reimplemented six times across three components with no canonical read path — the direct symptom of there being no owning capability for either mechanism.

ADR-025, Rule 2 had already frozen a partial description of the first mechanism ("People and Groups receive allocations from the Household Budget... allocations of that one pool"), but scoped only to Person/Group, not to Category, and not at all to Trip, Goal, Project, or Liability, none of which have any allocation mechanism in the repository today.

BUD-000A escalated this as an architectural ambiguity rather than resolving it inside the module audit. ARCH-001 reviewed and approved the resolution. This ADR formalizes that resolution as a platform decision, the same way ADR-014 formalized Ledger and ADR-032 formalized Settlement ownership.

**Why existing models are insufficient:** the current repository has no single concept that can answer "what was planned" and "what actually happened, viewed by category/person/trip/goal" without either duplicating the read logic (as it does today, six times) or conflating planning with attribution under one field (as `cat.budget` living directly on Category already does, with no way to add a Trip or Goal dimension without repeating the same mistake).

---

### 2. Problem Statement

- **Planning vs. Attribution ambiguity.** "Allocation" has been used informally to mean both a reconciling money plan and a non-reconciling classification of spend. Left unresolved, this ambiguity would have been built into whichever module touched it first (Budget), permanently coupling a platform concept to one domain's assumptions.
- **Cross-domain consumers already exist or are imminent.** Budget needs planning allocations today. Reports, Goals, AI, and Forecasting will all need to query attribution — "how much did this person/trip/category actually receive" — independent of whether a plan exists for it.
- **No canonical ownership today.** Neither mechanism has an owning module. Category owns `cat.budget` incidentally, because that's where the input field was put. Transactions own `catAllocations`/`t.people` incidentally, because that's where the split UI lives. Neither ownership was a deliberate architectural choice.

---

### 3. Decision

**An Allocation Engine is introduced as a platform capability**, following the Hybrid model approved in ARCH-001:

- **Planning Allocation** — a reconciling money plan (Household → Category/Person/Group, for now; other dimensions as they're onboarded). Consumed and edited primarily by Budget, but owned by the Allocation Engine, not by Budget.
- **Analytical Attribution** — a non-reconciling classification of a transaction's contribution to one or more dimensions (Category, Person, Group, Trip, Goal, Project, Liability, Account). No dimension's attributions are required to sum to any total, including each other.

The Allocation Engine owns both concepts and the boundary between them. No other module — Budget included — implements its own copy of either.

```
Allocation Engine
├── Planning Allocation
└── Analytical Attribution
```

The Engine's name is deliberately not "Allocation" alone — Attribution is a capability the Engine exposes, not a synonym for the Engine itself. This distinction is worth stating explicitly here so future references don't collapse back into the undifferentiated "allocation" terminology this ADR exists to retire.

---

### 4. Domain Model

**Core concepts, defined conceptually so they survive schema changes:**
- **Planning Allocation** — expresses how money is intended to be distributed for a period. A plan, set independently of any transaction, reconciling within its dimension hierarchy.
- **Analytical Attribution** — expresses how recorded financial facts are classified across one or more analytical dimensions. A classification of what already happened, derived from and referencing a transaction, with completeness rules defined per-dimension rather than platform-wide (see Invariant 4).
- **Dimension** — a typed reference to an entity elsewhere in the platform (Category, Person, Group, Trip, Goal, Project, Liability, Account). The Allocation Engine references dimensions; it never owns their identity.

Today's concrete shapes — `{ dimensionType, dimensionId, period, amount }` for a Planning Allocation, `{ transactionId, dimensionType, dimensionId, amount }` for an Attribution — are illustrative of the concept, not a schema commitment; final field shapes are BUD-001/implementation detail.

**Relationship to Transactions:** Transactions remain the single source of fact (ADR-025, Rule 3, unchanged and reaffirmed here). An Attribution always references a transaction and never exists independently of one. The Allocation Engine reads transaction facts; it does not create, edit, or delete transactions.

---

### 5. Ownership

| Concern | Owner |
|---|---|
| Planning Allocation records, Analytical Attribution records, the dimension model, reconciliation rules for Planning Allocations | **Allocation Engine** |
| Transaction facts (amount, date, type) | **Transactions** (unchanged) |
| Budget policy, periods, variance/health/forecast read-models built on top of Planning Allocations | **Budget** — consumes the Allocation Engine, does not reimplement it |
| Dimension identity (a Category's name/icon, a Person's identity, a Trip's dates) | **Categories / People / Groups / Trips / Goals / Projects / Liabilities** respectively — the Allocation Engine references these by ID, never embeds or owns them |
| Cross-dimension reporting (e.g., "spend by person by category by month") | **Reports** — consumes Attributions |
| Recommendations derived from planning/attribution patterns | **AI** — consumes both Planning Allocations and Attributions, read-only |

---

### 6. Invariants

1. **Transaction facts are immutable from the Allocation Engine's perspective.** The Allocation Engine never mutates a transaction's amount, date, or type.
2. **Attributions never mutate transaction facts either** — they are additional records that reference a transaction, not edits to it.
3. **Planning Allocations reconcile within their dimension hierarchy.** A Category's planned allocation for a period is bounded by rules the Allocation Engine enforces (exact reconciliation semantics per dimension pair — e.g., whether Category totals must not exceed Household total — is left to implementation/migration planning, not frozen here).
4. **Analytical Attributions never reconcile across dimensions.** A transaction's Category attribution and its Person attribution are independent; neither constrains the other. Some dimensions may define their own completeness rules — for example, Category attribution may require its attributed amounts to sum to the transaction total, while Person, Goal, or Trip attribution may not require this at all. **Completeness is therefore a property of an individual dimension's own rules, not of the Attribution model itself.** This is why Category can legitimately behave differently from Person without being treated as an exception or legacy carve-out.
5. **Allocation dimensions remain orthogonal.** No dimension type is permitted to be modeled as a child of another dimension type inside the Allocation Engine (no Category-owns-Person nesting, etc.) — confirms and formalizes the "dimensional, not hierarchical" conclusion from BUD-000 Phase 6.

---

### 7. Public Interfaces

**Producers** (write Planning Allocations or Attributions): Budget (Planning Allocations, via its editing UI); the transaction-entry flow (Attributions, via category/person/etc. split UI) — both write through the Allocation Engine's interface rather than directly to their own local state, as happens today.

**Consumers** (read-only): Budget (variance/health/forecast), Reports, Goals, AI, Forecasting, Home.

**Query APIs (conceptual, not final signatures):**
- `getPlanningAllocation(dimensionType, dimensionId, period)` → amount
- `getAttributions(transactionId)` → list of `{dimensionType, dimensionId, amount}`
- `getAttributedTotal(dimensionType, dimensionId, periodRange)` → sum, for variance/reporting

**Events (conceptual):** `PlanningAllocationChanged`, `AttributionRecorded` — for consumers that need to react rather than poll (e.g., Budget Alert threshold checks).

Exact API/event shapes are implementation detail for BUD-001 and the Allocation Engine's own build-out; this ADR fixes the responsibility boundary, not the interface signatures.

---

### 8. Migration

- **`catAllocations`** generalizes directly into Category-dimension Attributions. Its existing sum-to-transaction-total behavior can be preserved as a Category-dimension-specific rule (per Invariant 4's carve-out) rather than a platform default.
- **`t.people`** generalizes directly into Person-dimension Attributions. Per ADR-008's already-frozen field-priority discipline, migration should resolve to one canonical source rather than summing `t.people` against any legacy fields it may still coexist with.
- **`cat.budget` / `p.spendBudget` / `g.manualLimit` / `annualBudget`** migrate into Planning Allocation records, moving *out* of Category/Person/Group/household-shell and into the Allocation Engine's own storage, referencing those entities by ID. This is a live-data schema migration across every user's cloud-synced state (confirmed in BUD-000A) and needs its own rollback-capable migration plan under BUD-001 — not attempted inside this ADR.
- **Trip, Goal, Project, Liability** dimensions have no existing data to migrate — they onboard directly into the Allocation Engine's model with no legacy-compatibility burden.

---

### 9. Consequences

**Positive:** one canonical implementation replaces six duplicate read-paths found in BUD-000's Mutation Census; new dimensions (Trip, Goal, Project) onboard without inventing a new allocation mechanism each time; Budget, Reports, Goals, and AI can share one query surface instead of each computing their own version of "what happened here."

**Platform extensibility:** new analytical dimensions can be introduced without modifying the Allocation Engine itself — a new dimension participates by implementing the dimension contract (Section 4), not by adding a new allocation mechanism. This may end up being the most significant long-term benefit of this architecture, since it's what lets Trip, Goal, Project, and whatever comes after them onboard as consumers rather than as new special cases.

**Trade-offs:** introduces a new platform layer between Transactions and every consuming module — more architectural surface area than embedding the logic in Budget would have been, in exchange for not repeating today's duplication problem at platform scale. Planning Allocation's reconciliation rule (Invariant 3) is deliberately left underspecified pending BUD-001's migration design — this ADR fixes ownership and shape, not every business rule.

**Deferred work:** exact reconciliation semantics per dimension pair; final API/event signatures; the live-data migration plan itself (BUD-001); Financial Calendar's period model, which Planning Allocations depend on (ADR-036, next).

---

### 10. Non-Goals

This ADR does **not**:
- Define the Budget domain, its aggregates, or its UI (see BUD-000's Domain Reconciliation and Aggregate Identification, and the forthcoming BUD-001).
- Define Goal planning, Trip planning, or Project planning as domains in their own right — only that they may become Allocation Engine consumers.
- Define Reporting's design or AI's recommendation logic — only that they are read-only consumers of this Engine.
- Define Fiscal Calendar behavior — periods, fiscal years, quarters, and time normalization are entirely out of scope here and are the subject of ADR-037.
- Resolve exact reconciliation rules for Planning Allocations beyond the general principle in Invariant 3 — dimension-pair-specific rules are BUD-001/migration-planning work.
- Specify final API or event signatures — the interfaces in Section 7 are conceptual, fixing responsibility, not implementation.

---

**Sign-off:** Approved via ARCH-001 — Architecture Decision Review, with editorial revisions incorporated (terminology, conceptual definitions, Invariant 4 wording, extensibility consequence). No architectural changes made in this revision. Supersedes no prior ADR; refines the scope of ADR-025, Rule 2 (Person/Group allocation) by generalizing it into this platform capability without contradicting it.

**Status: Frozen.**
