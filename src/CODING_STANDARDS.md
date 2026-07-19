# Arth — Coding Standards & Extraction Plan

## Folder structure (target)
```
/docs
  ARTH_SCOPE.md
  SCREEN_ARCHITECTURE.md
  CODING_STANDARDS.md
/src
  App.jsx            ← shrinks over time, never rewritten wholesale
  /constants          (PALETTE, VENDOR_CATEGORY_RULES, GROUP_TYPES, PERSON_MODULES, ...)
  /helpers             (normalizeVendorText, formatShortDate, genId, todayStr, ...)
  /formatters          (sym/fmt money formatting)
  /validators
  /logic               (business logic — see below)
  /components          (Button, Card, Modal, BottomSheet, Header, SearchBar,
                         StatCard, ProgressBar, Amount, EmptyState)
  /screens             (one file per screen, only once "extractable")
```
Empty folders don't survive in git — drop a placeholder file (or the first
real extracted file) in each as it's created, not before.

## Extraction order (do not reorder without reason)
1. **Freeze architecture** — these three docs. Done once, revisited as
   decisions change, not re-litigated per screen.
2. **Finish Timeline completely** before extracting anything. A screen still
   being designed is much harder to extract cleanly than a finished one —
   don't extract while the shape is still moving.
3. **Extract zero-dependency helpers** — `theme.js`, `constants.js`,
   `helpers.js`, `formatters.js`, `validators.js`. Pure functions/constants
   with no closure over component state. Near-zero risk: cut, `export`,
   `import` back into `App.jsx`, validate, ship.
4. **Extract shared UI primitives** — Button, Card, Modal, BottomSheet,
   Header, SearchBar, StatCard, ProgressBar, Amount, EmptyState. These
   reduce duplication across all 18 screens immediately, and are small
   enough to extract safely even while screens still live in the monolith.
5. **Extract Timeline** (now that it's finished per step 2) into
   `TimelineScreen.jsx`, importing `TxnRow`, `Header`, `Search`, `Filters`,
   `BulkToolbar` as its own dependencies. `App.jsx` just renders
   `<TimelineScreen />`.
6. **Build → Extract, screen by screen**, in this order: Money, Bills,
   Budgets, continuing down the 18-screen list. Home is deliberately last —
   it depends on almost everything else (Accounts, Budgets, Bills, Goals,
   Events, Health Score), so it can't be cleanly extracted until those have
   their own stable modules to import from.

## Extract business logic, not just helpers
Pure calculation functions should live in `/logic`, never inline inside a
screen component. UI files call them, they don't contain them. Examples
already implicit in the current code and worth formalizing on extraction:
- `calculateNetWorth()`
- `calculateFinancialHealthScore()` (already isolated as a `useMemo` in
  `App.jsx` — good extraction candidate once `/logic` exists)
- `calculateBudgetHealth()`
- `calculateSafeSpend()`
- `calculateGoalForecast()`

## Definition of Extractable
A screen or component may leave `App.jsx` only if **all** of the following
are true:
- No duplicated code (it doesn't reimplement something `/helpers` or
  `/logic` already has)
- No inline business logic (calculations delegate to `/logic`)
- Uses shared helpers, not local reimplementations
- Uses shared constants, not local copies
- Passes validation (see below)
- Doesn't exceed ~500–700 lines

If it doesn't meet these, leave it in `App.jsx` and keep working on it —
don't extract half-finished code just to shrink the file.

## Validation, every single change
No exceptions, regardless of change size:
```
esbuild <file> --outfile=/tmp/check.out.js
```
Must compile clean before anything ships. This has caught real
edit-boundary mistakes (orphaned JSX, duplicated fragments) on multiple
occasions this project — it is not optional ceremony.

## Patterns already established in this codebase — follow these on new code
- **Backward compatibility by fallback, not migration scripts.** New fields
  get a computed default for records that predate them (see
  `getPersonModules()`, `getMembershipPeriods()`) rather than a one-time
  migration that rewrites stored data.
- **Cloud sync wiring is four spots, every time a new top-level state is
  added:** the `cloudSnapshot` object, its `useMemo` dependency array, the
  auto-push effect's dependency array, and the pull-side `applyCloudSnapshot`
  restore. Missing any one of these has caused real, shipped bugs — check
  all four whenever new persisted state is introduced.
- **No empty cards / no fake buttons.** A feature that has no real data or
  backing logic doesn't get a UI placeholder ("coming soon" excepted for
  genuinely deferred features) — it simply doesn't render, or isn't built
  yet at all. Don't promise capability that isn't there.
- **One canonical place per fact.** When the same number could be edited or
  displayed in two places (e.g. a budget amount), pick one as canonical and
  make the other a link/reference to it, not a second copy that can drift
  out of sync.
- **Shared components used elsewhere are wrapped, not modified,** when a
  screen needs different behavior. `TxnRow` is used in four places; Timeline's
  swipe actions were added via a `SwipeableTxnRow` wrapper, not by changing
  `TxnRow` itself, so the other three usages were unaffected.
