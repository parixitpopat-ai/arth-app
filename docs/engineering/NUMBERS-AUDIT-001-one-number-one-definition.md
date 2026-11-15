# NUMBERS-AUDIT-001: "my spend" and other totals calculated separately per screen

Rule (domain/allocations/adapter.js, `getMyExpenseShare`): my spend for an expense = amount − refunds − what others owe me
(people "owes" shares, group "owes" allocations, group collective amount); 0 if excluded from spend.

## Found and fixed (this change)
| Where (App.jsx, BudgetPage) | Was | Now |
|---|---|---|
| Settings → Categories: per-category spent / "Over budget by" | amount − refunds (counted money others owe me) | `getMyExpenseAmount` |
| Budget → Year view: "Spent so far", "Remaining budget", "Overspent in…" | amount − refunds | `getMyExpenseAmount` |
| Budget → Year view: "Month by Month" rows | amount − refunds | `getMyExpenseAmount` |
Reproduced with `tools/budget/owed-back-not-my-spend-browser.mjs`: a ₹13,056 expense fully owed back by a group showed ₹13,056 spent in Year view; now ₹0. (The Home / month Budget figures were already right.)

## Uses the shared rule (consistent)
Home spent, month Budget, category wheel + Uncategorised, Insights (domain/insights/*), Cash Flow, essentials / discretionary,
3-month average, calendar summary, runway.

## Own rule, NOT yet judged deliberate or accidental (needs a decision per screen)
- Transaction row "mine ₹x" (App.jsx ~3308): subtracts people shares and group collective only; ignores `groupAllocations`.
- Group pages: `getGroupTxnAmt`, `groupMySpend` (~12362), FY group spend (~12379), group month total (~13002 uses raw `amount`).
- Person pages: `getPersonAttributedAmount` (reads people / tagItems / allocations / forPerson, not the shared rule).
- Events totals (App.jsx ~10608, screens/EventsScreen.jsx 76/147): raw expense amount.
- Vendor totals (domain/transactions/vendorInsights.js): raw expense amount.
- Budget "scoped" category spent for a person/group (`getScopedCategorySpent`): includes transfers by design (WP16).
- `getNetExpenseAmount` (refunds only) remains for refund prefill only.

## Not verified
Chromium + synthetic data only. Nothing checked on a real device or with the user's real data.

## Budget model change (agreed with the owner)
- Person / group / category limits are INDICATORS, not caps and not must-spend. Going over a limit, or limits adding up to more than
  what is left, only warns; nothing is blocked (was: `wouldExceedDiscretionaryPool` refused the write). "Unallocated" is now "Free to spend".
- Commitments are the fixed, must-pay amounts, reserved first; a limit is never SUGGESTED below its minimum commitment.
- Category limits moved from Settings → Categories to Budget → "Category guides"; Settings only names/colours/organises. The stored field (`cat.budget`) is unchanged.
- "Ideas for <next month>" (domain/budget/limitSuggestions.js): lower an unused limit, move freed money to one that keeps being exceeded, raise one with nothing to cover it.
  Uses the last 3 completed months, needs at least 2. A person/group/category with NO recorded spend in the window gets no advice (spend per person only counts
  what is attributed to them, and category budgets can be unchosen presets).
- Not verified: real device, real data; applying a category suggestion changes the flat category guide (no per-month override exists for categories).
- Not built: trimming limits after a month where TOTAL spend passed the target (waiting on the owner's answer).
