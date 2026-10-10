# FIN-TRUTH-001 — Arth financial truth model (audit and proposal)

Status: **proposal for review. No code changed by this document.**
Scope: cash balance, spending, card liability, net worth, bill outstanding, group spending, collective due, budget used, cash needed, carry-forward.
Method: read the calculation behind every screen, then reproduce disagreements in a real browser with seeded data. Anything not reproduced is labelled "by code only".
Anchors (existing decisions, preserved): ADR-017 (frozen transaction types; refunds and repayments are flags/relationships, not types), ADR-024 (Budget measures consumption; Protected Money measures cash required; never mixed), ADR-035 (Safe to Spend has one owner, not Home), ADR-036 (allocation engine), ADR-038 (bill paid/remaining derive from Contributions), ADR-018 (cards stay Accounts), BUD-001/002 (carry-forward stays Budget-owned; Home reflects it).

## 1. Four questions that must never share a number

| Question | Counts | Does not count |
|---|---|---|
| **Spending** — what did my life cost? | My share of expenses, net of refunds, excluding receivables from others and excluded-from-spend items | transfers, investments, card-bill payments, repayments received, loan disbursals |
| **Cash movement** — what moved in or out of my accounts? | every transaction that touches an account balance | unbilled card spend (no cash has moved) |
| **Obligations** — what do I still owe? | unpaid remainder of bills, billed card balance, EMIs, SIPs due | amounts already paid |
| **Budget utilisation** — am I within plan? | Spending (above) against the month's planning allocation | obligations (ADR-024 rule 2) |

## 2. Measure by measure

"Authoritative" = the function that should be the only definition. "Others" = parallel implementations or consumers that diverge.

| # | Measure | Definition (proposed, matches ADRs and current intent) | Authoritative today | Others / conflicts | State |
|---|---|---|---|---|---|
| 1 | **Cash balance** | opening + income + settlements received − expenses − investments − transfers out + transfers in − card payments, per account; linked UPI/debit are *payment methods of the bank* (ADR-018) so spend through them hits the bank once | `accountBalance` (inline in App.jsx) | `effectiveAccountBalance` adds the user's balance checkpoint gap; sums over accounts also add the linked UPI's own balance | **D2, R4** |
| 2 | **Spending** | `getMyExpenseShare` per expense; period total `getHouseholdAttributedTotal` | `domain/allocations/adapter.js` (single per-expense rule since WP-C) | refund map used by it counts repayments (D1); legacy raw sums remain in event totals and group detail | **D1** |
| 3 | **Card liability** | billed = unpaid statement charges; unbilled = charges after the last statement; in use = billed + unbilled | `getCardSummary` + `getCardUsage` | net worth uses billed only; `StatsPage` carries an unreachable duplicate | **R1**, cleanup |
| 4 | **Net worth** | assets − liabilities | `totalAssetsValue − totalLiabilitiesValue` (App.jsx) | cash leg inherits D2 and R4 | **D2, R1, R4** |
| 5 | **Bill outstanding** | `getBillBalance().remaining`; partial stored as "unpaid"; card statement bills keep their own mechanism | `domain/obligations/billBalance.js` | Payments total, commitments, Outlook agree (browser-verified); group "Spent" fixed in WP-E | consistent |
| 6 | **Group spending** | total spent on the group (all members), not my share | `getGroupAttributedAmount` (gross) | group detail adds unpaid bills (obligation) to spending; refunds not netted | **R2** |
| 7 | **Collective due** | what a group still owes me | `domain/group/receivable.js` | bill collective uses full bill amount, ignores partial payment; not netted for refunds | **R3** (frozen: no change without a decision) |
| 8 | **Budget used** | household spending against the month's planning allocation | `getHouseholdAttributedTotal` / `getHouseholdPlanningAllocation` | Home, Budget, Insights, Money "Went out" all agree (verified). Person/group budgets use their own attributed amounts by design (ADR-036) | consistent |
| 9 | **Cash needed** | unpaid spending + committed saving + debt service, over available cash | `futureMoney` commitments | Outlook includes EMIs, Home omits them | **D3** |
| 10 | **Carry-forward** | previous month's planning allocation − previous month's spending, added to this month's budget when enabled | `resolveCarryForwardMonthly` + `getCarryForwardPrevSpend` (branch `wp-d-carry-forward-attributed`) | Home safe-to-spend ignores it though BUD-002 says Home reflects it | **D4** |

## 3. Rules matrix (what each fact does to each measure)

| Fact | Cash | Spending | Card | Net worth | Obligations | Budget |
|---|---|---|---|---|---|---|
| Expense (bank) | − | + my share | – | − (via cash) | – | + |
| Expense (card) | none until paid | + my share | + unbilled, then billed | − when counted (R1) | + at statement | + |
| Investment | − | **0** | + (billed/unbilled; branch `wp-b2`) | asset + | – | 0 |
| Transfer (own accounts) | − / + | 0 | – | 0 | – | 0 |
| Loan given | − | 0 | – | 0 (cash − , receivable +) | – | 0 |
| Card payment | − bank | 0 | − billed | 0 | − | 0 |
| Refund (linked to expense, `isRefund`) | + | **− from that expense** | − billed (if on card) | – | – | − |
| Reimbursement / repayment from a person | + | **0** (their share is already excluded via the split) | – | receivable − | − receivable | 0 |
| Split: others owe me | – | my share only | – | receivable + | receivable | my share |
| Partial bill payment | − | payment is the expense | – | – | remaining only | via the payment |

Bold cells are where the code currently disagrees with the rule (D1).

## 4. Findings

