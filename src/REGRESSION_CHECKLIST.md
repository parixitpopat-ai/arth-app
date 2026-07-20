# Arth — Regression Checklist

Every fix below needs to be verified against the **live deployed app**,
not assumed from the code. Tick each box only after checking it yourself
on `arth-app.vercel.app`. Update this file with the date/result as you go
— that becomes the record of what's actually been confirmed, not just
shipped.

## Bills refunds domain extraction (v0.9.3)

Same verification principle as Cards — nothing about the math changed,
only where it lives. Any difference here is a real regression.

| Test | Expected Result | Status | Notes |
|---|---|:---:|---|
| Bill with no refunds against it | Net amount = full bill amount | ☐ | |
| Bill with a partial refund | Net amount = bill amount minus refund | ☐ | |
| Bill with a refund covering the full amount | Net amount = 0, not negative | ☐ | |
| `totalUnpaid` on Bills screen | Sum matches manual addition of each unpaid bill's net amount | ☐ | |
| Bill amount shown in bill list/detail views | Matches across every screen it appears (list, detail, Bills tab) | ☐ | |

## Cards domain extraction (v0.9.1)

**Confirmed by user against the live app — passed, no issues found.**

Verify every number matches exactly what it showed before this pass —
nothing about the math changed, only where the code lives, so any
difference here is a real regression, not expected drift.

| Test | Expected Result | Status | Notes |
|---|---|:---:|---|
| Card dashboard totals (Home's CC summary) | Identical to pre-refactor | ☐ | |
| Current statement amount | Unchanged | ☐ | |
| Previous statement amount, where applicable | Unchanged | ☐ | |
| Available credit / utilization % | Unchanged | ☐ | |
| Upcoming payment / due date | Same due date, same amount | ☐ | |
| Card cycle dates (statement date, due date) | Same start/end dates as before | ☐ | |
| Card summary — Home | Matches other screens showing the same card | ☐ | |
| Card summary — Money/account detail | Matches Home's number for the same card | ☐ | |
| Card summary — Reports/Insights CC breakdown | Matches Home's number for the same card | ☐ | |
| Card summary — Bills' `ccBillsDue` | Matches Home's number for the same card | ☐ | |
| Card summary — biller-linked-card views | Matches Home's number for the same card | ☐ | |
| Card with zero transactions | No errors, zero values displayed cleanly | ☐ | |
| Multiple credit cards at once | Each card's numbers independent, no bleed-over | ☐ | |
| Closed/inactive card, if that state exists | Handled without error | ☐ | |
| Transaction dated in the future | Excluded from current-cycle totals correctly | ☐ | |
| Refund transaction against a card | Net amount reduced correctly, matches pre-refactor math | ☐ | |

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
