# BUD-005 — Monthly Money Plan: data-driven calculation specification (review draft; no code)

Supersedes BUD-004 sections 3 and 4 (fixed buckets, salary slabs, percentage templates). BUD-004 section 1 (existing helpers), section 2 (findings) and section 8 (designer constraints) still apply. **Nothing in this document is implemented.** The ₹30,000 / 25-10-15-15-35 scenario from the brief is used only as a mock-up and test fixture; it is never a shipped default.

Labels: **[VERIFIED]** read in the code; **[UNVERIFIED]** not confirmed; **[DECISION]** needs an owner answer.

## 0. Principle
A user's plan is *discovered*: which categories matter, what is committed, what is essential and what can flex all come from that user's own Arth data and corrections. No preset buckets, no preset percentages. Every number is shown with the data and rule behind it, and every classification can be corrected. Nothing is written to existing budgets or transactions.

## 1. Inputs and the existing helpers that already own each rule
| Need | Existing owner (reuse, do not re-derive) |
|---|---|
| My share of a category's spend, refunds netted, split-with-others excluded, multi-category lines | `getCategoryAttributedTotal`, `buildRefundTotalsByExpense`, `getHouseholdAttributedTotal` (`domain/allocations/adapter.js`) |
| Essential spend average with EMIs/loans removed and card purchases counted once | `getEssentialMonthlyOutflow` (`domain/cashflow/runway.js`): uses `cats[].fixed` as the app's existing "essential" flag [VERIFIED], last N complete months, excludes `linkedLoanId`, `isLoanDisbursal`, `isAutoEmiInstallment`, `cc_emi`; takes the larger of observed vs Mandatory Commitments (not the sum) |
| Income as a monthly figure | `toMonthlyAmount` (`runway.js`, weekly/fortnightly/monthly/quarterly/half-yearly/yearly); income actually received: `getIncomeSummary` (`domain/insights/income.js`) |
| Upcoming and recurring obligations, one economic obligation → one event | `composeFutureMoneyCommitments` (dedupe key `sourceType:sourceId`), sources: bill, ccStatement, recurringSchedule (SIP), feePeriod (school fees), membership, insurancePolicy, debt (EMI) |
| Which commitments count in a month, estimates, mandatory-commitment cover, spreads, paid events skipped | `buildReadiness` (`src/domain/budget/readiness.js`), `isMonthlyRhythm`, `isEstimatedOccurrence`, spread plans (`spread.js`) |
| Mandatory commitments, state, discretionary pool, over-allocation refusal | `getMandatoryCommitmentsTotal/State`, `getDiscretionaryPool`, `wouldExceedDiscretionaryPool` |
| Projection and status | `getMonthEndForecast`, `getBudgetHealthStatus`, `getBudgetVariance`, `getExpectedSpendByToday` |
| Verified balances / reserve | `getEffectiveBalance`, `getAvailableCash` (`src/domain/accounts/availableCash.js`), `balanceCheckpoints` |
| Loans | `loans[]` (`direction`, `status`, `outstanding`, `emiAmount`), `autoEmiProgress` |
| Money that is not spend | `monthlyCashFlow.js` "Not counted" list: transfers, card-bill payments (`cc_payment`), investments, EMI instalments, settlements |

### Findings from this audit (not changed)
* **F1 [VERIFIED]** `DEFAULT_CATS` ships with budgets (e.g. Financial 30,000, Housing 15,000), so a stored `cats[].budget` cannot be told apart from a seeded default. The recommendation therefore **never reads `cats[].budget` as an input**; it only displays it beside the recommendation.
* **F2 [VERIFIED]** The app has two month-end forecasts that are knowingly not unified: Budget uses straight-line pace (`getMonthEndForecast`); Outlook uses a 3-month average of variable spend (`averageOfLastNMonthsVariableSpend`). Plan alerts need one method (section 8). Introducing it must not silently change Budget or Outlook numbers.
* **F3 [VERIFIED]** `buildReadiness` counts a card **statement** event against the month's budget (no `budgetAmount` override for `ccStatement`), while the card **purchases** are already counted as category spend when charged. Adding both would double count. The plan treats statements as cash settlement only (section 6). Existing Plan Ahead is left as is.
* **F4 [VERIFIED]** Essentiality today is a category-level boolean (`fixed`), editable per category, nothing finer. Memberships and school fees have no essential/discretionary flag.
* **F5 [UNVERIFIED]** Whether the category editor lets the user change `fixed`; if not, the correction UI must provide it (section 7).

