# BUD-005 — Monthly Money Plan: data-driven calculation specification (revision 3; review draft, no code)

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
| 6 | **Reserve share 50%** (editable starting default), calculated only after essential commitments, variable essentials, existing SIPs and protected unconfirmed commitments; capped at the remaining target; the plan shows how much the contribution reduces other categories; the ₹1,300 no-cut surplus is shown as **one visible comparison, not the only sensible alternative** | §6, §6.1 |
| 7 | **Goal request rule** (explicit monthly request, else target-date pace, else ₹0) with an affordability condition: a request is a target, not a promise; show the affordable amount and the shortfall | §6, §12 A4 |
| 8 | **Critical over-plan 25%** with the four critical conditions; essential-category overruns stay critical; alerts deduplicated and actionable; the three-alert cap never suppresses a critical alert | §9 |
| 9 | **Unconfirmed lines protected** until confirmed; each shows amount, due date, evidence and the question; never silently moved into discretionary | §3 |
| 10 | Historical gap vs unfunded commitments are **separate measures, not additive** (labelled and reconciled); months-to-target is a **projection with stated assumptions**, not a guarantee | §6.1, §12 B |

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
**Unconfirmed commitment:** an uncertain line that is due is *counted* (it is real money due) as a protected, non-scalable line in tier 3b of the waterfall. It is never counted as discretionary or essential until the user confirms; the plan never moves it into discretionary on its own. Confirming moves it to its class; any class can be corrected later (stored as `classOverrides`).
**What each "Confirm these" card shows:** (1) the **amount** (marked *estimate* when it is a rhythm estimate, e.g. memberships); (2) the **due date** (the event date, or "expected around <date>, estimate" for a recurring estimate); (3) the **available evidence** exactly as found ("linked to <school> fee schedule", "your category <name> is marked essential", or "no evidence available"); (4) the **question** in neutral words, e.g. "Is this essential, or something you could pause? Either way it stays in your plan as money due until you answer"; (5) the choices: Essential commitment / Discretionary (still due) / Ended, remove from this plan. The main plan also shows the running total awaiting confirmation (e.g. "₹1,500 awaiting your confirmation").

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
4. **Emergency reserve** `R = min(gap, floor(max(F,0) × RESERVE_SHARE))`, only while `verified < target`, target set, income usable. `RESERVE_SHARE` is 50% by default and per-user editable. **Safeguards:** (i) `F` is computed only after tiers 1–3b, so the reserve can never take money from essential commitments, variable essentials, existing SIPs or protected unconfirmed lines; (ii) `R` is capped at the **remaining** target (`gap = target − verified`), so the last contribution is exactly the remainder and nothing is recommended beyond the target; (iii) the plan **shows how much `R` reduces every other category** (§6.1). The **no-cut pace** `max(0, I − observedTotal)` is displayed as one visible comparison (§6.1), not as the single sensible alternative.
5. **Additional goals** `G2` (goals other than existing SIPs). A goal's **request** = the monthly amount the user set for it; else `(target − current) ÷ months to its target date` when it has a date; else **₹0** (no invented request). **A request is a target, not a promise that the money exists**: goals are funded in order of earliest target date, each limited by what remains after `R`, and every goal shows `requested`, `funded` and `shortfall` (`requested − funded`). A goal that cannot be fully funded is never hidden or silently scaled to look affordable.
6. **Discretionary** from what remains: first the *confirmed-discretionary commitment lines* (e.g. a confirmed membership), at their due amount, never scaled down by the plan; then the flexible categories, scaled **pro rata to their baselines**. Amounts are floored to whole rupees per line and the remaining rupees go to the largest fractional remainders (ties: larger baseline), so a tier always sums exactly.

