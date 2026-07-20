# Arth — Dependency Map

Built incrementally as extraction happens — this isn't a full up-front
audit, it's updated each time a piece of code is actually traced (which is
when we're most certain it's accurate).

## Extraction Readiness Score

A screen is ready to extract only if:
- External dependencies < 20 (measured mechanically — see method below)
- No duplicated business logic
- Uses shared helpers/constants already extracted
- Builds cleanly after extraction (`esbuild --bundle`)
- Passes regression testing

**Method**: for a given component, diff every identifier it references
against (a) everything it defines locally and (b) the main component's
`useState` variables, other top-level `const`s, and module-level functions.
Manual reading is not reliable enough at this file's size — this exact
process caught a boundary error (component ranges bleeding into the next
component) twice while measuring the table below, which would have
silently inflated or deflated a count if not double-checked.

## Extraction candidate comparison (measured, not assumed)

| Screen / component | Lines | External deps | Verdict |
|---|---|---|---|
| Timeline (`Transactions`) | 468 | 61 | ❌ Postponed |
| People | 1,409 | 87 | ❌ (also fails line ceiling) |
| Bills (`BillsPage`) | 405 | 48 | ❌ |
| Events — detail (`EventDetailModal`) | 64 | 13 | ✅ |
| Goals — list (`GoalsListModal`) | 48 | 9 | ✅ |
| Events — list (`EventsListModal`) | 39 | 9 | ✅ |
| Goals — add/edit (`AddGoalModal`) | 75 | 9 | ✅ |
| Events — add/edit (`AddEventModal`) | 59 | 7 | ✅ |
| Goals — add contribution (`AddContributionModal`) | 21 | 5 | ✅ |

**Decision: Goals is the extraction candidate.** Every one of its pieces
scores under 10 — smaller than any single piece of Events, and far below
Timeline. It's also the newest code in the app (built from scratch this
session), so its shape is genuinely well-understood, not just assumed to
be small.

**Timeline is explicitly postponed, not abandoned.** The original
assumption that it was "the low-dependency screen" was wrong — measuring
it is what revealed that. It stays in `App.jsx` until a shared data
interface exists (conceptually `useArthData()` — transactions, accounts,
categories, people, actions, derived values as one consumable interface)
that a screen this integration-heavy can consume, rather than either
threading 61 individual props or hiding the same giant closure behind a
single `ctx` object (which would reduce typo risk but not actually
improve modularity — noted and deliberately rejected as a shortcut).
People and Bills are in the same category for the same reason.

## Extracted screens (Phase 2)

```
src/screens/EventsScreen.jsx
├── helpers/idGenerator.js (genId)
├── components/BottomSheet.jsx (all three modals use it)
├── components/EmptyState.jsx (EventDetailModal's "no expenses linked",
│   EventsListModal's "no trips or outings")
└── exports: AddEventModal, EventDetailModal, EventsListModal

Re-measured at extraction time (not reused from the earlier estimate —
the codebase had changed since then, EventsListModal specifically grew
from budget-tracking work). Caught the same boundary-measurement bug a
third time (EventsListModal's range bled into the later-added
DuplicateFinderModal) before trusting the count:

AddEventModal    → 7 deps  (EVENT_TYPES, T, card, inp, lbl, people, setEvents)
EventDetailModal → 12 deps (+ askConfirm, formatShortDate, getMyExpenseAmount,
                              getPerson, setEditingEvent, setShowAddEvent,
                              setTxnDetailId, txns)
EventsListModal  → 10 deps (events, formatShortDate, setEditingEvent,
                              setShowAddEvent, setViewingEvent, txns)

All three explicit-props, no shared "ctx" object — consistent with Goals.
This is also the first extraction built after BottomSheet/EmptyState
existed, so it uses them instead of hand-writing new copies — the
concrete case COMPONENT_INVENTORY.md predicted.
```