## 2. Data sufficiency (disclosed on every output)
`monthsUsed` = complete past months that contain at least one expense. Tier: **none** (0), **thin** (1–2), **basic** (3–5), **good** (6–11), **seasonal** (≥12). Each recommendation carries its tier and the months it used ("based on 5 months"). Below `basic`, no category is called irregular or seasonal (not enough evidence) and recommendations are labelled *rough*. Seasonality is only ever stated at `seasonal` tier.

## 3. Money lines and the five classes
Every rupee in the plan is a *line* with exactly one class. Class is never derived from amount.

| Class | What goes in | How a line gets it (precedence: user correction, then source rule, then category flag, then default) |
|---|---|---|
| **Essential commitment** | Mandatory Commitments; loan EMIs; insurance premiums; school fee periods; bills in a category flagged essential | user correction → source type (debt, insurance, feePeriod, mandatory commitment) → `cats[].fixed` of the bill's category |
| **Variable essential** | Spending in categories flagged essential (`fixed`) that is not a commitment | user correction → `cats[].fixed` |
| **Goals / investments** | SIPs (`recurringSchedule` events), goal contributions | source type; the reserve is its own class below |
| **Emergency savings** | The reserve contribution | the user's reserve designation (section 9) |
| **Discretionary** | Everything else, including memberships until the user says otherwise | default; memberships are surfaced as "needs your confirmation" |

`classOverrides` (stored with the plan, keyed by category id, source type or event key) is the only way a class changes besides the rules above. A line whose class came from a default shows "classified by default, change?".

## 4. Discovering material categories
Over the last `N ≤ 12` complete months, per category c (my share, `spendOnly` set as in `runway.js`, commitment-linked transactions removed, section 6):
* `series[c]`: monthly variable spend. `mean`, `median`, `activeRatio` = months with spend > 0 ÷ N, `cv` = stdev ÷ mean, `share` = mean ÷ Σ means.
* **Material** if `share ≥ 5%` **or** the category is in the smallest set covering 80% of variable spend **or** it has any commitment line. Everything else is pooled into one "Everything else" line. (5% and 80% are named constants shown in the explanation; they affect *which categories get their own line*, never what is essential.)
* **Irregular** if `activeRatio < 0.75` **or** `cv > 1.0` (only at `basic` tier or better). Irregular categories are never given a monthly run-rate based on the median (it hides the spikes); their recommendation is the **mean** over the months available, labelled "irregular: average of N months, range min–max".
* **Seasonal** (only at `seasonal` tier): a calendar month whose value exceeds `2 × median` in each of the last two years; the recommendation for that month uses the same month last year instead of the median.
* **Upcoming obligations** (next 3 months of Future Money events beyond month M) are a *heads-up* with an existing one-tap "Spread over months" (`spread.js`); they do not silently accrue into this month's allocation.

## 5. The recommendation (deterministic waterfall)
Let `I` = plan income. `I = min(expectedMonthly, avgReceived3m)` when both exist, else the one that exists, else *unknown* (section 10); both figures are shown.
For month M, build lines (each exactly once, section 6), then allocate in this priority order. Lower tiers receive only what is left:
1. **Essential commitments** `E1`: exact amounts from `buildReadiness` for M (estimates flagged), mandatory-commitment cover applied (larger of commitment or covered bills).
2. **Variable essentials** `E2`: per category, `baseline = median` of variable spend (mean if irregular).
3. **Committed goals** `G`: SIPs/goal contributions already scheduled. Honoured, not reduced by the plan; if unaffordable after 1–2, flagged (never auto-paused).
4. **Emergency reserve** `R`: only from true surplus (section 9).
5. **Discretionary** `D`: per category `baseline`, capped by what remains, scaled pro rata *within this tier only*.

