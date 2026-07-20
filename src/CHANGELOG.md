# Arth — Changelog

Format: newest first. One entry per shipped batch, not per individual
fix — see `SCREEN_ARCHITECTURE.md` for per-screen implementation detail.

## v0.9.3 — Bills refunds domain pass (Pass 2 of 2, Domain Layer Phase 2)

Same six-step process as Cards (Pass 1): measure → call-site audit →
dependency-chain audit → parameterize → extract → validate → document.
Both functions had already passed the audit cleanly in the prior pass —
this pass confirmed that hadn't changed, then executed.

- `src/domain/bills/refunds.js` — `computeRefundTotalsByBill(txns)`,
  `getNetBillAmount(bill, refundTotalsByBill)`
- 4 call sites updated in one pass (3 UI rendering, 1 derived
  calculation — BillsPage's `totalUnpaid`)
- The `useMemo` wrapping `refundTotalsByBill` stays in `App.jsx`
  (memoization needs a component to live in) — now calls the pure
  function instead of inlining the reduction, same performance
  characteristic, logic in one place instead of two

Validated by full bundling. Zero duplicate declarations confirmed.

`App.jsx`: 15,330 → 15,325 lines.

No breaking changes. No behavior changes — pure mechanical move plus
parameterization.

**Domain Layer Phase 2 closed.** Per the established roadmap, next is
re-measuring Bills' full dependency count (now that both domain passes
are done), then the UI/UX polish sprint — not further architecture work
by default.

## v0.9.2 — Biller shell delete + Domain Layer Phase 1 confirmed closed

Runtime regression for the Cards domain extraction (v0.9.1) confirmed
against the live app — no issues found. Domain Layer Phase 1 is closed
(`ARCHITECTURE_DECISIONS.md` ADR-013, `DOCS_INDEX.md` milestone status).

Unrelated bug surfaced during that verification, fixed separately:
- **Biller shells had no delete option at all.** The shell detail modal
  had Edit and Close, but no way to remove a shell — meaning duplicate
  shells (from before the earlier dedup-on-load fix) had no manual
  cleanup path. Added a Delete button, same safety pattern as the
  existing account-level delete: blocks if the shell still has linked
  accounts, deletes immediately (with confirmation) if empty.

Validated by full bundling.

`App.jsx`: 15,321 → 15,330 lines (net add — new delete button + guard
logic).

No breaking changes.

## v0.9.1 — Cards domain pass (Pass 1 of 2)

Followed the audit-first process end to end: call-site inventory (8
sites, all found and classified) before any signature change, then
parameterize, then extract, then validate — not the other way around.

- `src/domain/cards/summaries.js` — `getCardCycleDates`,
  `getCardSummary(card, accounts, txns, toDateOnly)`
- `dateAtDay` moved to `helpers/dateHelpers.js` — discovered as a
  Cards-blocking dependency during extraction; general-purpose (also
  used by `getNextDueDate`), not domain-specific, so it belongs in
  helpers rather than a domain module
- `toDateOnly` deliberately **not** extracted alongside this, even
  though it blocked the module — it's part of the date-parsing chain
  already deferred in ADR-002. Passed as an explicit parameter instead
  of reopening that decision. Kept this pass contained to exactly what
  was scoped.
- All 8 call sites updated in a single commit, per the checklist: find
  every caller → classify → confirm `accounts`/`txns` already in scope
  → change signature → update all call sites together → validate

Split `DEPENDENCY_MAP.md`'s tracking into three explicit stages —
Measured / Audited / Extracted — rather than one flat status, per the
"Parameterization Candidates" table.

Validated by full bundling. Zero duplicate declarations confirmed.

`App.jsx`: 15,386 → 15,320 lines.

No breaking changes. No behavior changes — pure mechanical move plus
parameterization, same output for every call site.

Pass 2 (Bills refunds: `computeRefundTotalsByBill` + `getNetBillAmount`)
already audited clean, not yet extracted — next pass.

## v0.9.0 — First domain service module: Bills calculations

