# BUD-005 — Monthly Money Plan: data-driven calculation specification (revision 2; review draft, no code)

Supersedes BUD-004 sections 3 and 4 (fixed buckets, salary slabs, percentage templates). BUD-004 sections 1, 2 and 8 still apply, except that the bucket-to-category mapping screen is **replaced by a correction screen** (section 8). **Nothing here is implemented.** The ₹30,000 / 25-10-15-15-35 scenario from the brief is a mock-up fixture only, never a shipped default.

Labels: **[VERIFIED]** read in the code; **[UNVERIFIED]** not confirmed; **[DECISION]** still needs an owner answer.

## Decisions incorporated in this revision (owner, 24 Oct 2026)
| # | Decision | Where |
|---|---|---|
| 1 | Plan alerts use their **own projection** for this release. Budget and Outlook forecasts are untouched; the difference is disclosed in the alert. Unifying forecasts is a **separate release** | §9, §15 |
| 2 | Existing committed SIPs are separate from additional goals, counted once, never paused. Order: essential commitments → variable essentials → existing SIPs → emergency reserve (where affordable) → additional goals → discretionary. Shortfalls flagged | §6 |
| 3 | Show expected and received income with sources and difference. Conservative, evidence-based planning basis. Irregular / insufficient / materially different income → **ask for confirmation**, never silently pick the lower. Expected income is not available cash | §5 |
| 4 | Thresholds are documented, testable **starting defaults**. Important commitments and critical overspend warnings are never hidden by materiality or the alert cap. Each constant explained and boundary-tested | §4, §9, §13, §14 |
| 5 | Memberships and school fees: suggest a class only with stated evidence, ask when uncertain, allow later correction, never classify by amount or name | §3 |

## 0. Principle
A user's plan is *discovered*: which categories matter, what is committed, what is essential and what can flex all come from that user's own Arth data and corrections. No preset buckets or percentages for categories. Every number is shown with the data and rule behind it; every classification can be corrected. Nothing is written to existing budgets or transactions.

## 1. Inputs and the existing helpers that own each rule
| Need | Existing owner (reuse, do not re-derive) |
|---|---|
| My share of a category's spend (refunds netted, shares owed back excluded, multi-category lines) | `getCategoryAttributedTotal`, `buildRefundTotalsByExpense`, `getHouseholdAttributedTotal` (`domain/allocations/adapter.js`) |
| Essential spend average with EMIs removed and card purchases counted once; the app's existing essential flag `cats[].fixed` | `getEssentialMonthlyOutflow` (`domain/cashflow/runway.js`) [VERIFIED]: last N complete months, excludes `linkedLoanId`, `isLoanDisbursal`, `isAutoEmiInstallment`, `cc_emi`; larger of observed vs Mandatory Commitments |
| Income as a monthly figure; income actually received | `toMonthlyAmount` (`runway.js`); `getIncomeSummary` (`domain/insights/income.js`); `expectedIncome[]` |
| Upcoming/recurring obligations, one obligation → one event | `composeFutureMoneyCommitments` (key `sourceType:sourceId`); sources bill, ccStatement, recurringSchedule (SIP), feePeriod, membership, insurancePolicy, debt (EMI) |
| What counts in a month, estimates, commitment cover, spreads, paid events skipped | `buildReadiness` (`src/domain/budget/readiness.js`), `isMonthlyRhythm`, `isEstimatedOccurrence`, `spread.js` |
| Mandatory commitments, discretionary pool, over-allocation refusal | `getMandatoryCommitmentsTotal/State`, `getDiscretionaryPool`, `wouldExceedDiscretionaryPool` |
| Status wording / thresholds | `getBudgetHealthStatus` (over, close < 10%, on track), `getBudgetVariance`, `getExpectedSpendByToday` |
| Cash and verified balances | `getEffectiveBalance`, `getAvailableCash` (`src/domain/accounts/availableCash.js`), `balanceCheckpoints` |
| Loans | `loans[]` (`direction`, `status`, `outstanding`, `emiAmount`) |
| Money that is not spend | `monthlyCashFlow.js` "Not counted": transfers, `cc_payment`, investments, EMI instalments, settlements |