`observedTotal = E1+E2+G+D_baseline`. Outputs per line: `observed`, `recommended`, `affordable` and a `status`. **If `observedTotal > I` the plan says so** ("your recent spending is ₹X more than your income") and shows the shortfall; essentials are never scaled down silently, committed goals are flagged, discretionary absorbs the reduction and the gap is shown as a number the user can act on. No line is ever recommended above its observed baseline unless the user raises it. Surplus (`I − observedTotal > 0`) is shown as **Unassigned**, not spent.

## 6. Double-counting safeguards (each one a test)
| Pair that must never both count | Rule |
|---|---|
| Bill event vs the transaction that paid it | A bill/commitment payment (`bill.paidByTxnId`, item-level `contributions` with `txnId`) is removed from the variable series; the bill is counted once as a commitment line. Paid events are not projected again (`readiness`: paid events never count) |
| Mandatory commitment vs bills in its category | Larger-of, not sum (`readiness`, `runway`) |
| Card purchase vs card statement vs card-bill payment | Purchases count at charge (expenses). `ccStatement` events and `cc_payment` transactions are **cash settlement only** and are excluded from category allocation (F3) |
| Loan EMI vs EMI-linked transactions | EMI counted once from `loans`/`debt` events; transactions with `linkedLoanId`, `isAutoEmiInstallment`, `cc_emi` are removed from variable series (same predicate as `runway.js`) |
| SIP event vs investment transaction | SIP is a `committedSaving` event; `type:"investment"` transactions are not expenses, never in category series |
| School fee / membership / insurance event vs its payment | Same as bills: event until paid, payment transaction excluded from the variable series |
| Spread plan vs original payment | Budget share per month from `spreadInMonth`; cash unchanged (`readiness`) |
| Refunds, split-with-others, `excludeFromSpend` | Netted by `getCategoryAttributedTotal` |
| Transfers, settlements, loan given | Not spend (monthlyCashFlow "Not counted") |
| Same event twice | `composeFutureMoneyCommitments` dedupe key; the engine asserts no `sourceType:sourceId` appears in two lines |
**Invariants checked in tests:** Σ category actuals + Uncategorised = household attributed total (ADR-036 invariant 4, reused); no event key appears twice; Σ lines never exceeds observed + commitments; the reserve is never counted inside spendable cash twice (decision D4 of BUD-004).

## 7. Separation from budgets; correcting the plan
* The plan lives in one new synced object `moneyPlan` with: `classOverrides`, `excludedMonths` (a one-off month the user marks as not typical, per category), `reserve` (target, designated account/goal), `acceptedAllocations` (amounts the user chose to keep), `updatedAt`. **Recommendations, observed figures and alerts are never stored** (recomputed), so they cannot go stale.
* It **never writes** `cats[].budget`, `annualBudget`, `monthOverrides`, `mandatoryCommitments`, or any transaction. A "use this recommendation as my budget" action is a separate, later, explicit feature.
* Users can: reclassify a line (adds a `classOverride`), mark a month as not typical, mark a category irregular/regular, change the reserve target, edit an allocation (amount or %; refused when it would exceed income, using the `wouldExceedDiscretionaryPool` pattern: the typed value stays on screen with the overage).

## 8. Explanations, projection and alerts
**Explanation** (every line): class and why; data used (months, median or mean, range); commitments included; rule id; confidence tier; the one-tap corrections. Example:
> *Food & Dining — recommended ₹6,350.* Discretionary (default for this category; change?). Median of your last 6 months (₹5,400 to ₹9,100); regular spend. Affordable within your income.

