# WEB-V1-COMPLETION-MATRIX — authoritative status of Arth Web v1

Date: 13 Oct 2026. **Pinned to `origin/main` = `8a96e5f`** (fast-forwarded from fe43628; it contains Reports `8a71c13` and T-34 `769a60a`). All code in this matrix is exactly the tree at `8a96e5f`; this file's own re-pin is a docs-only commit on top. On `8a96e5f`: `npm test` 1,679 / 1,679, 0 skipped; production build passes; lint shows only the 4 baseline problems. Rows marked *main-t34-reports-13Oct* were browser-verified on the same code (integration tree 0e81823, then re-run on actual main for Reports, T-34, the ₹0 statement and the pool block).
This replaces the June roadmap/pending-scope files as the operational source; those are history (30 Jun 2026 and earlier).

## How to read it
**Sources:** `ARTH_SCOPE` = `src/ARTH_SCOPE.md` (frozen 18-screen V1 list; its navigation is superseded by UI-2C N-1) · `UI-2C` = UI-2C plan and handoff v4 (design-docs repo) · `FIN-TRUTH` = `docs/engineering/FIN-TRUTH-001/002/003` · `UI-FIX` = the Oct 2026 UI fixes handoff (UI-A to UI-D) as worked in this session · `DEC` = a decision you gave in this session · `ADR` = `docs/engineering` ADR-017/024/035/036/038.
**Evidence, three separate columns.** *Tests* = named test files (all in `npm test`). *Browser* = Playwright: **main-8e722e8-13Oct** (run on the integration above) or **main-13Oct** (run earlier today on main plus some of the branches, see `WEB-V1-VERIFICATION-001.md`) or **at-merge** (run when that work merged, by me in an earlier session, not re-run today) or none. *Device* = real phone: **none for every row** — no real-device test has been performed.
**Status:** **IV** implemented and verified (tests + browser on today's code) · **IU** implemented but unverified (tests, and/or browser only at merge, no device) · **RM** required but missing · **DF** deferred / out of scope.
A "required" item means a source above names it for Web v1. Where the sources disagree or are silent, the row says **scope to confirm** and is not counted as a blocker.

## A. Financial truth (FIN-TRUTH; locked)
| # | Requirement (source) | Code | Tests | Browser | Status | Remaining action / priority |
|---|---|---|---|---|---|---|
| 1 | Only refunds lower an expense; a person's repayment never lowers spend twice (FIN-TRUTH D1, ADR-035) | `domain/allocations/adapter.js` | `refundRule.test.js`, `myExpenseShare.test.js` | at-merge | IU | Device pass (checklist 2). Low |
| 2 | Linked UPI/debit are payment rails; funding account debited once (D2) | `src/domain/accounts/accountBalance.js`; Settings rows | `accountBalance.test.js` | main-13Oct (Money, picker, Settings) | IV | Device pass. Low |
| 3 | Home and Outlook share one Money Required (D3) | `futureMoney/moneyRequired.js` | `moneyRequired.test.js`, `commitmentTimeline.test.js` | main-13Oct (Home ₹9,200 = Outlook Needed ₹9,200) | IV | None |
| 4 | One effective monthly budget; ₹0 override valid; carry-forward off by default (D4) | `getEffectiveMonthlyBudget` | `carryForward.test.js` | main-13Oct (Budget/Home) | IV | Device pass. Low |
| 5 | Available Cash = balance checkpoint + later movements (R4) | `domain/accounts/availableCash.js` | `availableCash.test.js` | main-13Oct (Outlook) | IV | Device pass (checklist 1). Medium |
| 6 | Loan given is a receivable, not an expense (lock 1) | `domain/loans/disbursal.js` | `disbursal.test.js` | main-8e722e8-13Oct (Loan given chip on Add) | IV | Device pass. Low |
| 7 | Card billed / unbilled / in use reconcile; EMIs counted once (R1, FIN-TRUTH) | `cards/summaries.js`, `cardEmiReconciliation` | `cardEmiReconciliation.test.js`, `usage.test.js`, `runway.test.js` | main-13Oct (Runway counts EMI once) | IV | Device pass (checklist 4). Medium |
| 8 | EMI purchase loans track billed instalments; back-dated EMI audited (DEC) | `loans/autoEmiProgress.js`, `emiInstalments.js` | their tests | main-8e722e8-13Oct (legacy EMI loan: billed instalment recorded, outstanding 0, closed) | IV | Device pass (checklist 4). Low |
| 9 | Statement states; "To pay" meaning (FIN-TRUTH-002) | `cards/reconciliation.js`, `statementBills.js` | `reconciliation.test.js`, `statementBills.test.js` | main-13Oct | IV | None |
| 10 | No transactions, no statement bill; billing-day check (DEC) | `statementBills.js` | `statementBills.test.js` | main-13Oct (prompt shown) | IV | None |
| 11 | ₹0 statement with a bank figure: kept, never payable, never overdue, shown as a check item everywhere (DEC) | `obligations/billBalance.js` + 6 consumers | `zeroStatement.test.js` (10) | main-8e722e8-13Oct: Home, Bills, Billers, relationship row, Outlook | IV (on origin/main 8e722e8) | None. High-priority item closed |
| 12 | Calendar-month card spending (FIN-TRUTH-003; DEC) | none (definition only) | none | none | DF — explicitly deferred (scope lock, 13 Oct) | Not part of this closeout. Medium |
| 13 | Loan write-off / Bad Debts (WP-F; FIN-TRUTH lock 1) | none; statuses exist, nothing sets them | none | none | DF | Separate WP. Low for v1 |
| 14 | Open decisions: R1 net worth uses billed only; R2 group Spent includes unpaid bills; R3 collective due (frozen) | `App.jsx` | — | — | DF | Decide R1, R2. Low |

## B. People, Payments, Relationships (UI-2C)
| # | Requirement | Code | Tests | Browser | Status | Remaining action / priority |
|---|---|---|---|---|---|---|
| 15 | M1 People and Groups: one-screen add, split default, detail/edit (QW-3, QW-4, QW-6, WP-1) | `components/people/*`, `domain/person/*`, `domain/relationships/attributedAccounts.js` | `splitDefault`, `newPerson`, `attributedAccounts` tests | main-t34-reports-13Oct (add person with setup sheet, edit/rename persisted, add group persisted) | IV | Device pass. Low |
| 16 | M2 Payments and bills: list, detail, record payment, partial/overpay, Unallocated (QW-7, WP-2, WP-4, ADR-038) | `domain/obligations/billBalance.js`, `screens/payments/*` | `billBalance`, `billContributionSync`, `paymentsView` tests | main-13Oct | IV | Device pass (checklist 2). Medium |
| 17 | Expected obligations: computed, never a bill; Confirm amount creates the bill (WP-3, ADR-039) | `domain/obligations/expected.js`, `ExpectedSchedulePanel.jsx` | `expected.test.js` | main-13Oct (schedule → Expected → Confirm → bill) | IV | Observation: no "Set schedule" on a bill-less connection. ADR-039 has no file in arth-app (only references). Low |
| 18 | Relationship lifecycle: active / pause / end, usually-paid-from (WP-6) | `RelationshipStatusPanel`, `domain/membership/lifecycle.js` | `lifecycle.test.js` | main-t34-reports-13Oct (pause with reason, resume, end: status and history stored: active→paused→active→ended) | IV | Device pass. Low |
| 19 | Cloud sync of billers and membership relationships (WP-8) | `App.jsx` snapshot + restore; `src/cloudSync.js` | none for the sync path | none | IU | **Two-device test** (`WEB-V1-VERIFICATION-001.md` §4). **High** |
| 20 | Item-level bill link, domain: optional `lineItemId`, per-item check (WP-5) | `domain/obligations/contribution.js`, `billBalance.js`, `billContributionSync.js` | `contributionLineItem.test.js` (8) | main-8e722e8-13Oct (app loads item-linked and plain contributions; item 1 and item 2 of one payment each pay a different bill; a plain record is unchanged). No UI exists to exercise item linking or the limits; limits are test-only | IV for the domain (on origin/main 8e722e8) | T-34 UI is row 21. Medium |
| 21 | Item-level bill link, UI (T-34 per-item "Link a bill"; D-7: "Relationship" vs "Pays a bill?" is chosen in the handoff) | `App.jsx` Add Expense (itemised items), `domain/obligations/itemBillLinks.js` | `itemBillLinks.test.js` (8), `contributionLineItem.test.js` (8) | main-t34-reports-13Oct: link two items to two bills (both paid); two items on one bill (700 + 300 of 1,000, never over); item above its bill's balance applies the balance and shows the rest unallocated; edit shows existing links; unlink reduces and reopens a bill nothing else pays; whole-expense Bill payment unchanged (no `lineItemId`); 320 px no overflow | IV | Device pass. None otherwise |
| 22 | Navigation Home / Money / Payments / People with Add (N-1) | `App.jsx` `TABS` | — | main-13Oct | IV | None |
| 23 | Desktop two-pane layout (WP-7, D-1/D-2) | none; no responsive layer | none | none | DF — explicitly deferred (scope lock, 13 Oct) | Not part of this closeout. Low |
| 24 | Other obligations writing Contributions (WP-9 decision) | no decision record found | — | — | DF | Decision record only. Low |
| 25 | Paid by a person; Pay back person/group; group balance reconciliation (DEC) | `domain/person/paidBy.js`, `payback.js`, `domain/group/balances.js` | `paidBy`, `payback`, `balances` tests | main-13Oct | IV | Device pass (checklist 7). Medium |
| 26 | Debit/UPI listed under their bank or card (DEC) | `Settings` rows, `isLinkedPaymentMethod` | `accountBalance.test.js` | main-13Oct | IV | None |
| 27 | Card spend alert in Notifications, per cycle, dismissible (DEC) | `domain/cards/alerts.js` | `alerts.test.js` | main-8e722e8-13Oct (notification shown, archive persists after reload) | IV | Device pass. Low |
| 28 | Settings > Accounts row opens edit, not transactions (DEC) | `App.jsx` Settings | — | main-13Oct (edit buttons) | IV | None |

## C. Outlook, Budget, Insights, Home, Calendar (UI-FIX, ARTH_SCOPE)
| # | Requirement | Code | Tests | Browser | Status | Remaining action / priority |
|---|---|---|---|---|---|---|
| 29 | Outlook: Buffer hero, Financial Runway beside it, Available Cash separate (UI-B) | `OutlookPage`, `cashflow/runway.js`, `commitmentTimeline.js` | `runway.test.js`, `commitmentTimeline.test.js` | main-13Oct | IV | Device pass. Low |
| 30 | Home Spent headline, pace tick, Budget headline, amber expected-by-today tick (UI-A, UI-D) | `budget/pace.js`, Home | `pace.test.js` | main-13Oct | IV | None |
| 31 | Transactions calendar: future days, one month ahead, day sheet, tap a day to add (UI-C, UI-D) | `screens/TransactionsCalendar.jsx` | `calendarSummary.test.js` | main-13Oct incl. 320 and 390 px | IV | None |
| 32 | Budget: mandatory commitments, unplanned actual, pool limit (WP7) | `domain/budget/*`, Budget page | `commitmentSplit`, `spread`, `readiness` tests | main-t34-reports-13Oct (page renders with unplanned category; adding a commitment of ₹20,000 moves the pool ₹50,000 → ₹30,000 and is stored); pool over-allocation block re-verified on main 8a96e5f: a ₹40,000 allocation against a ₹30,000 pool shows "Exceeds Discretionary Pool by ₹10,000 — reduce this to save" and leaves Unallocated at ₹30,000; ₹10,000 saves and Unallocated becomes ₹20,000 | IV | Device pass (checklist 5). Medium |
| 33 | Insights, 11 sections (WP8) | `domain/insights/*`, `InsightsPage` | `domain/insights/*.test.js` | main-t34-reports-13Oct (all 11 sections render with data; spending, categories, people checked; section links open Budget) | IV | Note: Insights §5 monthly per-person uses the people-map only; Reports uses the fuller Budget definition (see row 39). Low |
| 34 | Prepaid coverage on biller detail (WP9) | `domain/bills/prepaidUtilisation.js` | `prepaidUtilisation.test.js` | main-8e722e8-13Oct (coverage card: plan, 13 of 28 days used, 15 left) | IV | Low |
| 35 | Quarterly/yearly membership is one dated Outlook item (DEC) | `membership/futureMoney.js`, `futureMoney/rhythm.js` | their tests | main-8e722e8-13Oct (quarterly is one later item; monthly one in the list) | IV | Low |
| 36 | Gym check-in catch-up with a break option (DEC) | `membership/checkIn.js` | `checkIn.test.js` | main-8e722e8-13Oct (13 days offered oldest first; break skips all) | IV | Low |
| 37 | Plan Ahead readiness card and nudge state, synced (WP-A) | `domain/budget/readiness.js`, `nudge.js` | their tests | main-8e722e8-13Oct (Plan Ahead card opens, November figures right, over-budget nudge shows, "Not now" stored and kept after reload). Cloud sync of the nudge not verified | IV locally; sync IU | Two-device (§4 step 5) and device (checklist 6). High |

## D. Reports (ARTH_SCOPE screen 12; roadmap Phase 5)
The frozen list names a Reports screen; `SCREEN_ARCHITECTURE.md` marks it not started; `V1_DEFINITION.md` leaves v1-or-later undecided. The audit below is of what exists.
| # | Requirement | What exists | Status | Gap / action |
|---|---|---|---|---|
| 38 | Monthly spend report: by category and by person | Insights §1, §5, §6 (month picker); Money > Monthly cash flow; Reports > Year summary month rows open the month. Tests `monthlyCashFlow.test.js`, `fiscalYear.test.js`; browser main-t34-reports-13Oct | IV | None |
| 39 | Per-person spend report incl. FY coverage | Money > Reports > By person: every person for a chosen FY, spent vs planned, remaining, % used, categories, month by month. Uses the Budget definition (people map, tagItems, allocations, forPerson) | IV | Known difference: Insights §5 (monthly) counts only the people map, so its figure can be lower for the same person; not changed (no scope). Test: `fiscalYear.test.js` covers the attribution fields; browser: 3,900 = 3,000 + 900 (tagItems), 400 via forPerson |
| 40 | FY annual summary (household income, spend, % left over, by category, April–March) | Money > Reports > Year summary: sums the 12 monthly cash-flow results (`domain/reports/fiscalYear.js`); FY picker; month rows; categories; income sources; not-counted | IV | `fiscalYear.test.js` (10) reconciles with the months; browser: ₹1,80,000 in, ₹24,300 out, +₹1,55,700, 87%, prior FY, 320 px no overflow |
| 41 | Net worth trend over time | Daily snapshots are recorded (`wealthSnapshots`); Insights §11 shows change since last month only | DF — explicitly deferred (scope lock, 13 Oct) | Not part of this closeout |
| 42 | Cash-flow visual | `screens/CashFlowScreen.jsx` monthly bars (`cf-chart`) | IU | Rendered on Money; chart not browser-checked today. Low |
| 43 | Daily spend calendar | Row 31 | IV | None |

## E. Foundation, security, other ARTH_SCOPE screens
| # | Requirement | Code | Evidence | Status | Remaining action / priority |
|---|---|---|---|---|---|
| 44 | PIN lock, 5-attempt lockout, idle auto-lock | `App.jsx` (PIN state ~L729, idle ~L853) | Code only; browser PIN unlock used by every script; no lockout test | IU | Device pass (checklist 9). Medium |
| 45 | Biometric (WebAuthn), device management | none | — | DF | Later |
| 46 | Splash / Onboarding | `WelcomeScreen`, `MasterUserProfileScreen` (first-run) | Seen working in scripts' first-run path only incidentally; `SCREEN_ARCHITECTURE.md` still says not started (stale) | IU for onboarding; DF for a native-style splash (PWA) | Confirm onboarding on a fresh device. Low |
| 47 | Documents | Connection-level documents on a biller | Browser at an earlier merge | IU; a unified vault and membership documents are DF | Low |
| 48 | Duplicate-transaction warning, transaction detail, search | `App.jsx` | Code present; not exercised today | IU | Low |
| 49 | Loading skeletons | none | — | DF (UX polish) | Low |
| 50 | AI + Search; AI categorisation | none | — | DF (separate track) | — |
| 51 | Bank statement import (CSV/Excel; IDFC FIRST, ICICI) | none (only CSV export, JSON restore) | — | DF (roadmap Phase 6–7; not in the frozen V1 list) | Separate |
| 52 | Android/APK, SMS, offline queue, open banking, per-purchase reimbursement | — | — | DF (separate) | — |
| 53 | Test suite integrity | `src/testInventory.test.js`, `TEST-INVENTORY-001.md` | `testInventory.test.js`; 1,661 / 1,661, 0 skipped, all registered | IV on main 8e722e8 | None |
| 54 | `StatsPage` unreachable duplicate (FIN-TRUTH D5) | `App.jsx` ~L17687 | `grep`: no `<StatsPage` | Cleanup, not a feature | Keep for now; remove on its own branch later (your decision) |
| 55 | Documentation drift | June roadmap/pending scope, `SCREEN_ARCHITECTURE.md` | — | Stale | Retire or mark as history. Medium |

## Web v1 status
**Web v1 is NOT complete.** The locked Web v1 requirements — household FY summary (row 40), per-person reporting with FY coverage (row 39) and T-34 (row 21) — are now implemented, merged and browser-verified on main `8a96e5f`. Explicitly deferred by scope lock: calendar-month card spending (12), net-worth history UI (41), desktop two-pane (23). **Real-device (checklist) and two-device Supabase (§4) checks are PENDING: no device evidence exists for any row.** Web v1 cannot be declared complete until they are done.

## Web v1 blockers (my assessment, on this evidence)
1. ~~A signed-off Web v1 scope~~ — locked 13 Oct: in = rows 39, 40, 21; deferred = rows 12, 23, 41.
2. ~~Merge the branches~~ — done: rows 11, 20, 53 are on `origin/main` 8e722e8. No known data-truth defect remains open.
3. **Two-device Supabase restore** (row 19) and the **real-device pass** (checklist) — not performed. Until they are, no row is device-verified and rows 19 and 37 (sync) stay IU.
3a. ~~Merge of the Reports and T-34 branches~~ — done (8a96e5f).
4. Not blockers on this evidence: `StatsPage`, WP-F, skeletons, biometrics, statement import, and the three scope-locked deferrals.

## Proposed closure sequence
1. ~~Merge the four branches~~ — done (8e722e8).
2. ~~Scope decisions~~ — locked (see Web v1 status).
3. You run the real-device checklist and the two-device test; I fix what fails.
4. ~~Smoke the remaining IU rows~~ — done for rows 15, 18, 32, 33 on the pinned tree.
5. ~~Household FY summary, per-person FY, T-34 UI~~ — built, merged and verified on main 8a96e5f.
6. Last: `StatsPage` removal branch; retire the stale scope documents.