### Findings from the audit (none changed)
* **F1 [VERIFIED]** `DEFAULT_CATS` ships with budgets (Financial 30,000, Housing 15,000…), so a stored `cats[].budget` cannot be told from a seeded default. The plan **never reads `cats[].budget` as an input**; it only displays it beside a recommendation.
* **F2 [VERIFIED]** Budget forecasts by straight-line pace (`getMonthEndForecast`); Outlook by a 3-month average of variable spend (`averageOfLastNMonthsVariableSpend`); they are knowingly not unified. This release adds a **third** projection used only by plan alerts (§9). It does not change either existing one.
* **F3 [VERIFIED]** `buildReadiness` counts a card **statement** against the month's budget (no `budgetAmount` override for `ccStatement`) while card **purchases** already count as category spend. The plan treats statements as cash settlement only (§7). Plan Ahead is left as is.
* **F4 [VERIFIED]** Essentiality today is one category-level boolean (`fixed`). Memberships and school fees have no flag. A custom category may have `fixed` undefined (treated as *unknown*, §3).
* **F5 [UNVERIFIED]** Whether the category editor lets the user change `fixed`; if not, the correction screen supplies it.

## 2. Data sufficiency (disclosed on every output)
`monthsUsed` = complete past months with at least one expense. Tier: **none** (0), **thin** (1–2), **basic** (3–5), **good** (6–11), **seasonal** (≥12). Every recommendation shows its tier and months ("based on 5 months"). Below `basic`, no category is called irregular or seasonal, and amounts are labelled *rough* and shown as ranges.

## 3. Classes and who decides
Classes: **Essential commitment**, **Variable essential**, **Committed SIP** (existing recurring schedules), **Emergency reserve**, **Additional goal**, **Discretionary**; plus a holding state **Unconfirmed commitment**.

Class is never derived from amount or from a name. Precedence: **user correction** → **source rule** → **category flag** → **ask**.
| Line | Certain (no question) | Uncertain (suggest only with evidence, else ask) |
|---|---|---|
| Mandatory commitment, loan EMI, insurance premium | essential commitment (source rule; correctable) | none |
| Bill, spend in a category | essential if `fixed === true`, discretionary if `fixed === false` (category flag; correctable) | `fixed` undefined → ask |
| Existing SIP (`recurringSchedule`) | committed SIP | none |
| **School fee** (`feePeriod`) | none | **Suggest** "essential commitment" only when the fee is linked to a school/student record (evidence shown: "linked to <school> fee schedule"); otherwise ask. Never by amount or the word "school" |
| **Membership** | none | **Suggest** "essential" only when its category has `fixed === true` (evidence: your own category setting); otherwise ask with no suggestion. Never by amount or name |
**Unconfirmed commitment:** an uncertain line that is due is *counted* (it is real money due, shown in its own "Confirm these" list) as a protected, non-scalable line in tier 3b of the waterfall. It is never counted as discretionary or essential until the user confirms. Confirming moves it to its class; any class can be corrected later (stored as `classOverrides`).

## 4. Discovering material categories
Over the last `N ≤ 12` complete months, per category (my share, `spendOnly` set as in `runway.js`, commitment-linked transactions removed, §7): `mean`, `median`, `activeRatio` (months with spend ÷ N), `cv` (stdev ÷ mean), `share` (mean ÷ Σ means).
* **Material** (gets its own line) if `share ≥ MATERIAL_SHARE (5%)` or it is in the smallest set covering `MATERIAL_COVER (80%)` of variable spend **or it has any commitment line**. Everything else is pooled into one "Everything else" line that **still receives projection and alerts**. Materiality only decides *which variable categories get their own line*; it never hides a commitment, an essential line or an alert.
* **Irregular** (basic tier or better) if `activeRatio < ACTIVE_MIN (0.75)` or `cv > CV_IRREGULAR (1.0)`. Irregular categories use the **mean** over available months (the median would hide spikes), shown with range.
* **Seasonal** (seasonal tier only): a calendar month above `2 × median` in each of the last two years uses the same month last year.
* **Upcoming obligations** (next 3 months of events) are a heads-up with the existing "Spread over months"; they do not silently accrue into this month.