**Shortfalls.** `short = max(0, −F)`. Tiers are funded in priority order and whatever income cannot reach is reported short, **lowest priority first**: protected discretionary lines (tier 6) get nothing before any committed line is touched, then `U`, then SIP `G1`, then (only if income cannot cover even those) `E2` and `E1`. **Committed lines are never cut or paused by the plan**: each line shows `affordable` and `short`. Essentials are never scaled down; if income does not cover them the plan says "your income does not cover your essentials" (critical). A goal request larger than free money starves the tiers below it (reserve share, protected discretionary lines, flexible categories) and the plan shows each as short. When `observedTotal > I` the plan also states "your recent spending is ₹X more than your income". No line is recommended above its baseline unless the user raises it. If `F > 0` and all tiers are funded, the remainder is **Unassigned**, not spent.

### 6.1 Trade-offs and projections shown to the user (never implying everything fits)
Three measures exist and are **never added together**; each is labelled with what it measures:
1. **History vs income** = `max(0, observedTotal − I)`: how much more your recent spending (history) is than income.
2. **Unfunded commitments** = Σ `short` on committed lines (SIP, unconfirmed, protected, and essentials if uncovered): planned obligations the plan cannot fund.
3. **Reductions against history by priority** = Σ over flexible lines of `baseline − recommended` caused by the reserve and by goals (money deliberately moved to those tiers).
Relationship, to prevent double reading: when `I < observedTotal`, `History vs income = Unfunded commitments + Unfunded flexible spending` (example B: 13,700 = 3,933 + 9,767). The 3,933 is *part of* the 13,700, not extra.
**Staged attribution (deterministic, order = the priority order):** compute `S0` (no reserve, no goals), `S1` (reserve only), `S2` (reserve and goals). Per flexible line, `due to reserve = S0 − S1`, `due to goals = S1 − S2`; the remainder of `baseline − S0` is `due to income`. Identity per line: `baseline − recommended = due to income + due to reserve + due to goals`. Totals: **`R = no-cut surplus used + Σ due to reserve`** (example A: 6,283 = 1,300 + 4,983). Attribution is order-dependent by design (reserve before goals) and says so.
**Compare reserve speeds (shown, neutral wording):** one row per option, same columns: contribution per month, what it reduces in each category versus history, and months to target. Rows: *Your setting* (`RESERVE_SHARE` of free money); *Keep every category at its history* (the no-cut pace); *A different amount* (the user types it). Beside it, other levers the plan does not decide for the user: a lower or later target, more income, or reviewing a SIP (the user's choice, never automatic). No row is marked "recommended" except the user's own setting.
**Months to target is a projection, not a guarantee:** `months = ceil(gap ÷ contribution)`; contribution 0 → "not reachable at this plan"; contribution ≥ gap → 1 month. The text always says: *"Estimate only. Assumes this monthly contribution continues every month and that your income, spending, and the target stay the same, with no withdrawals."*

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
* **Critical, never capped or hidden:** (a) a committed line cannot be afforded (`short > 0`: SIP, unconfirmed, protected, or essentials uncovered); (b) a variable-essential or commitment category is projected over its recommendation (**essential overruns stay critical**); (c) any category projected over by `CRITICAL_OVER (25%)` or more; (d) the plan's projected total exceeds planning income. Critical alerts ignore materiality and the cap.
* **Advisory:** other categories projected over (`getBudgetHealthStatus` over / close). At most `ALERT_CAP (3)` shown, ranked by projected overage; the rest are in the list view. The cap applies to advisories only: **it can never suppress or displace a critical alert**.
* **Deduplication:** one alert per subject per month (id `plan_<subjectId>_<monthKey>_<level>` in the existing `dismissedAlerts`). If one category meets several critical conditions (e.g. essential and over 25%) it is **one** alert listing every reason, not several. The plan-total alert (d) is its own subject and links to the category alerts that contribute to it; distinct categories each keep their own alert. Dismissing an advisory never dismisses a critical alert, and a critical alert reappears if its numbers worsen by more than `ALERT_REARM (10 points)`.
* **Actionable:** every alert states (1) the number (projected vs recommendation, in ₹ and %), (2) the rule and the method disclosure, and (3) at least one concrete action with its effect: **the daily amount that keeps the category on plan** = `(recommendation − spent to date − unpaid commitments) ÷ days left`; *raise the allocation to ₹Y* and what that takes from other categories; *mark this month atypical*. A critical alert about an unaffordable commitment shows the shortfall and the levers in §6.1 (never an automatic action).
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
`R` = min(gap 1,10,000, floor(12,567 × 50%) = **6,283**) → **₹6,283**; remaining 6,284; `G2` none → 6,284.
Discretionary: Gym **1,500** (protected) → flexible pool **4,784** over Food 6,350 + Shopping 3,417 = 9,767 → Food **3,110**, Shopping **1,674** (floors 3,110 + 1,673, the extra rupee to the larger fraction).
Check: 27,500 + 14,933 + 5,000 + 6,283 + 1,500 + 3,110 + 1,674 = **60,000** ✓. Unassigned 0.
**Trade-off shown (§6.1):** the contribution **₹6,283 = ₹1,300 of surplus that needed no cut + ₹4,983 taken from categories**. Due to the reserve: Food **−₹3,240** (6,350 → 3,110), Shopping **−₹1,743** (3,417 → 1,674). Due to income: ₹0 (history fits income). Due to goals: ₹0.
**Compare reserve speeds:** *Your setting (50%)*: ₹6,283/month, Food −3,240, Shopping −1,743, about 18 months. *Keep every category at its history*: ₹1,300/month, no reductions, about 85 months. *A different amount*: user types it. Months are estimates: "Assumes this monthly contribution continues every month and your income, spending and the ₹1,50,000 target stay the same, with no withdrawals" (110,000 ÷ 6,283 = 17.5 → 18; 110,000 ÷ 1,300 = 84.6 → 85).
**A2. Same, plus an additional goal "Trip fund" with an explicit monthly request of ₹2,000.** After `R`, 6,284 remains → `G2` **funded 2,000, shortfall 0** → 4,284 → Gym 1,500 → flexible pool **2,784**: Food **1,810**, Shopping **974**. Check: 47,433 + 6,283 + 2,000 + 1,500 + 1,810 + 974 = **60,000** ✓. Attribution: due to reserve Food −3,240, Shopping −1,743 (as A); **due to goals Food −1,300, Shopping −700 (= 2,000)**; total below history 4,983 + 2,000 = 6,983 = (6,350 + 3,417) − (1,810 + 974).
**A4. Same as A, but "House deposit" requests ₹8,000/month (a target, not a promise).** After `R`, 6,284 remains → goal **funded 6,284, shortfall ₹1,716**. Nothing is left for tier 6: Gym (protected) **short ₹1,500**, Food 0, Shopping 0. Check: 47,433 + 6,283 + 6,284 = **60,000** ✓. The plan shows the goal's shortfall and the gym as short, raises critical alert (a) for the gym (a committed line it cannot fund), attributes Food −3,240 / Shopping −1,743 to the reserve and Food −3,110 / Shopping −1,674 to the goal, and states plainly that the reserve, this goal and your current spending do not all fit on this income.
**A3. Same as A but the gym membership is not yet confirmed.** `U` = 1,500 in tier 3b (card shows ₹1,500 *estimate*, due around the 5th, evidence "no evidence available", question "Is this essential, or something you could pause?"): `committed` 48,933, F = 11,067, `R` = floor(5,533.5) = **5,533**, remaining 5,534 → Food **3,598**, Shopping **1,936** (no protected line). Check: 48,933 + 5,533 + 3,598 + 1,936 = **60,000** ✓. Attribution: reserve −2,752 / −1,481 (= 4,233 = 5,533 − 1,300). It is neither essential nor discretionary until the user answers.
**B. Income ₹45,000 (same history, consistent).** `E1` + `E2` = 42,433; SIP 5,000 → `committed` 47,433 → **F = −2,433**. **Three separate measures, not additive:**
* **History vs income: ₹13,700** (recent spending 58,700 is above income 45,000).
* **Unfunded commitments: ₹3,933** = SIP short ₹2,433 (affordable ₹2,567, **not paused**) + Gym (protected) short ₹1,500.
* **Unfunded flexible spending: ₹9,767** = Food 6,350 + Shopping 3,417 (affordable 0).
Reconciliation: **13,700 = 3,933 + 9,767**; the ₹3,933 is *part of* the ₹13,700, not on top of it. `R` = 0, `G2` = 0. Critical alert (a) fires for the SIP and the gym. Essentials are covered; nothing is scaled or paused.
**C. New user** (no history; the user enters and confirms an income of ₹40,000, so there is nothing to compare it with; rent commitment ₹12,000, SIP ₹3,000). `committed` 15,000, **Everything else ₹25,000**, no categories, no percentages; reserve: "set a target"; confidence: none.
**D. Withdrawal.** Verified ₹40,000 → ₹25,000 after a ₹15,000 debit on 12 Nov (txn shown). `replenishmentGap` = 1,50,000 − 25,000 = **₹1,25,000**; recommendation `R` unchanged by the tier-4 rule (₹6,283 in A, ₹0 in B); capped at the remaining target. Months (A): ceil(1,25,000 ÷ 6,283) = 20, with the same stated assumptions. Recommendation only.
**E. Alerts (day 12 of 30, 18 days left).** *Critical:* Groceries (variable essential) plan ₹10,000, ₹5,200 spent → pace 5,200 ÷ 12 × 30 = **₹13,000**, over by ₹3,000 (**+30%**). Meets (b) and (c): **one** alert with both reasons. Action: *keep to ≈ ₹267/day for the rest of the month* ((10,000 − 5,200) ÷ 18 = 266.67, against ₹433/day so far), or *raise the allocation to ₹13,000 (takes ₹3,000 from other categories)*, or *mark this month atypical*. Method disclosure shown. *Advisory cap:* if five other categories are projected over, the three with the largest overage are shown and the rest listed; the critical alert is shown in addition (4 visible) and is never replaced by or counted against the cap.
**F. Income needs confirmation.** Expected ₹60,000 (Salary). Received last 3 months ₹50,000, ₹52,000, ₹54,000, average **₹52,000**, `cv` 0.031 (regular), difference (60,000 − 52,000) ÷ 60,000 = **13.3% > 10%** → `needs-confirmation`. Shown: both figures with sources. Free money (before reserve) under each: at ₹60,000 = 60,000 − 47,433 = **12,567**; at ₹52,000 = **4,567**. No reserve, goal or discretionary amount until the user confirms. If they confirm ₹52,000, the plan recomputes A with `I` = 52,000 (`R` = floor(4,567 × 50%) = 2,283). Expected income is not counted as cash anywhere.

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
| `ALERT_REARM` | 10 points | A dismissed critical alert returns only if it worsens materially | How often a critical alert reappears |

## 14. Tests required before any UI (fixtures A, A2, A3, B, C, D, E, F)
* **Arithmetic:** each example above exactly (tier amounts, floors, largest-remainder, Σ = `I`, shortfall decomposition 2,433 + 1,500 = 3,933, no-cut pace 1,300).
* **Waterfall order and shortfall:** SIPs counted once, never reduced; essentials never scaled; protected lines reported short, not cut; `F = 0`, `F < 0`, `F > 0` with every tier funded (Unassigned).
* **Income:** consistent → lower figure shown openly; `needs-confirmation` on each trigger separately; boundary: 2 vs 3 months, `cv` 0.20 vs 0.21, difference 10.0% vs 10.1%; expected income never in cash; confirmation persists and re-asks at > 10% drift.
* **Classification:** override precedence; school fee suggested only with a linked school record, never by amount or name; membership suggested only when its category `fixed === true`; undefined `fixed` → ask; unconfirmed lines counted in tier 3b and never discretionary.
* **Thresholds, both sides:** share 4.99% vs 5%; cumulative cover 79.9% vs 80%; activeRatio 0.74 vs 0.75; cv 1.0 (regular) vs 1.01 (irregular); day 6 vs day 7; target change 19.9% vs 20%; overspend 24.9% vs 25%; 3 vs 4 advisories.
* **Alerts:** critical never hidden by materiality or the cap; advisory cap ranks by overage; one alert per category per month; dismissing advisory leaves critical; disclosure text present.
* **Double counting** (§7) each pair; ADR-036 invariant; no event key twice.
* **Isolation:** the engine writes nothing and never reads `cats[].budget`; Budget and Outlook outputs are unchanged on the same fixtures (snapshot test against `getMonthEndForecast` and `averageOfLastNMonthsVariableSpend`).
* **Reserve:** below target, at target, unverified, withdrawal; contribution 0 when `F ≤ 0`; contribution capped at the remaining gap (last month = remainder, exactly); computed only from `F` after tiers 1–3b (never touches essentials, SIPs or protected unconfirmed lines); `RESERVE_SHARE` edits change `R` and nothing above it.
* **Trade-off arithmetic:** staged attribution identity per line (`baseline − recommended = due to income + due to reserve + due to goals`); `R = no-cut surplus used + Σ due to reserve` (A: 6,283 = 1,300 + 4,983); A2 goals 2,000 = 1,300 + 700; A4 shortfall 1,716; B reconciliation 13,700 = 3,933 + 9,767; the three measures are never summed in output.
* **Compare reserve speeds:** rows present for the user's setting, the no-cut pace and a typed amount; none labelled "recommended" except the user's own setting; months = ceil(gap ÷ contribution) (18 and 85 in A; 20 in D), 0 → "not reachable", ≥ gap → 1; assumptions text always present.
* **Goals:** explicit request first, else target-date pace, else 0; funded in earliest-date order; requested/funded/shortfall shown; an unaffordable goal never shown as fully funded.
* **Unconfirmed lines:** card shows amount (estimate flag), due date, evidence text (or "no evidence available"), question and choices; counted in tier 3b; never counted as discretionary; running total shown.
* **Alerts:** several critical conditions on one category → exactly one alert listing all reasons; distinct categories each keep their own; a critical alert is never suppressed by the cap, materiality or a dismissed advisory; re-arm at 10 points; every alert has the daily-amount action ((rec − spent − unpaid) ÷ days left) and the method disclosure.

## 15. Decisions and scope
**Resolved (owner, 24 Oct 2026):** reserve share 50% with the safeguards of §6 and the trade-off display of §6.1; goal request rule with the affordability condition; critical over-plan 25% with the four conditions and deduplicated, actionable alerts; unconfirmed lines protected and shown with amount, due date, evidence and question; history-gap vs unfunded-commitments labelled separately; months-to-target as a stated-assumption projection.
**Still open for the final review:** none that block the engine; the constants in §13 remain starting defaults.
**Out of scope for this release:** unifying Budget/Outlook/plan forecasts; excluding the reserve account from Available Cash; "use as my budget"; any change to existing budgets, SIPs, goals or transactions.

## 16. Increments (each releasable; none touches existing budgets)
1. Engine (pure): sufficiency, classification and confirmations, discovery, income basis, waterfall, double-count guards, explanations, fallbacks, constants; tests above. No UI, storage or sync.
2. Reserve verification and replenishment (pure).
3. `moneyPlan` persistence + sync and the read-only plan in the Budget tab (needs the approved design, now including the correction screen).
4. Correction flows and the emergency-fund card.
5. Plan projection and alerts through one shared function, with the method disclosure.