Re-measured Bills before deciding on `useArthData()`'s next step (not
reusing the earlier estimate — same lesson as Events/ADR-011). Found 38
genuine dependencies, still far over threshold, and — more importantly —
found that roughly half of that coupling is business-logic functions,
not state. That finding changed the plan: architecture is now
`App → useArthData → Domain Services → Screens`, not
`App → useArthData → Screens` (see `ARCHITECTURE_DECISIONS.md` ADR-012).

- `src/domain/bills/calculations.js` — `computeNextDueDate`,
  `computeNextPeriod`, `remainingShare`. All three passed a new,
  formalized **Function Extraction Checklist** (`CODING_STANDARDS.md`)
  verbatim — no signature changes, no behavior changes.
- Deliberately left `getCardSummary`, `getCurrentPeriod`,
  `getNetBillAmount` in `App.jsx` — each closes over component state
  directly and would need a real signature refactor (parameters instead
  of closures) before qualifying, which is a behavior-risk change, not a
  mechanical move.
- **Found a real defect while auditing**, not an architecture decision:
  `sharePaymentRequest`/`doTxnShare` exist as two independent, parallel
  implementations with different calling conventions. Logged as
  `TECH_DEBT.md` TD-001, kept out of the ADR log on purpose — neither
  implementation was touched pending investigation.

Validated by full bundling. Zero duplicate declarations confirmed.

`App.jsx`: 15,415 → 15,386 lines.

No breaking changes. No behavior changes — pure code motion for the
three extracted functions; the flagged defect was found, not fixed.

## v0.8.0 — Second screen extraction: Events (Sprint 2 begins)

First extraction of Sprint 2, following the exact process from Sprint 1:
mechanical dependency trace before touching anything, not reused from an
earlier estimate — the codebase had changed since Events was last
measured (budget-tracking work grew `EventsListModal`). Caught the same
boundary-measurement bug a third time (component range bleeding into a
later-added component, this time `DuplicateFinderModal`) before trusting
the count — same lesson as Pass 3A/3B, mechanical measurement over
manual reading at this file's size.

- `src/screens/EventsScreen.jsx` — `AddEventModal` (7 deps),
  `EventDetailModal` (12 deps), `EventsListModal` (10 deps), all well
  under the 20-dependency threshold
- **First extraction built using the Design System** — uses
  `BottomSheet` (all three modals) and `EmptyState` (two empty states)
  instead of hand-writing new copies, exactly the case
  `COMPONENT_INVENTORY.md` predicted would happen if a screen was
  extracted without the shared components existing first

Validated by full bundling. Zero duplicate declarations confirmed by
direct grep.

`App.jsx`: 15,552 → 15,415 lines.

No breaking changes. No behavior changes — pure code motion.

## v0.7 — Architecture Foundation (Sprint 1 closed, tagged)

Sprint 1 closed cleanly and tagged `v0.7`: utility extraction, Goals
extraction, Design System v1, `useArthData()` design, architecture
decision log, repository cleanup (removed dead duplicate files, old
April snapshots, stray junk from the repo root and `src/`).

## v0.5.0 — Design System v1: BottomSheet, EmptyState, StatCard

Built the three highest-ROI shared components identified by
`COMPONENT_INVENTORY.md`'s audit (15+ duplicated BottomSheets, 6
duplicated EmptyStates, 4+ duplicated StatCards), following the "build
one, migrate one, prove it" discipline rather than converting everything
at once.

- `src/components/BottomSheet.jsx` — migrated `AddContributionModal`
  (`GoalsScreen.jsx`) to prove cross-file component composition works,
  same pattern any extracted screen (Events next) will need
- `src/components/EmptyState.jsx` — migrated Goals' "No goals yet" state
- `src/components/StatCard.jsx` — migrated Bills Home's Quick Summary
  grid (Bills/Paid/Upcoming/Overdue)

Deliberately **not** converting Button/Card/Page/Header this pass — the
audit found these are shared style *objects*, not components; converting
them touches a much larger surface of the app for less proven benefit
than three new components. Remaining duplicate BottomSheet/EmptyState/
StatCard call sites (14+/5/3+) are left as-is, to migrate opportunistically
as each screen gets touched, not swept in one large change.

**New rule, going forward:** no screen extraction may hand-write a new
BottomSheet, EmptyState, or StatCard — only reuse these three, or
document a genuine gap that justifies a fourth primitive.

