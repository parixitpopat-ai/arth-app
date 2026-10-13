# WEB-V1-VERIFICATION-001 — main smoke results, real-device checklist, two-device sync test

Date: 13 Oct 2026. Code under test: `main` (963c75c) **plus** the three unmerged branches named below, merged locally on a throwaway
branch (`wp-closure-verify`): `wp-zero-statement-attention` (6ed6e0a), `wp-test-inventory` (85df2e6). `wp-5-line-item-link` (02fad93) is domain-only and was verified separately.
All of this is browser (Playwright, Chromium, 420 px unless stated, Asia/Kolkata) and test-runner evidence. **Nothing here is real-device evidence.**

## 1. Automated results
| Check | Result |
|---|---|
| `npm test` on main + the two branches | 1,653 / 1,653 pass |
| `npm test` on `wp-5-line-item-link` alone | 1,544 / 1,544 pass |
| `npm run build` | passes |
| `npx eslint src domain` | 4 problems (2 errors, 2 warnings) — the same 4 as the baseline, none in the changed files |

## 2. Browser smoke on main + branches (seeded localStorage, PIN 1234)
| Area | What was driven | Observed |
|---|---|---|
| Paid by | Add Expense, "Paid by Ravi" | Saved with no account; cash unchanged (₹49,500 after a ₹500 own expense in the same run) |
| Pay back | Pay back from the person and the group; overpay | Group tile ₹1,000 → ₹0; cash ₹48,000 → ₹46,600; overpayment shows "Ravi owes you ₹400" |
| Payment methods under parent | Money, Settings > Accounts, Paid-via picker | Debit/UPI not listed separately in Money; not offered as a source; unlinked UPI listed on its own; cash ₹50,500 |
| People / Groups | People list, person page, group page | Render; relationship rows, capabilities, group tiles present |
| Bills / statements | Bills tab, Billers tab, Home | Zero-amount mismatch statement sits in "Check statement", not overdue; Home "1 Due | 1 overdue"; "All bills · 1" |
| Expected obligations | Set a ₹800 monthly schedule, Confirm amount | Expected row appears, Confirm creates a real unpaid bill (forType person) |
| Outlook | Open from Home | Needed ₹2,300 = Home Money Required; Buffer ₹4,97,700; zero statement not listed; Runway 4.1 months with EMIs inside essentials |
| Budget | Budget page | Renders; carry-forward on; Safe to Spend ₹19,300 |
| Insights | Insights page | Sections render; renewal "Expected" then bill states correct |
| Calendar / layout | 320 px and 390 px: Home, Money, Payments, People, Calendar | No horizontal overflow, 0 console errors |
| School fees multi-payment | ₹20,000 across 4 months, 2 accounts | One transaction, 2 payment lines, 4 periods settled |
Not re-run today (earlier-session verification only): EMI progress, quarterly memberships, gym catch-up, card alert notification, prepaid coverage, loan-given-not-expense.
Script gaps: two older scripts (`pg2` tail, `g4`) failed on stale selectors/port, not on app errors.

**Observation (not asserted as a defect):** a plain-bill connection with no bills yet shows Add bill / Attach / status, but not the "Set schedule" control; that control appears once the connection has a bill.

## 3. Real-device checklist (to be performed by the owner; every row is PENDING)
Use a real phone with the installed PWA, a signed-in account, and the data you actually use. Note the build stamp in Settings > Release Notes first.
1. **Balances.** For each bank, cash and card: the balance shown equals your bank/app. Add a balance checkpoint; confirm Available Cash on Home and Outlook equals the checkpoint plus later movements.
2. **Payments.** Pay a bill from a bank (one debit); pay from a linked UPI/debit (the funding bank debits once); pay a card bill; part-pay a bill (remains, status Partially paid); overpay (Unallocated shown).
3. **Statements.** On a card with no spend in the cycle, the billing-day question appears once. A statement where the bank figure differs shows "Check statement: bank says ₹X", not overdue.
4. **Card EMIs.** Add an EMI purchase; the instalments land on their own statements; outstanding falls and the loan closes after the last; Money Required and Runway count each instalment once.
5. **Budget.** Monthly budget, override (including ₹0), carry-forward (default off), Spent figure and pace tick, Mandatory commitments, per-person limit cannot exceed the pool.
6. **Plan Ahead.** Open the readiness card; dismiss/snooze a nudge; confirm the state persists after a reload.
7. **Paid by / Pay back.** Record an expense paid by a person; pay them back from the person and from a group; check I-owe, group balance and account.
8. **320 px and dark/light.** Home, Payments, Calendar, an open sheet, the keyboard open on an amount field.
9. **Lock.** Lock button, wrong PIN five times (lockout), idle auto-lock.
Record per row: pass/fail, device, OS/browser, build stamp, and a screenshot for any fail.

## 4. Two-device Supabase restore test — billers and membership relationships (PENDING)
What the code does: the cloud snapshot is one JSON written to `arth_snapshots` (columns `snapshot`, `updated_at`; see `src/cloudSync.js`). It includes `billers` and `membershipRelationships` (commit 9563096). On restore these two are applied only if the snapshot contains them as arrays; `bills` and `billerAccounts` are reset to `[]` when absent. Plan Ahead nudge state is in the same snapshot (`planNudges`).
Test (needs two real devices or two browser profiles, one account, a clean second device):
1. **Device A:** sign in. Create a biller account (e.g. Electricity) attributed to a person, with an *active* relationship, a schedule (₹800 monthly, due day 5), one bill, one paused and one ended relationship on other billers. Add a membership relationship. Note counts.
2. Wait for sync (Settings > Cloud Sync & Account shows the sync status; I have not checked its exact wording); reload A to confirm nothing changed.
3. **Device B (fresh, no local data):** sign in, let it restore. Verify equal: billers, biller accounts, relationships (status and effective dates), schedule, bills, Expected row, People > relationship rows, Payments > Connected.
4. **Round trip:** on B change a relationship status (Pause) and add a bill; wait for sync; reload A; confirm both appear. Then make a change on A and on B at nearly the same time and record which wins (expected: last write wins, per the snapshot model — record the actual result).
5. **Plan Ahead:** dismiss a nudge on A, confirm it stays dismissed on B after sync.
6. **Old-snapshot case:** restore a backup JSON that predates these two fields; confirm local billers/relationships are *kept* (not wiped).
Pass = every item equal on both devices; anything missing is a sync defect to report with the field name. Until performed this is **unverified**.
