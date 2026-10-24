# BUD-004 — Monthly Money Plan: audit, integration plan, data model (for review; nothing built)

Status: Phase 1 audit done (read-only). No code, no data change, no deployment. Items marked **UNVERIFIED** were not confirmed in code; items marked **DECISION** need an answer before the increment that depends on them.

## 1. What already exists (and must not be duplicated)
| Concept | Where | Notes |
|---|---|---|
| Monthly household budget | `annualBudget` (default 600000) + `monthOverrides[YYYY-MM]` + optional carry-forward; `getHouseholdPlanningAllocation`, `getEffectiveMonthlyBudget` in `domain/allocations/adapter.js` | Starts from a **budget**, not from income |
| Category budget | `cats[].budget` (flat, no month override) via `getCategoryPlanningAllocation` | Same file |
| Mandatory commitments | `mandatoryCommitments` (`id, name, amount, categoryId`), state/skip, `getMandatoryCommitmentsTotal`, `getMandatoryCommitmentState` | |
| Discretionary hierarchy | `getDiscretionaryPool` = monthly budget − commitments; Σ person/group allocations ≤ pool; `getUnallocatedDiscretionary`, `getAllocationHierarchyWarning`, `wouldExceedDiscretionaryPool` (reject, never clamp) | Over-allocation rule exists; reuse |
| Actual spend | `getCategoryAttributedTotal`, `getHouseholdAttributedTotal` (refund-aware, multi-tag-aware) | Single source for "actual" |
| Forecast and health | `getMonthEndForecast`, `getSpentPercentage`, `getSafeToSpendPerDay`, `getBudgetHealthStatus`, `getBudgetVariance` | Reuse for projection and warnings |
| Insights read model | root `domain/insights/*` (spending, budgetPerformance, commitments, income, savingRate…) | Insights must consume it, never compute independently |
| Expected income | `expectedIncome[]` (`name, amount, frequency, nextDate, status, lastReceivedDate`) | Salary lives here today |
| Investments / SIPs | SIPs are `recurringSchedules` (a separate entity), surfacing as `futureMoney.committedSaving`; accounts flagged by `isInvestmentAccount` | |
| Outlook / Available Cash / Buffer | `domain/accounts/availableCash.js` (`getAvailableCash`: bank, cash, upi, not investment; verified-balance checkpoints via `getEffectiveBalance`), `domain/futureMoney/moneyRequired.js` (`getMoneyRequiredForPeriod`), buffer = available cash − money required | |
| Verified balance | `balanceCheckpoints[accId] = {date, amount}`: balance = computed + (checkpoint − expected at checkpoint) | This is the existing "verified" mechanism |
| Goals | `goals[]` with optional `linkedAccountId` (progress = live account balance) | Natural home for the emergency-fund target |
| Alerts | `dismissedAlerts[]` with ids `budget_<subject>_<monthKey>_<variant>`; `domain/budget/{pace,nudge,readiness}` | One alert system; extend its id scheme |

## 2. Findings that affect the design
1. **Two domain roots.** Budget math lives in root `domain/` (allocations, insights, cashflow, reports) and in `src/domain/` (budget, futureMoney, accounts…). App.jsx imports both. New pure code goes in `src/domain/budget/` (next to readiness/pace/nudge) and imports the root allocation helpers; do not add a third location.
2. **Home duplicates Outlook's Safe-to-Spend / buffer maths** (the code comment says so). Plan alerts must read one shared function; adding a third copy is not acceptable.
3. **A reserve account is counted as spendable today.** `getAvailableCash` includes every bank/cash/upi account not flagged as investment, so an emergency-fund savings account inflates Available Cash and Buffer. Fixing it changes Outlook numbers for existing users. **DECISION** (see 5).
4. **Income and budget are different things today.** The plan allocates *income*; the app budgets a *monthly spend limit*. They must be related explicitly, not assumed equal.
5. **Category budget is flat and independent per category.** A plan bucket (Home, Car…) is not a category. The plan therefore needs an explicit bucket → categories mapping, and must never overwrite `cats[].budget`.
6. **App.jsx is frozen** (ARCH-004): plan state + persistence + sync registration are the only wiring; screens go in `src/screens/`, logic in `src/domain/budget/`.
7. **Sync registration is five edits** (data keys, user-data list, label, snapshot object, restore guard); the snapshot-completeness test catches a miss.

## 3. Data model (the only new persisted data)
One new synced object, `moneyPlan` (localStorage `arth_money_plan`), **configuration only**; no balances, no actuals, no recommendations stored (they are recomputed, so they cannot go stale or disagree):
```
moneyPlan = {
  v: 1,
  income: { mode: "expected-income" | "manual", manualAmount: number|null },       // DECISION 1
  template: { id: "default-v1", slabs: [ { upTo: number|null, pct: { investments, emergency, car, personal, home } } ] },
  buckets: [ { id, name, kind: "investment" | "reserve" | "spend", pctOverride: number|null, amountOverride: number|null, categoryIds: [] } ],
  emergencyFund: { targetAmount: 200000, goalId: string|null, accountId: string|null, paused: false },
  updatedAt
}
```
* Reference template (editable defaults, not advice): investments 25%, emergency fund 10%, car 15%, personal 15%, home 35% (₹7,500 / 3,000 / 4,500 / 4,500 / 10,500 on ₹30,000; sums to 100% and ₹30,000, checked).
* **Slabs:** only the ₹30,000 reference exists. Other slabs are **not invented**: the consultant must supply the table (DECISION 2). Until then the template has one open-ended slab, and the engine never scales amounts linearly: amounts come from the slab's percentages or from an explicit user override.
* A category belongs to at most one bucket (validated), so spend is never counted twice.
* No transactions are created; "Apply to budgets" is a separate, explicit, later action and is out of scope for the first increments.