Validated by full bundling. `App.jsx`: 15,552 → 15,550 lines (net change
small since this pass added a components layer more than it removed
inline code — the real payoff compounds as more screens migrate to it).

No breaking changes. No behavior changes — same visual output, different
underlying implementation.

## v0.4.0 — First screen extraction: Goals

The Extraction Readiness Score (dependency count < 20, measured
mechanically) was applied to five candidates before choosing one — see
`DEPENDENCY_MAP.md` for the full comparison table. Timeline, originally
assumed to be the easy first screen, measured at 61 external dependencies
and was postponed; Goals measured under 10 across all three of its pieces
and became the actual first extraction.

- `src/screens/GoalsScreen.jsx` — `AddGoalModal`, `GoalsListModal`,
  `AddContributionModal`, each accepting only the explicit props it uses
  (no shared "god object" of props)
- `GOAL_ICONS` also moved into `constants/appConstants.js` (zero
  dependency, free addition found while tracing this extraction)

Caught two boundary-measurement bugs (component line ranges bleeding into
the next component) while building the comparison table — both corrected
before extracting, which is exactly why the mechanical trace matters more
than reading the code by eye at this file's size.

Validated by full bundling. Zero duplicate declarations confirmed by
direct grep before and after.

`App.jsx`: 15,477 → 15,339 lines.

No breaking changes. No behavior changes — pure code motion, same
component logic, same render output.

## v0.3.1 — Pass 3B: idGenerator, currency, csv

Dependency map built first, per the standing rule established after Pass
3A's discovery. One finding worth noting: no `validators.js` content
actually exists in this codebase — checked, and there's no distinct "is
this valid" logic beyond money parsing, so those three functions went
into `currency.js` instead of forcing an empty/mismatched fourth file.

- `src/helpers/idGenerator.js` — `genId`. Lowest risk, zero dependencies,
  extracted first as planned.
- `src/helpers/currency.js` — `parseMoney`, `cleanMoneyInput`,
  `nearlyEqualMoney` (absorbs what would have been `validators.js`).
- `src/reports/csv.js` — generic CSV mechanics only (`rowsToCsvString`,
  `downloadCsvFile`). Confirmed by reading the original code that it mixed
  CSV plumbing with transaction-column knowledge in one handler; only the
  plumbing moved. Timeline's bulk-export handler still owns which columns
  and how to read them off a transaction — that's business logic, not CSV
  logic.

Folder structure now follows domain-first naming (Rule 11): `helpers/`
for generic utilities, `reports/` for reporting-domain code, `constants/`
for data and domain config. Not a flat `helpers/` dumping ground.

Validated by full bundling, zero circular imports (all three new modules
are leaf files — no imports of their own).

`App.jsx`: 15,494 → 15,477 lines.

No breaking changes. No behavior changes — pure code motion.

## v0.3.0 — Pass 3A: zero-dependency extraction

First real crack in the monolith. Extracted, with a full dependency map
built before touching anything (see `DEPENDENCY_MAP.md`):
- `src/constants/theme.js` — DARK, LIGHT, PALETTE
- `src/helpers/dateHelpers.js` — todayStr, addDaysToDateStr,
  getPeriodEffectiveEnd, daysInMonth, daysLeft, getMonthBounds,
  getPreviousMonthKey
- `src/helpers/textHelpers.js` — normalizeVendorText (new file, small but
  genuinely separate — a matching utility, not a formatter)
- `src/constants/appConstants.js` — all pure data constants (person/group
  modules, category/account/investment/liability/asset type lists,
  default categories/accounts, vendor rules, cloud schema version)
- `src/constants/investmentConfig.js` — new file, split out after
  discovering `formatInvestmentMetric` needed `getInvestmentMetricConfig`,
  which is investment domain config, not a pure formatter. Didn't force it
  into `formatters.js` just to hit a target file count.
- `src/helpers/formatters.js` — narrower than originally planned;
  `formatShortDate` and everything touching it stayed in `App.jsx` because
  it's part of a real, self-contained date-parsing chain
  (`toDateOnly` → `normalizeToIsoDate` → `extractDateFromText`/`buildIsoDate`)
  that deserves its own pass, not to be rushed in.