## 5. Planning income (conservative, evidence-based, confirmed when unsure)
Show **both**, each with its sources and the difference:
* **Expected**: Σ `toMonthlyAmount` of active `expectedIncome` items, listed by name and amount.
* **Received**: average of the last up to 6 complete months of `type:"income"` transactions, listed by source, with `monthsUsed` and `cv`. Received months give evidence; expected is a promise.

**Confirmation rule** (`needs-confirmation` if any): received months `< INCOME_MIN_MONTHS (3)`; received `cv > INCOME_CV (0.20)`; only one of expected/received exists; or `|expected − received| ÷ max(expected, received) > INCOME_DIFF (10%)`. Then the engine **does not choose**: it shows both figures, computes tiers 1–3b (exact commitments, which need no income) and, for each figure, the free money that would result; it makes **no reserve, goal or discretionary recommendation** until the user confirms (choose expected, choose received, or type an amount). The confirmation is stored (`income.confirmed = {amount, basis, confirmedAt}`) and is re-asked when the received average later differs from it by more than `INCOME_DIFF`.
**No confirmation needed** (consistent, ≥3 months, regular): the planning basis is the **lower** of the two, shown openly ("Using ₹X, the lower of expected ₹E and received ₹R; they agree within 10%").
**Expected income is not available cash.** Affordability uses the planning income as a monthly basis only. Whether cash is there to pay things comes from `getAvailableCash` and the Outlook buffer; an `expectedIncome` item not yet received is never counted as cash, and the plan says so on screen.

## 6. The waterfall (deterministic, in this order)
Let `I` = confirmed/consistent planning income (§5). Tiers, each paid only from what remains:
1. **Essential commitments** `E1`: exact amounts for month M from `buildReadiness` (estimates flagged), commitment cover applied (larger of commitment or covered bills).
2. **Variable essentials** `E2`: per category `baseline` = median (mean if irregular).
3. **Existing SIPs** `G1`: every scheduled SIP counted **once**, in full, **never paused or reduced by the plan**.
3b. **Unconfirmed commitments** `U`: counted in full until confirmed (§3).
   `committed = E1 + E2 + G1 + U`; **free money** `F = I − committed`.
4. **Emergency reserve** `R = min(gap, floor(max(F,0) × RESERVE_SHARE))`, only while `verified < target`, target set, income usable. `RESERVE_SHARE` (starting default 50%, per-user editable) is the share of free money offered to the reserve first. Alongside `R` the plan shows the **no-cut pace** `max(0, I − observedTotal)` (what could go to the reserve without reducing any category below its history), so the cost of the priority is visible.
5. **Additional goals** `G2` (goals other than existing SIPs): each goal's request = the monthly amount the user set for it, else `(target − current) ÷ months to its target date` when it has a date, else **0** (no invented request). Funded in order of earliest target date, each limited by what remains.
6. **Discretionary** from what remains: first the *confirmed-discretionary commitment lines* (e.g. a confirmed membership), at their due amount, never scaled down by the plan; then the flexible categories, scaled **pro rata to their baselines**. Amounts are floored to whole rupees per line and the remaining rupees go to the largest fractional remainders (ties: larger baseline), so a tier always sums exactly.

**Shortfalls.** `short = max(0, −F)`. Lowest priorities absorb a shortfall first, but **committed lines are not cut or paused by the plan**: each line shows `affordable` and `short`, in this order of reporting: SIP `G1` short, then `U`, then protected discretionary commitments. Essentials are never scaled. When `observedTotal > I` the plan also states "your recent spending is ₹X more than your income". No line is recommended above its baseline unless the user raises it. If `F > 0` and all tiers are funded, the remainder is **Unassigned**, not spent.