**Projection (one function, used by Budget, Insights, Outlook and Cash Flow):** `projectedMonthEnd(c) = spentToDate(c) + unpaidCommitmentsRemaining(c) + variableRemainder(c)`. `variableRemainder` = pace of variable spend so far × days left once `daysElapsed ≥ 7`; before day 7 it uses the baseline × days-left ÷ days-in-month (too little data for pace). Status uses `getBudgetHealthStatus` (over / close < 10% / on track). This is a **third** method next to F2's two; the decision is whether it replaces them (changing existing numbers, own release) or only drives plan alerts. **[DECISION]**
**Alerts:** at most one per category per month (id `plan_<catId>_<monthKey>_over` in the existing `dismissedAlerts`), at most 3 shown per month ranked by projected overage, same text everywhere. Example (day 12 of 30, ₹4,100 spent, plan ₹6,350): *"Food & Dining is on pace for ₹10,250 (₹3,900 over plan, +61%). Spent so far ₹4,100 in 12 days. Rule: pace of the last 12 days. Options: cut to ₹X/day, raise the allocation, or mark this month as not typical."*

## 9. Emergency fund (target-based, verified)
* **Target** is the user's own number. Until set, no contribution is recommended; Arth *suggests* `months × essential monthly outflow` (`getEssentialMonthlyOutflow().total`) with the multiplier shown and editable (the brief's ₹2,00,000 is an example, not a default). When the suggested figure moves by more than 20% from the target, offer to revise it.
* **Verified reserve** = effective balance (checkpoint-aware) of the designated account(s)/goal-linked account. No checkpoint, or stale: shown as *unverified*; progress is labelled so. A planned contribution is never added to it.
* **Contribution** = `min(target − verified, surplus)` where `surplus = max(0, I − observedTotal)`, only while `verified < target`. Reaching the target sets contribution to 0 and shows "target reached". If surplus is 0 the output is 0 with the reason and the largest discretionary categories above their median.
* **Withdrawal:** verified balance below the last verified snapshot, or a debit from the reserve account after it → `replenishmentGap = target − verified`, a recommendation at the same affordability rule. **No transfer is made.**
* Whether the reserve account is excluded from Available Cash/Buffer is a separate approved release (BUD-004 D4).

## 10. Fallbacks
| Situation | Behaviour |
|---|---|
| **New user, no history** (`none`) | No category allocations, no percentages. Shows exact commitments, income (asked for if unknown), and one "Everything else" line = `I − commitments`. Offers a short guided setup: confirm income, mark essentials, set a reserve target |
| **Thin / incomplete history** (`thin`, `basic`) | Uses the months available, labels "based on N months", no irregular/seasonal claims below `basic`, shows ranges not single numbers |
| **Irregular expenses** | Mean over available months, labelled irregular with range; large one-offs can be marked "not typical" |
| **Income unknown** | Allocations shown as observed amounts only; no affordability statement; prompts for income |
| **Insufficient income** | Section 5 shortfall display; reserve contribution 0; flags `insufficient-income` |
| **Uncategorised spend** | Own line "Uncategorised" (as Cash Flow does), never allocated |
| **No expected income but received income exists** | Uses the received average and says so |

## 11. Worked examples (arithmetic checked by a throw-away script outside the repo; synthetic data)
**Shared inputs.** Reserve target ₹1,50,000, verified ₹40,000. This month's commitments: Rent ₹18,000 (mandatory commitment covering the rent bill), Car loan EMI ₹6,500, utilities bills ₹3,000 (estimate), SIP ₹5,000, gym membership ₹1,500 (estimate). Six complete months of variable spend (my share, commitment payments already removed):
| Category | 6 months | median | mean | CV | active | Class / note |
|---|---|---|---|---|---|---|
| Groceries | 9800 10200 9500 10400 9900 10100 | 10,000 | 9,983 | 0.03 | 100% | variable essential (flag `fixed`) |
| Fuel | 3800 4100 3600 4400 3900 4000 | 3,950 | 3,967 | 0.06 | 100% | variable essential **by user correction** (category default was discretionary) |
| Food & Dining | 6200 7800 5400 9100 6000 6500 | 6,350 | 6,833 | 0.18 | 100% | discretionary |
| Shopping | 2000 0 14000 1500 0 3000 | 1,750 | 3,417 | 1.42 | 67% | irregular → mean |
| Health | 800 0 4500 0 600 0 | 300 | 983 | 1.63 | 50% | essential, irregular → mean |