src/screens/GoalsScreen.jsx
├── constants/appConstants.js (GOAL_ICONS — moved here too, zero deps,
│   free addition while tracing this extraction)
├── helpers/idGenerator.js (genId)
├── components/BottomSheet.jsx (AddContributionModal, migrated)
├── components/EmptyState.jsx (Goals empty state, migrated)
└── exports: AddGoalModal, GoalsListModal, AddContributionModal

Each component takes only the props it uses (checklist rule "imports only
what it needs") — AddContributionModal doesn't receive GOAL_ICONS or
accounts, since it never touches them:

AddGoalModal      → existing, onClose, T, inp, lbl, accounts, setGoals
GoalsListModal    → onClose, T, sym, fmt, formatShortDate, goals, setGoals,
                     getGoalProgress, setEditingGoal, setShowAddGoal,
                     setShowAddContribution
AddContributionModal → goal, onClose, T, inp, btnP, sym, setGoals
```

`formatShortDate` and `getGoalProgress` are passed as props rather than
imported — both still live in `App.jsx` (the date-parsing chain is still
deliberately un-extracted; `getGoalProgress` is a `useCallback` depending
on `accountBalance`, business logic, not yet extracted either). This is
the intended shape for now — a screen can depend on business logic
through props without that logic needing to be extracted first.

Caught two boundary bugs while measuring this extraction's candidates
(component ranges bleeding into the next component during the mechanical
trace) — both found and fixed before extracting anything, not after.

## Extracted modules (Pass 3B)

```
src/helpers/idGenerator.js
└── zero dependency (genId)

src/helpers/currency.js
└── zero dependency (parseMoney, cleanMoneyInput, nearlyEqualMoney)
    Note: no separate validators.js exists — checked, there's no distinct
    "is this valid" logic in the codebase beyond these three money-parsing
    functions. Folded in here per the domain-first rule rather than
    creating a file with borrowed, mismatched content just to hit a name.

src/reports/csv.js
└── zero dependency (rowsToCsvString, downloadCsvFile)
    Deliberately does NOT know about transaction shape or column order —
    that mapping stays in Timeline's bulk-export handler, since it's
    business logic (knows what a transaction looks like), not CSV
    mechanics. Confirmed this split was necessary by reading the original
    code: it mixed both concerns in one inline handler.
```

## Extracted modules (Pass 3A)

```
src/constants/theme.js
└── zero dependency (DARK, LIGHT, PALETTE)

src/helpers/dateHelpers.js
└── zero dependency (todayStr, addDaysToDateStr, getPeriodEffectiveEnd,
    daysInMonth, daysLeft, getMonthBounds, getPreviousMonthKey)

src/helpers/textHelpers.js
└── zero dependency (normalizeVendorText)

src/constants/appConstants.js
└── zero dependency (PERSON_MODULES, getPersonModules, GROUP_MODULES,
    GROUP_TYPE_DEFAULT_MODULES, getGroupModules, CAT_ICONS, INVEST_TYPES,
    ACC_TYPES, LIABILITY_TYPES, ASSET_TYPES, DEFAULT_INCOME_TYPES,
    INVESTMENT_FREQUENCY_OPTIONS, ME, DEFAULT_CATS, DEFAULT_ACCOUNTS,
    DEFAULT_MEASURE_UNITS, VENDOR_CATEGORY_RULES, CLOUD_SCHEMA_VERSION)

src/constants/investmentConfig.js
├── textHelpers.js (normalizeVendorText, used by getInvestmentGroupMeta
│   and inferInvestmentTypeId)
└── exports: investmentFreqLabel, getInvestmentBudgetMeta,
    getInvestmentMetricConfig, getInvestmentGroupMeta, inferInvestmentTypeId

src/helpers/formatters.js
├── constants/investmentConfig.js (getInvestmentMetricConfig, used only by
│   formatInvestmentMetric)
└── exports: sym, fmt, fmtK, accountBucketLabel, accIcon, accLabel,
    txnColor, txnLabel, txnEmoji, formatInvestmentMetric
```

No circular imports. `formatters.js` depends on `investmentConfig.js`;
nothing in `investmentConfig.js` depends back on `formatters.js` (it
doesn't need currency formatting, only text normalization).

## Explicitly NOT extracted yet — real, discovered dependency chains

**Date-parsing subsystem** (currently still in `App.jsx`):
```
formatShortDate
└── toDateOnly
    └── normalizeToIsoDate
        ├── extractDateFromText
        │   └── MONTH_NAME_MAP
        └── buildIsoDate
            └── toFourDigitYear

getRecordedSortValue, isDateInRange → toDateOnly
getNextDueDate, getCardCycleDates → dateAtDay (own small helper, but
  getCardCycleDates itself is credit-card statement cycle business logic,
  not a pure date helper — do not extract this one into dateHelpers.js
  even after the parsing chain above is untangled)
```
This is a real, self-contained cluster — worth its own pass, not worth
rushing into `formatters.js` just because the names sound date-related.

**Normalization/domain functions** (deliberately left as business logic,
per "don't extract business logic yet"):
`normalizeMeasureUnits`, `normalizeItemCatalog`, `normalizeIncomeTypes`,
`normalizeLiabilityTypes`, `normalizeAccountTypes`, `defaultAccountTypeBucket`,
`inferAccountBucket`, `safeSetLocalStorage`, `parseMoney`, `cleanMoneyInput`,
`extractTxnReference`, `extractSmsBalance`, `computeNextDueDate`,
`computeNextPeriod`, `detectSmsDirection`, `findSmsAccountMatches`,
`remainingShare`, `linkedSettlementKey`, `dedupeSettlementTxns`,
`isInvestmentAccount`, `getTxnCategoryIds`, `getTxnSubIds`, `txnHasPerson`,
`nearlyEqualMoney`, `getTxnDisplayTitle`

## Screen dependencies (traced so far)

```
Timeline (Screen 6, ✅ complete)
├── TxnRow (shared — also used by Home's Recent card and Account Detail;
│   Timeline wraps it in SwipeableTxnRow rather than modifying it directly)
├── helpers/dateHelpers.js (addDaysToDateStr, todayStr)
├── helpers/formatters.js (sym, fmt, formatShortDate — still local for now)
├── reports/csv.js (rowsToCsvString, downloadCsvFile — bulk export;
│   the transaction→row mapping stays local, not in csv.js)
└── theme (T, via the app's dark/light state)

Add Transaction (Screen 5, ✅ complete)
├── QuickAddModal (new) — reuses the same history-match + keyword-rule
│   detection logic AddModal uses, kept independent rather than reaching
│   into AddModal's internals
├── constants/appConstants.js (VENDOR_CATEGORY_RULES, via local detection)
├── AddModal (2,653-line legacy form) — escape hatch only, untouched
└── helpers/formatters.js (sym, fmt)

Home (Screen 4, ✅ complete)
├── Accounts (cashBankTotal, cashWalletTotal, upiTotal, totalAssetsValue,
│   totalLiabilitiesValue)
├── Budgets (monthOverrides, annualBudget)
├── Bills (dueRecurring alerts)
├── Goals (Home card, hides if empty)
├── Events (Home card, hides if empty)
├── Financial Health Score (own useMemo, depends on wealthSnapshots —
│   see below)
└── AI Insight (own rule-based comparison, depends on cats + txns)

Wealth snapshot recorder (cross-cutting, no screen of its own yet)
└── netWorthValue, cashBankTotal/cashWalletTotal/upiTotal,
    investmentAssetsTotal, trackedAssetsTotal, totalLiabilitiesValue,
    totalOwedToMe — all read directly from the main component's existing
    computed values, nothing new introduced
```

## Not yet traced
Money, Bills, Budgets, Goals, Events, Wealth, People — built or enhanced
this session, but not yet mapped here since they weren't part of an
extraction pass. Add their dependency trees here when they are.