## 7. Double-counting safeguards (each one is a test)
| Pair that must never both count | Rule |
|---|---|
| Bill event vs the transaction that paid it | Payment (`bill.paidByTxnId`, item-level `contributions.txnId`) removed from the variable series; bill counted once as a commitment; paid events never re-projected |
| Mandatory commitment vs bills in its category | Larger-of, not sum |
| Card purchase vs card statement vs `cc_payment` | Purchases count at charge. `ccStatement` events and `cc_payment` are **cash settlement only**, excluded from category allocation (F3) |
| Loan EMI vs EMI-linked transactions | EMI counted once from `loans`/`debt`; `linkedLoanId`, `isAutoEmiInstallment`, `cc_emi` removed from the variable series |
| SIP event vs `type:"investment"` transaction | SIP is a `committedSaving` event, counted once in `G1`; investment transactions are not expenses and never in category series |
| School fee / membership / insurance event vs its payment | Event until paid; payment excluded from the variable series |
| Spread plan vs original payment | Budget share per month from `spreadInMonth`; cash unchanged |
| Refunds, shares owed back, `excludeFromSpend` | Netted by `getCategoryAttributedTotal` |
| Transfers, settlements, loans given | Not spend |
| Same event twice | `composeFutureMoneyCommitments` dedupe; engine asserts no `sourceType:sourceId` in two lines |
**Invariants:** Σ category actuals + Uncategorised = household attributed total (ADR-036 invariant 4); no event key twice; Σ funded lines = `I` exactly when `F ≥ 0` (§12 shows it); the reserve balance is never also counted in spendable cash.

## 8. Separation from budgets; the correction screen
* The plan is one new synced object `moneyPlan` holding only choices: `classOverrides`, `atypicalMonths` (per category or whole plan, "this month is not typical"), `income.confirmed`, `reserve` (target, designated account/goal, `share`), `goalPlans[goalId].monthly`, `updatedAt`. **Recommendations, observed figures and alerts are never stored.**
* It **never writes** `cats[].budget`, `annualBudget`, `monthOverrides`, `mandatoryCommitments`, SIPs, goals or any transaction. "Use this as my budget" is a later, separate, explicit feature.
* **Correction screen (replaces bucket mapping), for the designer:** (1) "Confirm these" list of uncertain lines with the evidence and a neutral question; (2) reclassify any line (choose a class; shows the effect on the totals immediately); (3) mark a month atypical (excluded from baselines, restorable); (4) mark a category regular/irregular; (5) confirm planning income; (6) set the reserve target/share. Over-allocation is refused with the typed value kept on screen and the overage shown (`wouldExceedDiscretionaryPool` pattern).

## 9. Explanations, projection and alerts
**Explanation** on every line: class and who decided (you / source rule / category flag), data used (months, median or mean, range), commitments included, rule id, confidence tier, one-tap corrections.
**Projection (plan alerts only):** `projectedMonthEnd(c) = spentToDate(c) + unpaidCommitmentsRemaining(c) + variableRemainder(c)`; `variableRemainder` = pace of variable spend so far × days left once `daysElapsed ≥ PACE_FROM_DAY (7)`, else baseline × days left ÷ days in month. **Disclosure shown in every alert and in the explanation:** *"Budget forecasts the whole month by pace so far and Outlook uses a 3-month average, so their figures can differ from this one. This alert uses the pace of this category's variable spending."* Budget and Outlook numbers are unchanged; unifying the methods is a separate release.
**Two alert levels, one component, one wording everywhere (Budget, Insights, Outlook, Cash Flow):**
* **Critical, never capped or hidden:** (a) a committed line cannot be afforded (`short > 0`: SIP, unconfirmed, protected); (b) a variable-essential or commitment category is projected over its recommendation; (c) any category projected over by `CRITICAL_OVER (25%)` or more; (d) the plan's projected total exceeds planning income. Critical alerts ignore materiality and the cap.
* **Advisory:** other categories projected over (`getBudgetHealthStatus` over / close). At most `ALERT_CAP (3)` shown, ranked by projected overage; the rest are in the list view. One alert per category per month (id `plan_<catId>_<monthKey>_<level>` in existing `dismissedAlerts`); dismissing an advisory never dismisses a critical one.