## 4. Engine (pure, deterministic, explainable) — `src/domain/budget/moneyPlan.js`
`buildMoneyPlan({ income, plan, obligations, reserve, monthKey })` returns, per bucket: `recommended`, `planned` (after overrides), `pct`, `committed` (already-committed amounts mapped into it), `headroom`, and `reasons[]` (plain-language strings naming the rule and numbers used); and totals: `income`, `allocated`, `unallocated`, `overAllocated`, plus `flags[]` (`over-allocated`, `insufficient-income`, `committed-exceeds-bucket`, `reserve-target-reached`).
* **Obligations first:** committed amounts (mandatory commitments, committed SIPs, EMIs, from the same `futureMoney` / `mandatoryCommitments` readers) are mapped to buckets by category / SIP and subtracted *before* a discretionary suggestion; committed investments count toward the Investments bucket (not added on top). A bucket whose commitments already exceed its recommendation is flagged, not silently raised.
* **Over-allocation:** reuses the existing rule: an edit that would push Σ planned above income is refused with the overage shown (same behaviour as `wouldExceedDiscretionaryPool`), never clamped.
* **Edits:** amount ↔ percentage are two views of one number (planned = override or pct × income); changing one recomputes the other and the totals immediately (pure function, so the UI is instant).
* **Emergency fund:** `contribution = min(recommended, target − verifiedReserve)` while `verifiedReserve < target` and the plan is affordable, else 0; at or above target the default contribution is 0 and the flag `reserve-target-reached` is set. `verifiedReserve` = effective balance (checkpoint-verified) of the linked account/goal account; a *planned* contribution is never added to it. **Withdrawal:** a drop in verified reserve relative to the last verified checkpoint, or a debit transaction from the reserve account after it, produces `replenishmentGap = target − verifiedReserve` and a **recommendation only** (no transfer, no transaction).
* **Intelligence (Phase 4):** actual per bucket = `getCategoryAttributedTotal` over its categories; projection = `getMonthEndForecast`; status = `getBudgetHealthStatus`; one alert per bucket per month using the existing `dismissedAlerts` scheme (`plan_<bucket>_<monthKey>_over`). Budget, Insights, Outlook and Cash Flow read the **same** function; none recompute.

## 5. Decisions needed before the dependent increment
1. **Plan income basis:** monthly salary from `expectedIncome` (sum of monthly items), or a typed figure? (Increment 1 supports both; default needs your choice.)
2. **Slab table:** which salary bands, and what percentages per band? (Reference ₹30,000 only is defined.)
3. **Bucket ↔ category mapping:** which existing categories sit in Car / Personal / Home? Suggest the user maps them on first setup; the engine ships with no hidden defaults.
4. **Reserve account:** should a designated emergency-fund account be **excluded** from Available Cash / Buffer? Recommended yes, but it changes Outlook numbers for existing users, so it needs approval and its own release.
5. **Committed investments:** confirm that existing SIPs count *inside* the Investments bucket (recommended) rather than on top of it.

## 6. Increments (each one releasable; none touches existing budgets)
1. **Engine only** (`moneyPlan.js` + tests, reference scenario, over-allocation, insufficient income, obligations, reserve-target and withdrawal cases). No UI, no storage, no sync, no production risk. Reports: commit, tests, build.
2. **Reserve verification** (pure): verified reserve and replenishment gap from checkpoints/transactions. Tests with real checkpoint data shapes.
3. **Persistence + sync** for `moneyPlan` and a read-only **Monthly Money Plan** card inside the existing Budget tab (income, allocated / unallocated / over-allocated, bucket rows with reasons). Requires the approved design.
4. **Edit allocation** sheet (amount / percentage, instant effect, over-allocation refusal) and the **Emergency fund** card (target, verified reserve, suggested contribution, target-reached state, replenishment recommendation).
5. **Plan vs actual and alerts** (projection, one alert per bucket per month) wired into the existing Budget / Insights / Outlook readers.
6. Separate release, needs approval: exclude the reserve account from Available Cash / Buffer (decision 4); "Apply plan to category budgets".

## 7. Not in scope / risks
* No automatic transfers or transactions; no overwrite of `cats[].budget`, `annualBudget`, `monthOverrides` or commitments.
* Recommendations are illustrative defaults, shown with their reasons; they are not financial advice.
* Verification so far is by reading code; no behaviour has been run. Android and two-device behaviour of the new object is untested until it exists.