Validated by actual bundling (`esbuild --bundle`, resolving real cross-file
imports), not just single-file syntax checking — this catches wrong paths
and mismatched export names, which single-file checks can't.

`App.jsx`: 15,740 → 15,494 lines.

No breaking changes. No behavior changes — pure code motion.

## v0.2.0 — Timeline Complete

**✅ Timeline** (Screen 6) — first screen to reach full spec completion.
- Swipe actions (Favourite / Repeat / Share / Delete)
- Date grouping (Today / Yesterday / Earlier This Week / This Month / Older)
  with sticky headers and per-bucket spend totals
- Bulk select, bulk delete, bulk category change, CSV export
- Confirmed pre-existing: search, advanced filters (more extensive than
  initially assessed)

No breaking changes. No new required fields on the transaction object.

## v0.1.4 — Add Transaction rebuilt

**✅ Add Transaction** (Screen 5) — the true 3-tap flow: Amount → "What was
it?" (live category detection, reusing Add Transaction's existing
history-match + keyword-rule logic) → Confirm → direct save.
- New, independently-reviewable save path for simple expenses (~15-line
  transaction object) — does not touch or duplicate the existing 2,653-line
  full form, which remains available via "Need to split, tag a person, or
  add details?"
- FAB and Home's Quick Actions "Expense" button both route through it

No breaking changes.

## v0.1.3 — Home Dashboard, Goals, Events

**✅ Home Dashboard** — feature-complete against real data.
- Financial Health Score (formula-based: Savings Rate 25, Bills On Time 20,
  Budget Adherence 15, Emergency Fund 15, Debt Ratio 10, Net Worth Growth 10,
  Consistency 5), with breakdown modal
- Time-of-day greeting, consolidated Action Centre, Quick Actions grid,
  AI Insight (single card, rule-based, category spend swing vs last month)
- Goals and Events cards — hidden entirely when there's no data, not faked

**✅ Goals** (Screen 10) — new module, built from scratch.
- Manual or account-auto-tracked progress, target date, completion
- Wired into cloud sync from creation (all four sync points)

**Events** (Screen 11) — enhanced, not rebuilt.
- Turned out to already support expense linking, spend totals, and people
  (more complete than initially assessed)
- Added: Budget field with progress tracking and over-budget warnings

**Fixed:** group/person spend double-count — a transaction tagged to both a
group and split among individuals was counted in both totals independently.
Individual "spent_on" attribution now skips when a `groupId` is also
present, since the group total already accounts for that money.

No breaking changes.

## v0.1.2 — Nav shell, rebrand, cloud sync hardening

- Bottom nav rebuilt: Home / Timeline / ➕ (FAB) / Money / Me — Bills moved
  to the drawer
- Full rebrand: gold/blue → green primary accent (base theme + every
  session-added blue instance, including the PIN and error screens that
  were missed on the first pass)
- Daily wealth/budget snapshot recorder — silent, no UI yet, feeds the
  Financial Health Score's Net Worth Growth component
- Cloud sync: fixed stale snapshot (missing `useMemo` deps), added
  pull-on-tab-focus, and — most importantly — pull no longer silently
  overwrites local data that looks newer than the cloud copy; a backup is
  taken before every overwrite regardless

## v0.1.1 — Bug fixes, Budget/People/Bills modules

- Fixed: membership grace period (was baked into dates, now separate),
  person budget doubling (attribute-tagged expenses counted twice),
  duplicate biller shells (root cause + auto-cleanup of existing duplicates)
- Budget: Monthly Dashboard, per-month person/group overrides, Annual
  Person View, "Can I Afford This?" calculator
- People/Groups: modules/capabilities system replacing hardcoded type
  checks, Person Dashboard rebuild, 3-step Add Person/Group wizards
- Bills: full reorder (Needs Attention/Pinned/All), Connection Dashboard,
  Analytics, Units/Meter fields, Credit Cards folded into the Biller
  hierarchy, shell/account editing

## v0.1.0 — Baseline

Existing app at the start of this working session: Bills v1, core
Transaction/Account/Budget engines, People & Groups, Memberships.
