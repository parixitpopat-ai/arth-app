# Arth — Regression Checklist

Every fix below needs to be verified against the **live deployed app**,
not assumed from the code. Tick each box only after checking it yourself
on `arth-app.vercel.app`. Update this file with the date/result as you go
— that becomes the record of what's actually been confirmed, not just
shipped.

## Cards domain extraction (v0.9.1)

Verify every number matches exactly what it showed before this pass —
nothing about the math changed, only where the code lives, so any
difference here is a real regression, not expected drift.

**Functional**
- ☐ Credit card dashboard totals (Home's CC summary card)
- ☐ Current statement amount
- ☐ Previous statement amount, where applicable
- ☐ Available credit / utilization percentage
- ☐ Upcoming payment / due date calculations
- ☐ Card cycle dates (statement date, due date)
- ☐ Card summaries on every screen that shows one: Home, Money/account
  detail, Reports/Insights CC breakdown, Bills' `ccBillsDue`,
  biller-linked-card views

**Edge cases**
- ☐ A credit card with zero transactions
- ☐ Multiple credit card accounts at once
- ☐ A closed/inactive card, if that state exists
- ☐ A transaction dated in the future
- ☐ A refund transaction against a card

## How to verify each one

### ☐ Membership grace period
Open a membership with grace days set → confirm the period end date and
the "+Nd grace" badge display correctly, and that grace no longer looks
baked into the raw end date.

### ☐ Person budgets — no double-counting
Open Budget → Budgets → expand a person who has attributed expenses.
Compare their category breakdown total against the sum of their actual
individual transactions in Timeline (filter by that person). They should
match exactly. **This is the one to check most carefully** — it's the bug
you caught twice (Nykaa, Healthy Bones & Joints Clinic), and the fix
needs confirming on your real data, not just a clean build.

### ☐ Bills — no duplicate biller shells
Open Bills → My Billers. Confirm no biller appears twice with the same
name/type. If old duplicates exist from before the fix, they won't
auto-merge — that needs manual cleanup (or a note to build a merge tool).

### ☐ Duplicate Transaction Finder
Drawer → 🔍 Find Duplicate Transactions. Confirm it opens, confirm it
actually finds the pairs you already know about (Nykaa ₹2,989,
17-Jul-2026 — if a real duplicate transaction record exists, it should
show here). If nothing shows up, the ₹2,989/₹600 doubling was purely a
calculation bug (now fixed), not a duplicate record — worth confirming
either way.

### ☐ Cloud sync
Make a change on one device/tab, switch to another (or switch apps and
back), confirm the change appears without needing a manual refresh, and
confirm no data reverted to an older state.

### ☐ AI Insight card position
Open Home. Confirm the Insight card (if one shows) sits right after
Financial Health Score, not at the bottom of the card stack.

### ☐ Greeting
Open Home at different times of day (or check the code logic makes
sense) — confirm it says "Good morning/afternoon/evening 👋" without a
literal "Me" if you haven't renamed your own profile.

### ☐ Double-submit protection
Try rapidly double-tapping Save on both Quick Add and the full Add
Transaction form. Confirm only one transaction gets created each time —
check Timeline immediately after each test.

### ☐ Duplicate "+ Add" button removed
Confirm the header no longer shows "+ Add" on Home/Timeline/Money/Me —
only the FAB. Confirm Bills still shows "+ Add Bill" in the header (that
one's intentional, not a duplicate).

## Status

Not yet run — this document exists to be filled in, not to claim
verification that hasn't happened. Update each checkbox with ✅/❌ and the
date once actually checked against the live app.