## 10. Emergency fund (target-based, verified, no automatic movement)
* **Target** is the user's number. Until set, no contribution is recommended; Arth *suggests* `months × essential monthly outflow` (`getEssentialMonthlyOutflow().total`), multiplier shown and editable (the brief's ₹2,00,000 is an example, not a default). When the suggestion moves more than `TARGET_REVISE (20%)` from the target, offer to revise.
* **Verified reserve** = effective balance (checkpoint-aware) of the designated account(s). No checkpoint, or stale: *unverified* and progress is labelled so. A planned contribution is never added to it.
* **Contribution** is tier 4 of §6 (`R`), only while `verified < target`, and 0 once reached ("target reached"). If `F ≤ 0` it is 0 with the reason.
* **Withdrawal:** verified balance below the last verified snapshot, or a debit from the reserve account since → `replenishmentGap = target − verified`, a recommendation under the same tier-4 rule. **No transfer is made.**
* Excluding the reserve account from Available Cash/Buffer stays a separate approved release.

## 11. Fallbacks
| Situation | Behaviour |
|---|---|
| New user, no history | No category allocations or percentages. Exact commitments, income (asked for), one "Everything else" line = `I − committed`; short guided setup: confirm income, answer the "Confirm these" questions, set a reserve target |
| Thin/incomplete history | Months available, "based on N months", ranges, no irregular/seasonal claims below basic |
| Irregular expenses | Mean with range; one-offs can be marked atypical |
| Income needs confirmation / unknown | §5: both figures shown, tiers 1–3b only, no income-dependent recommendation |
| Insufficient income | §6 shortfall display; reserve 0; critical alert (a) |
| Uncategorised spend | Own line "Uncategorised", never allocated |

## 12. Worked examples (arithmetic checked by a throw-away script outside the repo; synthetic data)
**Shared inputs.** Reserve target ₹1,50,000, verified ₹40,000 (gap ₹1,10,000), `RESERVE_SHARE` 50%. This month: Rent ₹18,000 (mandatory commitment covering the rent bill), Car loan EMI ₹6,500, utilities bills ₹3,000 (estimate), SIP ₹5,000, gym membership ₹1,500 (estimate; the user has **confirmed it as discretionary**). Six complete months of variable spend (my share, commitment payments removed):
| Category | 6 months | median | mean | CV | active | Class / note |
|---|---|---|---|---|---|---|
| Groceries | 9800 10200 9500 10400 9900 10100 | 10,000 | 9,983 | 0.03 | 100% | variable essential (`fixed`) |
| Fuel | 3800 4100 3600 4400 3900 4000 | 3,950 | 3,967 | 0.06 | 100% | variable essential **by user correction** |
| Food & Dining | 6200 7800 5400 9100 6000 6500 | 6,350 | 6,833 | 0.18 | 100% | discretionary |
| Shopping | 2000 0 14000 1500 0 3000 | 1,750 | 3,417 | 1.42 | 67% | irregular → mean |
| Health | 800 0 4500 0 600 0 | 300 | 983 | 1.63 | 50% | essential, irregular → mean |
Observed total = E1 27,500 + E2 14,933 + SIP 5,000 + discretionary 11,267 (Food 6,350 + Shopping 3,417 + Gym 1,500) = **58,700**.

