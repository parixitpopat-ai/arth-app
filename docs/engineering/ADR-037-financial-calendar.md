## ADR-037 — Financial Calendar

**Status: Frozen (domain/intent), OPEN for technical-shape confirmation (see CR-ACC-BUD-001)**

**Renumbered from ADR-036** — that slot is now taken by the renumbered Allocation Engine ADR (see CR-ACC-BUD-001). This document's domain content is unchanged; CR-ACC-BUD-001 §4 flags that whether this needs any `AggregateRoot`-based component (vs. remaining fully read-only, like `domain/cards/summaries.js`) is unconfirmed and should be resolved before WP-2 begins in earnest.

---

### 1. Context

ADR-035 introduced the Allocation Engine and, in doing so, exposed a second gap the Allocation model depends on but does not itself define: **Arth has no shared concept of a financial time period.** Every module that needs to answer "what month/quarter/fiscal year is this" currently answers it independently.

Repository evidence, gathered during BUD-000 and confirmed while drafting this ADR:

- `currentFYStartYear` (App.jsx, line 760) is a single shared top-level constant — April 1 fiscal-year-start, computed once — so the *year number* is not duplicated. But there is no shared function for turning that year into a usable date range. BudgetPage's FY editor (`fy`, `fyLabel`, `isPreviousFY`/`isCurrentFY`, line ~12485-12489) and People's group fiscal-year spend calculation (`fyStart`/`fyEnd`, line 9306-9307) each independently construct their own `${year}-04-01`/`${year+1}-03-31` boundary strings inline, rather than calling one shared period utility.
- Calendar months are represented throughout the codebase as raw string keys (`"YYYY-MM"`, e.g. `viewMonth`, `monthOverrides[key]`) with no modeled entity behind them — just string prefix-matching against transaction dates (`t.date.startsWith(monthKey)`).
- No representation exists anywhere for quarters, custom (non-calendar) periods, or credit-card billing cycles as period concepts, despite credit card statement dates already being tracked per-account (`getCardSummary`, `dueOn`) as a related but separate mechanism.

This is the same failure pattern ADR-035 exists to fix, one layer down: a concept multiple modules need, with no canonical owner, currently held together by one shared constant and a lot of inline string-building rather than a real abstraction.

---

### 2. Problem Statement

- **Planning Allocation (ADR-035) requires a period concept to attach to** — "how much was planned for this period" is meaningless without a well-defined period. ADR-035 deliberately left this undefined and deferred it here.
- **Multiple future consumers, not just Budget:** Goals, Investments, Reports, Tax, Forecasting, and recurring payments all need to answer period-shaped questions (what FY, what quarter, what billing cycle) independently of Budget.
- **No canonical ownership today:** fiscal year logic is a top-level constant with ad hoc consumers; calendar months are string keys with no shared parsing/formatting/boundary logic; quarters and custom periods don't exist at all; credit card cycles exist but aren't modeled as a period type consistent with anything else.

---

### 3. Decision

**A Financial Calendar is introduced as a platform capability**, owned independently of Budget, Allocation Engine, or any other consuming module. It is a dependency of the Allocation Engine (Planning Allocations attach to a Financial Calendar period), not a part of it — the two are separate ADRs and separate capabilities for a reason: Allocation is about what money is planned/attributed; Financial Calendar is about what window of time that plan or attribution applies to. Conflating them would repeat the exact mistake ADR-035 exists to correct — one capability quietly absorbing a second concept because they happened to be needed by the same feature first.

```
Financial Calendar
├── Calendar Period (month, defined first)
├── Fiscal Year Period
├── Quarter Period
├── Custom Period
└── Billing Cycle Period (credit card, defined by statement/due date pattern)
```

---

### 4. Domain Model

