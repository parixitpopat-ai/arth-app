# Arth — Release Notes

User-facing history: what changed, why it matters to you. For the
technical/architectural record of the same work, see `CHANGELOG.md`.

---

## v0.7 — Architecture Foundation

This release closes out the foundational work — the app's daily-use
screens are stable, and a real fix landed for the most important bug
found this cycle.

**Fixed**
- **A real double-counting bug in per-person budgets.** If an expense
  was attributed to someone (e.g. "this was Nidhi's purchase") using an
  older version of the tagging flow, it could be counted twice in that
  person's monthly total. This is now fixed at the source — existing
  numbers correct themselves automatically, no action needed.
- Duplicate transactions could occasionally be created by fast, repeated
  taps on Save. Both Save buttons (quick and full) are now protected
  against this.
- Removed a redundant "+ Add" button that duplicated the floating + button.
- Fixed the evening greeting occasionally showing "Me" as if it were your name.
- The AI Insight card on Home now appears near the top, not buried at
  the bottom of the page.
- Fixed several duplicate-biller and stale-sync issues from earlier builds.

**New**
- **Quick Add, redesigned.** One screen — amount, expense/income,
  category, account, note — instead of a multi-step flow. Long-press the
  + button for a shortcut menu (Expense/Income/Transfer/Investment/Goal/Bill).
- **Split an expense with someone**, right from Quick Add, without
  leaving the screen.
- **Tag fuel and vehicle costs** to a specific bike/car, so per-vehicle
  costs don't collapse into one number.
- **"Count toward my spend" toggle** — log an expense (categorized,
  searchable) without it counting against your personal budget, for
  costs that genuinely aren't yours to track.
- **Vendor name suggestions** while typing in Quick Add.
- **Goals** — a real feature now: set a target, track progress manually
  or straight from a linked account's balance, mark complete.
- **Events got a real budget** — trips and outings can now track budget
  vs. actual spend, not just tag expenses.
- **Timeline** — swipe a transaction for quick actions (favourite,
  repeat, share, delete), date-grouped with running totals, bulk
  select/delete/re-categorize/export to CSV.
- **Financial Health Score** on Home — a real, formula-based number
  (savings rate, bills paid on time, budget adherence, and more), not a
  placeholder.
- **Duplicate Transaction Finder** — a tool (drawer menu) to find and
  clean up any transactions that might have been accidentally duplicated
  before the Save-button fix above.
- **Green as the app's primary color**, replacing the earlier gold/blue mix.

**Known limitations**
- The Person Type selector (when adding a new person) is still a long
  list of options rather than a compact dropdown — flagged, not yet fixed.
- Vendor/merchant suggestions only appear in Quick Add, not yet in the
  full transaction form.
- The "Count toward my spend" toggle only exists in Quick Add for now.

---

## v0.1 — Baseline

The app as it stood before this development cycle: core transaction
tracking, budgets, bills, people & groups, memberships.