**A. Income ₹60,000 (expected = received; consistent, 3+ months → basis 60,000).**
`E1` 18,000 + 6,500 + 3,000 = **27,500**; `E2` 10,000 + 3,950 + 983 = **14,933**; `G1` **5,000**; `U` 0 → `committed` **47,433**, **F = 12,567**.
`R` = min(1,10,000, floor(12,567 × 50%) = **6,283**) → **₹6,283**; remaining 6,284; `G2` none → 6,284.
Discretionary: Gym **1,500** (protected) → flexible pool **4,784** over Food 6,350 + Shopping 3,417 = 9,767 → Food **3,110**, Shopping **1,674** (floors 3,110 + 1,673, the extra rupee to the larger fraction).
Check: 27,500 + 14,933 + 5,000 + 6,283 + 1,500 + 3,110 + 1,674 = **60,000** ✓. Unassigned 0.
Visible cost of the priority: Food and Shopping are **₹3,240 and ₹1,743 below history** (flag `reduced-for-reserve`). **No-cut pace** (I − observed) = **₹1,300** → at ₹6,283/month the target is ~18 months away; at ₹1,300 ~85. The user can lower the reserve share or accept.
**A2. Same, plus an additional goal "Trip fund" requesting ₹2,000/month.** After `R` 6,284 → `G2` funded **2,000** → 4,284 → Gym 1,500 → flexible pool **2,784**: Food **1,810**, Shopping **974**. Check: 47,433 + 6,283 + 2,000 + 1,500 + 1,810 + 974 = **60,000** ✓.
**A3. Same as A but the gym membership is not yet confirmed.** `U` = 1,500 in tier 3b: `committed` 48,933, F = 11,067, `R` = floor(5,533.5) = **5,533**, remaining 5,534 → Food **3,598**, Shopping **1,936** (no protected line). Check: 48,933 + 5,533 + 3,598 + 1,936 = **60,000** ✓. The "Confirm these" list asks about the gym; it is neither essential nor discretionary until answered.
**B. Income ₹45,000 (same history, consistent).** `E1` + `E2` = 42,433; SIP 5,000 → `committed` 47,433 → **F = −2,433, short ₹2,433**. SIP: affordable ₹2,567, **short ₹2,433, not paused**; `R` 0; `G2` 0; discretionary pool 0: Gym (protected) **short ₹1,500**; Food 0, Shopping 0. Total committed-line shortfall **₹3,933** (2,433 + 1,500). Also: observed 58,700 − 45,000 = **₹13,700 above income**. Critical alert (a) fires. Essentials covered; nothing is scaled or paused.
**C. New user** (no history; the user enters and confirms an income of ₹40,000, so there is nothing to compare it with; rent commitment ₹12,000, SIP ₹3,000). `committed` 15,000, **Everything else ₹25,000**, no categories, no percentages; reserve: "set a target"; confidence: none.
**D. Withdrawal.** Verified ₹40,000 → ₹25,000 after a ₹15,000 debit on 12 Nov (txn shown). `replenishmentGap` = 1,50,000 − 25,000 = **₹1,25,000**; recommendation `R` unchanged by the tier-4 rule (₹6,283 in A, ₹0 in B). Recommendation only.
**E. Alerts (day 12 of 30).** *Critical:* Groceries (variable essential) plan 10,000, ₹5,200 spent → pace 5,200 ÷ 12 × 30 = **13,000**, over by 3,000 (**+30%**), shown regardless of the cap, with the method disclosure. *Advisory cap:* if five other categories are projected over, the three with the largest overage are shown, the rest listed; the critical alert is shown in addition (4 visible), never replacing one.
**F. Income needs confirmation.** Expected ₹60,000 (Salary). Received last 3 months ₹50,000, ₹52,000, ₹54,000, average **₹52,000**, `cv` 0.031 (regular), difference (60,000 − 52,000) ÷ 60,000 = **13.3% > 10%** → `needs-confirmation`. Shown: both figures with sources. Free money (before reserve) under each: at ₹60,000 = 60,000 − 47,433 = **12,567**; at ₹52,000 = **4,567** (the sample's 1,500 gym excluded here since confirmed-discretionary belongs to tier 6). No reserve, goal or discretionary amount until the user confirms. If they confirm ₹52,000, the plan recomputes A with `I` = 52,000 (`R` = floor(4,567 × 50%) = 2,283). Expected income is not counted as cash anywhere.

## 13. Constants (starting defaults, not universal truths)
Each is a named constant in one place, shown in the relevant explanation, and covered by boundary tests (both sides of the value).
| Constant | Default | Why this starting point | Effect when changed |
|---|---|---|---|
| `MATERIAL_SHARE` / `MATERIAL_COVER` | 5% / 80% | Keeps the list readable; small categories pooled, never hidden from alerts or commitments | Which variable categories get their own line |
| `ACTIVE_MIN` / `CV_IRREGULAR` | 0.75 / 1.0 | Spend in fewer than ¾ of months, or spread wider than the average itself, is not a monthly run-rate | Median vs mean baseline |
| `PACE_FROM_DAY` | 7 | Pace from fewer than 7 days is mostly noise | Alert timing early in the month |
| `INCOME_MIN_MONTHS` / `INCOME_CV` / `INCOME_DIFF` | 3 / 0.20 / 10% | Three months shows a pattern; a 20% swing or 10% gap means "ask" | When confirmation is required |
| `RESERVE_SHARE` | 50% | Gives the reserve priority while leaving some free money for goals and everyday spending; per-user editable | Reserve contribution vs discretionary room |
| `TARGET_REVISE` | 20% | Prompt to revisit the target when essential costs shift | When to offer a new suggestion |
| `CRITICAL_OVER` / `ALERT_CAP` | 25% / 3 | Over ¼ is serious regardless of class; three advisories avoid alert fatigue; critical alerts bypass the cap | Which alerts are critical / how many advisories show |

## 14. Tests required before any UI (fixtures A, A2, A3, B, C, D, E, F)
* **Arithmetic:** each example above exactly (tier amounts, floors, largest-remainder, Σ = `I`, shortfall decomposition 2,433 + 1,500 = 3,933, no-cut pace 1,300).
* **Waterfall order and shortfall:** SIPs counted once, never reduced; essentials never scaled; protected lines reported short, not cut; `F = 0`, `F < 0`, `F > 0` with every tier funded (Unassigned).
* **Income:** consistent → lower figure shown openly; `needs-confirmation` on each trigger separately; boundary: 2 vs 3 months, `cv` 0.20 vs 0.21, difference 10.0% vs 10.1%; expected income never in cash; confirmation persists and re-asks at > 10% drift.
* **Classification:** override precedence; school fee suggested only with a linked school record, never by amount or name; membership suggested only when its category `fixed === true`; undefined `fixed` → ask; unconfirmed lines counted in tier 3b and never discretionary.
* **Thresholds, both sides:** share 4.99% vs 5%; cumulative cover 79.9% vs 80%; activeRatio 0.74 vs 0.75; cv 1.0 (regular) vs 1.01 (irregular); day 6 vs day 7; target change 19.9% vs 20%; overspend 24.9% vs 25%; 3 vs 4 advisories.
* **Alerts:** critical never hidden by materiality or the cap; advisory cap ranks by overage; one alert per category per month; dismissing advisory leaves critical; disclosure text present.
* **Double counting** (§7) each pair; ADR-036 invariant; no event key twice.
* **Isolation:** the engine writes nothing and never reads `cats[].budget`; Budget and Outlook outputs are unchanged on the same fixtures (snapshot test against `getMonthEndForecast` and `averageOfLastNMonthsVariableSpend`).
* **Reserve:** below target, at target, unverified, withdrawal; contribution 0 when `F ≤ 0`.

## 15. Remaining decisions and scope
**[DECISION] for the owner (new from this revision):**
1. `RESERVE_SHARE` 50% as the starting default (example A shows its cost to discretionary; the lean alternative is to fund the reserve only from the no-cut pace).
2. Goal request rule (§6 tier 5: user-set monthly amount, else target-date pace, else 0).
3. `CRITICAL_OVER` 25% and the four critical conditions (§9).
4. Unconfirmed lines as protected tier 3b (§3).
**Out of scope for this release:** unifying Budget/Outlook/plan forecasts; excluding the reserve account from Available Cash; "use as my budget"; any change to existing budgets, SIPs, goals or transactions.

## 16. Increments (each releasable; none touches existing budgets)
1. Engine (pure): sufficiency, classification and confirmations, discovery, income basis, waterfall, double-count guards, explanations, fallbacks, constants; tests above. No UI, storage or sync.
2. Reserve verification and replenishment (pure).
3. `moneyPlan` persistence + sync and the read-only plan in the Budget tab (needs the approved design, now including the correction screen).
4. Correction flows and the emergency-fund card.
5. Plan projection and alerts through one shared function, with the method disclosure.