**Core concepts, defined conceptually:**
- **Period** — a bounded span of time with a start and end, identified by a type (Calendar Month, Fiscal Year, Quarter, Custom, Billing Cycle) and a label. The unifying abstraction beneath every period type listed above.
- **Fiscal Year Definition** — the rule that turns a plain year number into a Period (today: April 1 – March 31, currently hardcoded; under this ADR, a configurable rule the Financial Calendar owns rather than each consumer assuming).
- **Billing Cycle** — a recurring Period pattern anchored to an external event (a credit card's statement date), distinct from calendar-aligned periods but expressed through the same Period abstraction so consumers (like a future unified forecast view) don't need to special-case it.

Today's string-key representation (`"YYYY-MM"`) is illustrative of Calendar Month, not a schema commitment — final representation is implementation detail for whichever module builds this out.

---

### 5. Ownership

| Concern | Owner |
|---|---|
| Period definitions (Calendar Month, Fiscal Year, Quarter, Custom, Billing Cycle), fiscal year start-date configuration, period boundary calculation, period labeling/formatting | **Financial Calendar** |
| Planning Allocations attaching to a specific period | **Allocation Engine** (ADR-035) — consumes Financial Calendar, does not define periods itself |
| Credit card statement/due dates as raw account data | **Accounts** — Financial Calendar's Billing Cycle period type reads this data, does not own or duplicate it |
| Budget's month/FY selector UI, "which period am I viewing" state | **Budget** — consumes Financial Calendar for period definitions, owns only its own UI selection state |
| Period-based queries for Reports, Tax, Forecasting, Investments | Each respective module — all consume Financial Calendar rather than computing their own boundaries |

---

### 6. Invariants

1. **Period boundaries are computed once, by the Financial Calendar, not by each consumer.** No module is permitted to construct its own date-range strings for a fiscal year, quarter, or billing cycle — this is the exact duplication pattern this ADR exists to close off.
2. **Fiscal year start is configuration, not a hardcoded literal.** Today's April 1 assumption becomes a Financial Calendar setting, not a constant embedded in consuming code.
3. **Periods do not own financial data.** A Period is a time boundary only — Planning Allocations, transactions, and Attributions reference a Period; the Financial Calendar never stores amounts.
4. **Period types are independently defined, not derived from one another by assumption.** A Quarter is not silently "three Calendar Months" wherever a consumer finds it convenient — if a Quarter's boundaries need to align with Calendar Months, that alignment is an explicit rule the Financial Calendar defines, not an assumption left to each consumer.

---

### 7. Public Interfaces

**Producers:** the Financial Calendar itself is the sole producer of Period definitions; Accounts supplies raw billing-cycle dates that the Financial Calendar's Billing Cycle period type reads.

**Consumers (read-only):** Allocation Engine, Budget, Goals, Investments, Reports, Tax, Forecasting.

**Query APIs (conceptual, not final signatures):**
- `getCurrentPeriod(periodType)` → Period
- `getPeriodBounds(periodType, identifier)` → `{ start, end, label }`
- `getFiscalYearConfig()` → the configured FY start rule
- `getBillingCyclePeriod(accountId, referenceDate)` → Period, sourced from Accounts' statement data

Exact signatures are implementation detail for whichever module builds this out; this ADR fixes the responsibility boundary.

---

### 8. Migration

- **`currentFYStartYear`** (App.jsx line 760) migrates from a hardcoded top-level constant into the Financial Calendar's configurable Fiscal Year Definition. Existing behavior (April 1 start) becomes the default configuration value, not a rewrite of the actual date.
- **`viewMonth` and `monthOverrides` string keys** continue to work as Calendar Month identifiers during migration — the Financial Calendar can wrap the existing `"YYYY-MM"` string convention rather than forcing an immediate representation change across every consumer.
- **The inline FY boundary construction** at BudgetPage (~12485) and People's group FY spend calculation (~9306-9307) both migrate to call the Financial Calendar's period-bounds query instead of building `${year}-04-01`/`${year+1}-03-31` strings locally.
- **Credit card billing cycle dates** (`getCardSummary`, `dueOn`) are not moved — they remain owned by Accounts. The Financial Calendar's Billing Cycle period type reads them; this is a new read relationship, not a data migration.
- **Quarter and Custom period types** have no existing data to migrate — they onboard directly with no legacy-compatibility burden, same as Trip/Goal/Project did for the Allocation Engine.

---

### 9. Consequences

**Positive:** removes the last hardcoded fiscal-year assumption from consuming code; gives every future period-aware module (Goals, Investments, Reports, Tax) one place to ask "what period is this" instead of re-deriving it; makes Planning Allocations well-defined for the first time, since "amount for a period" now has an actual Period behind it rather than a bare string key.

**Platform extensibility:** new period types (a future Sprint/OKR period, a non-calendar reporting period some future integration requires) can be added without touching the Allocation Engine or Budget — they implement the Period contract and become available to every existing consumer immediately.

**Trade-offs:** another platform layer between raw dates and every consuming module — more indirection than each module continuing to parse `"YYYY-MM"` strings itself, in exchange for not repeating the FY-hardcoding pattern as more modules are built. Billing Cycle as a Period type is a genuinely different shape (anchored to an external recurring event rather than a fixed calendar boundary) and may prove awkward to unify with the others cleanly — flagged as a real implementation risk, not asserted to be trivial.

**Deferred work:** final Period representation and API signatures; whether Quarter aligns strictly to Calendar Months or can be configured independently; the actual migration of BudgetPage's and People's inline FY construction (BUD-001).

---

### 10. Non-Goals

This ADR does **not**:
- Define the Allocation Engine's domain model — see ADR-035, which this ADR is a dependency of, not a part of.
- Define Budget's period-selection UI or its FY editor's behavior — only that it must consume Financial Calendar rather than compute its own boundaries.
- Define Reports', Tax's, or Investments' period-based features — only that they may become Financial Calendar consumers.
- Resolve whether Quarter periods align to Calendar Months by default — an implementation decision, not frozen here.
- Migrate any existing code — Section 8 describes the migration path; executing it is BUD-001/implementation-team work.
- Redesign credit card billing-cycle tracking — Accounts continues to own that data; this ADR only adds a read relationship.

---

**Sign-off:** Approved via ARCH-001 — Architecture Decision Review, as the second of the two platform ADRs authorized there. Supersedes no prior ADR. Depended on by ADR-036 (Planning Allocations require a Period to attach to) — read together, not independently.