**A. Income ₹60,000 (expected = received).** E1 = 18,000 + 6,500 + 3,000 = **27,500**. E2 = 10,000 + 3,950 + 983 = **14,933**. G (SIP) = **5,000**. D = Food 6,350 + Shopping 3,417 + Gym 1,500 = **11,267**. `observedTotal` = **58,700**; surplus = **1,300**. Reserve: gap 1,10,000, contribution `min(1,10,000, 1,300)` = **₹1,300**, "about 85 months at this pace; to go faster see: Food & Dining above its median in 3 of 6 months". Confidence: good (6 months). Nothing written to budgets.
**B. Income ₹45,000** (same history). After E1 + E2 = 42,433, remaining 2,567. SIP ₹5,000 is committed but only ₹2,567 is affordable: **flag, short ₹2,433** (not changed automatically). Discretionary affordable ₹0; reserve ₹0. Message: *"Your recent spending is ₹13,700 more than your income. Essentials are covered. Your SIP and discretionary spending are not fully affordable."*
**C. New user** (no history, income ₹40,000, rent commitment ₹12,000, SIP ₹3,000). Committed ₹15,000; **Everything else ₹25,000**; no categories, no percentages; reserve: "set a target"; confidence: none.
**D. Withdrawal.** Verified reserve ₹40,000 → ₹25,000 after a ₹15,000 debit on 12 Nov (txn id shown). `replenishmentGap` = 1,50,000 − 25,000 = **₹1,25,000**; recommended contribution unchanged by the affordability rule (₹1,300 in A, ₹0 in B). Recommendation only.
**E. Alert** as in section 8 (₹10,250 projected vs ₹6,350 plan).

## 12. Tests required before any UI (property-style, on fixtures like the above)
Reference sums (A–D exact); the invariants of section 6; fallbacks by tier; irregular vs regular classification at the stated thresholds; override precedence; "no line recommended above observed unless raised"; over-allocation refusal; reserve cases (below target, at target, withdrawal, unverified); the engine writes nothing and reads `cats[].budget` nowhere.

## 13. Decisions for review
1. **Third forecast:** plan alerts use the section 8 projection; keep Budget/Outlook as they are (recommended) or unify later in a separate approved release?
2. **Waterfall order:** committed SIPs before the reserve and discretionary (as above), or reserve before extra goals?
3. **Plan income** rule `min(expected, received 3m)` and the "both shown" display.
4. **Constants** (5% / 80% materiality, 0.75 / 1.0 irregularity, 7-day pace start, 20% target revision, max 3 alerts): confirm or change; each is a named constant shown in the explanation.
5. **Memberships and school fees** default classes (discretionary / essential commitment) and whether the user is asked once.
6. **Existing decisions** from BUD-004: income basis, reserve account in Available Cash, bucket mapping (now replaced by discovered categories; the mapping question disappears).

## 14. Revised increments (each releasable, none touches existing budgets)
1. Engine: data sufficiency, classification, discovery, waterfall, double-count guards, explanations, fallbacks; tests on the fixtures above. No UI, no storage.
2. Reserve verification and replenishment (pure).
3. `moneyPlan` persistence + sync (class overrides, excluded months, reserve designation) and the read-only plan inside the Budget tab (needs the approved design).
4. Edit/correct flows and the emergency-fund card.
5. Projection + alerts wired through one shared function (decision 1 above).
