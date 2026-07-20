# Arth — Component Inventory

Audited directly against `App.jsx` (grep + read, not assumed) before
building anything. Purpose: know what's real and reusable, what's shared
styling but not a real component, and what's pure duplication waiting to
happen the moment Events gets extracted.

## Design System v1 — built and proven (this pass)

| Component | Status | Proven by |
|---|---|---|
| `BottomSheet` | ✅ Built + migrated | `src/components/BottomSheet.jsx`. Migrated `AddContributionModal` (`GoalsScreen.jsx`) to use it — proves cross-file component composition, same pattern Events will need. |
| `EmptyState` | ✅ Built + migrated | `src/components/EmptyState.jsx`. Migrated Goals' "No goals yet" state. |
| `StatCard` | ✅ Built + migrated | `src/components/StatCard.jsx`. Migrated Bills Home's Quick Summary grid (4-box: Bills/Paid/Upcoming/Overdue). |

Rule going forward, per product decision: any new screen extraction
**must** reuse these three rather than hand-writing a new version. No new
BottomSheet/EmptyState/StatCard implementations — only migrations to the
shared ones, or genuine gaps that justify a fourth primitive (documented
here first, same as this pass).

**Remaining duplicates not yet migrated** — the other 14+ BottomSheet
call sites, 5 remaining EmptyStates, and 3+ remaining StatCard-shaped
blocks are still hand-written. They weren't required to change for this
pass (one migration each was the proof point, not a full sweep) — migrate
them opportunistically as each screen gets touched, same as the
extraction philosophy.

## Legend
- **Exists** — a real thing is there today (component or style object)
- **Reusable** — usable as-is by a new screen without rework
- **Needs Refactor** — what has to change before it's Design-System-grade

## Layout Components

| Component | Exists | Reusable | Needs Refactor |
|---|---|---|---|
| Card | ⚠️ | Partial | `card` is a plain style **object** (`{background, border, borderRadius, padding}`), applied via `style={{...card}}` at ~every call site. Not a composable `<Card>{children}</Card>` component. Deliberately not converted this pass — per product decision, converting Button/Card/Page/Header all at once is a much larger refactor with more regression risk than three new components, and isn't justified yet. |
| BottomSheet | ✅ | ✅ | **Built this pass.** See above. |
| Modal | ❌ | — | Same situation as BottomSheet was — centered dialogs (confirm dialogs, category pickers) still hand-built each time. Candidate for a future pass. |
| Page / Section | ❌ | — | No shared page-level wrapper or section-header component. |
| Header | ❌ | — | No shared top-bar component. |
| FAB | ⚠️ | No | Exists, but inline in the main render (long-press logic tightly coupled to `handleTab`). Not touched this pass. |
| EmptyState | ✅ | ✅ | **Built this pass.** See above. |

## Financial Components

| Component | Exists | Reusable | Needs Refactor |
|---|---|---|---|
| Amount | ❌ | — | Every screen hand-formats `{sym}{fmt(x)}` inline, sometimes with color logic (danger if negative, success if positive) reimplemented per call site. No shared component. |
| Currency (sym/fmt) | ✅ | ✅ | Real, extracted, already in `helpers/formatters.js` (Pass 3A). This one's genuinely done. |
| BalanceCard | ❌ | — | Doesn't exist. Home's Financial Health card, Money's account cards, and Wealth's summary cards are three separate hand-built implementations of a similar shape. |
| AccountChip | ❌ | — | Doesn't exist as its own thing — account selection is a plain `<select>` dropdown in most places (Quick Add, AddModal), not a chip. |
| CategoryChip | ❌ | — | Same — category picking is a button that opens a list, not a chip pattern, in most flows. |
| PersonChip | ⚠️ | Partial | The Split-with chips in Quick Add are a real, working implementation of this exact pattern — but it's local to `QuickAddModal`, not extracted as its own reusable component yet. |
| GoalChip | — | — | Not applicable as a chip — Goals uses full cards (`GoalsListModal`'s progress rows), not chips. |
| StatusBadge | ❌ | — | Status indicators (Paid/Unpaid, Active/Completed, over-budget warnings) are hand-styled inline per screen, no shared badge component. |

## Form Components

| Component | Exists | Reusable | Needs Refactor |
|---|---|---|---|
| Button (primary) | ⚠️ | Partial | `btnP`/`btnG` are style **objects**, same situation as Card — not composable `<Button variant="primary">` components. |
| IconButton | ❌ | — | No shared component; icon-only buttons (x, edit, delete) are hand-styled per instance. |
| SegmentedControl | ❌ | — | The Expense/Income toggle (Quick Add), This Month/FY toggle (Budget), Overview/Cash Flow/Credit/Investments tabs (Insights) are **three separate hand-built implementations** of the same two-or-more-option-toggle pattern. |
| SearchBar | ⚠️ | Partial | Timeline's search input is a real, working implementation — but it's local to Timeline, not extracted. |
| Dropdown | ❌ | — | Native `<select>` used directly everywhere; no wrapper component with consistent styling/behavior. |
| DatePicker | ❌ | — | Native `<input type="date">` used directly; no wrapper. |
| MoneyInput | ❌ | — | Amount entry (Quick Add's big number input, AddGoalModal's target amount, etc.) is a plain `<input type="number">` styled per instance, not a shared component with built-in ₹ prefix/formatting. |

## Data Components

| Component | Exists | Reusable | Needs Refactor |
|---|---|---|---|
| TxnRow | ✅ | ✅ | Real, shared across 4+ places (Home Recent, Account Detail, Timeline via `SwipeableTxnRow` wrapper). Genuinely reusable already — this is the one clear success case. |
| SwipeableTxnRow | ✅ | ⚠️ | Real, but Timeline-specific by design (wraps TxnRow with swipe actions). Not meant for reuse elsewhere as-is. |
| BillRow | ❌ | — | Bills' list rows are hand-built inline in `BillsPage`, no extracted component. |
| GoalCard | ⚠️ | Partial | The goal progress row in `GoalsListModal` is a real, working pattern — but it's local to that file (correctly, since Goals is already extracted), not generalized into a shared `<GoalCard>` other screens could reuse for a similar shape. |
| EventCard | ⚠️ | Partial | Same situation — Events' budget-progress row (in `EventsListModal`/Home's `eventsHome` card) is real and working but not generalized. |
| InsightCard | ⚠️ | No | Home's AI Insight card is a one-off, single-purpose block — not designed to be reused for other insight types. |
| StatCard | ✅ | ✅ | **Built this pass.** See Design System v1 section above. |

## Summary — what this means for Events

If Events gets extracted next without this library existing first, it will
almost certainly hand-build its own version of: BottomSheet (for its
modals), EmptyState, StatCard (for its budget-vs-spent display), and
SegmentedControl (if it ever gets an Active/Completed/Archived tab like
the mockups showed). That's 4 more divergent copies of things that
already have 2-6 divergent copies each. This is the concrete case for
building the Design System before Events, not just a general principle.

## Genuinely reusable already (build on these, don't replace)
- `sym`, `fmt`, `fmtK` (currency formatting — Pass 3A)
- `Chip` (generic chip component, used 36+ times in Timeline alone)
- `TxnRow` (shared transaction row)
- The `card`/`lbl`/`inp`/`btnP`/`btnG` style objects — not components, but
  consistent design tokens already in wide use. The Design System should
  wrap these in real components, not redesign the visual language itself.