### Confirmed defects (reproduced)
- **D1 — a friend repaying a split makes spending fall twice.** Expense ₹1,000, friend owes ₹400: Home "Spent" ₹600. After the friend repays ₹400 (repayment linked to the expense, the shape the app writes at `App.jsx` ~L5692) Home shows **₹200**. Cause: the spending refund map counts *any* settlement with `againstTxnId`; the bill refund map correctly requires `isRefund`. The expense list display already excludes person repayments (`isRefund || !fromPersonId`). Two copies: `buildRefundTotalsByExpense` (domain) and `refundTotalsByExpense` (App.jsx).
- **D2 — spend through a linked UPI/debit is deducted twice in account sums.** Bank ₹10,000, UPI linked to it, ₹500 spent on the UPI: net worth "Bank and cash" shows **₹9,000** (true ₹9,500). UPI linked to a card: ₹300 card spend reduces cash to ₹8,700 (true ₹9,500) *and* sits on the card. Same account filter feeds Home/Outlook available cash (by code only). `upiTotal` already excludes linked UPIs; the other sums do not.
- **D3 — "Money required" differs between Home and Outlook.** Same data, bill ₹1,000 + school fees ₹30,000 + EMI ₹5,000: Home **₹31,000**, Outlook "Needed" **₹36,000**. Home omits debt service; the Outlook code comment records this as a bug fixed only there. Home's At-Risk status and buffer inherit the omission.
- **D4 — Home ignores carry-forward** (when enabled). BUD-002 says Home's baseline reflects it and BUD-001 says carry-forward collapses to one implementation. Home uses `getHouseholdPlanningAllocation` only.
- **D5 — cleanup:** `StatsPage` is defined and never rendered, and duplicates the card utilisation maths.

### Undecided product rules (need your call)
- **R1** Does unbilled card spend count in net worth? Today: billed only; "In use" includes unbilled.
- **R2** Does group "Spent" include unpaid bills? Today yes (remaining part). Refunds are not netted from group spend.
- **R3** Should collective due follow partial bill payments and refunds? Today no. Frozen pending evidence.
- **R4** Cash available: the raw computed balance, or the balance corrected by the user's checkpoint? Browser: net worth ₹11,999.99 (with a ₹2,000 checkpoint gap) vs Outlook available ₹9,999.99.
- **R5** Label: a loan disbursal sits under "Transfers between your accounts" on the Money screen. Wording only.
- **R6** Home card says "Next 30 days" but sums all unpaid items (overdue and later). Wording or scope?

## 5. Smallest change set (in this order; each its own branch)

1. **One refund rule (D1).** A single domain `buildRefundTotalsByExpense` that counts a settlement only when it is a refund (`isRefund`, plus legacy rows with no `fromPersonId`/`fromGroupId`, the rule the display code already uses). App.jsx's copy is deleted. Tests: friend repays, partial repay, refund, legacy refund, refund + repayment on one expense.
2. **One cash position (D2).** Move the balance calculation into a domain function that treats linked UPI/debit as methods of their parent, and returns per-account and total cash. Net worth, Home and Outlook consume it. R4 decides raw vs checkpoint inside this one function.
3. **One cash-required (D3).** A single function over the future-money projection (spending + saving + debt service); Home and Outlook both call it.
4. **One effective monthly budget (D4).** `getEffectiveMonthlyBudget(…carry…)` used by Home, Budget and Insights. Default stays off.
5. **Reconciliation suite.** One fixture of facts (linked UPI, card with billed and unbilled, investment, refund, friend repayment, partial bill, group split, loan given, EMI) asserting every measure from the authoritative functions and the cross-screen invariants: cash change = came in − went out − non-spending outflows; Home required = Outlook needed; Spent unchanged by a repayment; card in use = billed + unbilled; carry-forward month's prior spend = that month's shown Spent.
6. After your answers: R1, R2, R4 (small, inside steps 2/5).

Not changing: transaction types (ADR-017), bill balance model (ADR-038), collective-due semantics (R3), carry-forward default, Payments decisions, any feature work.

## 6. Verification notes
Every number above marked "Browser" was produced by seeding the stated records into the running app. D1's repayment record was seeded in the shape the app's save code writes; I did not drive the repayment UI end to end. Nothing here was tested against real user data or on a device.

## 7. Rules locked after review, and what was built

Locked: (1) a loan given is a receivable, not an expense; repayments reduce the receivable and never reduce past spending; an explicit write-off is recognised as Bad Debts, never automatic on a late or overdue loan; later recovery must not double-count or rewrite history. (2) The real source is a bank, wallet or card account; UPI/debit/Mastercard are rails, so spend through a linked rail moves the funding account once. (3) Money Required is one calculation shared by Home and Outlook and includes loan EMIs; it is not spending or budget used. (4) `getMoneyRequiredForPeriod` and `getEffectiveMonthlyBudget` own those measures; carry-forward stays off by default.

Built, each on its own branch: D1 `wp-d1-refund-rule`, D2 `wp-d2-funding-account`, D3 `wp-d3-money-required`, D4 `wp-d4-effective-budget` (stacked on `wp-d-carry-forward-attributed`).

Loan audit (existing architecture): loan disbursal is a transfer out of the lending account with no destination (never an expense; `domain/loans/disbursal.js`); a repayment is a `settlement_in` with `linkedLoanId` and no `againstTxnId`, so it never reaches the spending refund map. Loans carry the statuses `written_off` and `converted_to_expense` and the UI labels them, **but nothing in the app sets them** and there is no Bad Debts category or recognition. Person-split write-off exists (`writtenOff`, `settled:true`) but only hides the receivable; it recognises no loss. Explicit loan write-off with Bad Debts and post-write-off recovery is therefore **not supported today and is a separate work package (WP-F)**, not part of D1-D4.
