# PURCHASE-ENTRY-001 — Amount-paid anchor, top-level charges and discounts, optional itemisation (SPEC AND IMPLEMENTATION PLAN, revision 6)

Status: **documentation only. Nothing here is approved for code, push to `main` or deployment.** Implementation needs your explicit approval of §13 first. Kept separate from `INVOICE-IMPORT-006` (§12).
Labels: **[VERIFIED]** = read in the code, or run in a throwaway script outside the repository. **[NOT RUN]** = traced by reading only. **[NOT VERIFIED]** = proposal or unknown. Example amounts are invented except the Amazon figures you supplied.
Principle (owner): **the expense model must not dictate incorrect accounting.** If it cannot represent a payment accurately, say so; never silently change the amount or misclassify a discount.

## 1. Decisions settled by the owner
1. **EMI vs Full.** When **EMI** is selected, the calculated interest and applicable GST stay (today's calculation). In **Full** mode the typed **amount paid is authoritative**. Safeguards on this decision are in §15 (owner-approved).
2. **Top-level charges.** A structured list of charges at the top, usable in **both Standard and Itemised** modes.
3. **Discounts** are allocated **proportionally across the items they apply to**, unless the receipt explicitly says otherwise. The **existing shared-charge split rules are preserved** (charges shared equally by the number of splits, payer included).
4. **Unallocated remainder** goes to the **top-level category**, and the itemisation is **clearly marked incomplete**.

## 2. Requirement
Top = what I paid and how the amount was calculated (amount paid, MRP, discounts including instant bank discounts, processing fees, handling/shipping/delivery, CGST/SGST/other, account, date, note, reference). Bottom = what I bought and how it is categorised (optional items, each with a category). **The item list never determines or silently changes the amount paid.** Switching Standard ↔ Itemised never changes the total or creates a second expense. Reconcile, never force.

## 3. Today's behaviour [VERIFIED by reading unless stated]
1. Typing an **MRP** in the price breakdown (shown when paying by credit card) makes the **saved amount** = MRP − discount + processing fee + interest + GST on interest, **replacing the typed amount**, **in both Full and EMI** — the Full/EMI chip does not gate it. Interest = net price × rate ÷ 1200 (one month's interest), GST = 18% of that interest. Shipping, handling and CGST/SGST are not in it. Whether this formula matches real EMI economics is NOT VERIFIED and is not changed here. The **EMI chip** separately sets down payment, tenure and the EMI schedule, using that amount (`financedAmount = amount − down payment`).
2. **Itemised needs an exact match**: items + charge lines = typed amount, or Save is blocked. A partial list cannot be saved.
3. **Charges are lines** (`kind: "charge"`) inside the item list; Standard has no place for them. A discount has no line form.
4. **Items can change the amount** (Itemised → Standard sets amount = items total; an empty amount is filled from the items).
5. **A negative line is unsafe** (INVOICE-IMPORT-006 §4.1).
6. A charge's **category** today is that of the **biggest categorised item** (charges need none of their own); charges are shared between people **equally by the number of splits**, the payer counted.

## 4. Model (additive) [NOT VERIFIED — proposal]
**`amount` stays the amount paid** and nothing recomputes it in Full mode. Old app versions therefore still read the right amount.
New optional record on an expense, `purchase`:
- `v`: 1 · `paidPaise`: the amount in whole paise at save time (a **consistency stamp**, §9).
- `mode`: `"full"` or `"emi"`. The existing calculation is kept exactly as it is and never gains new charges (§15).
- `emi` (only in EMI mode): `{ netPaise, processingFeePaise, interestPaise, gstOnInterestPaise, calcTotalPaise }`, a frozen snapshot of the calculation for audit and reconciliation.
- `adjustments`: list of `{ id, kind: "charge" | "discount", type, label, amountPaise, appliesTo, emiRelation }` (`emiRelation` is `"included"`, `"separate"` or `"unknown"`, used only in EMI mode, §15). **Every amount is positive; the sign comes from `kind`**, so no negative number is ever stored. `appliesTo` is `"all"` (default) or a list of item ids when the receipt says so.
- `mrpPaise` (optional, informational), `itemisation`: `{ state: "none" | "partial" | "complete", coveredPaise, remainderPaise, uncategorisedCount }`.
**EMI purchases are the exception to "the record lives on the expense":** their purchase details live **only on the loan** (§16.5); the down-payment expense carries just a loan reference.
Items stay in `lineItems`, **items only** from now on, with an optional per-item `netPaise` (the allocated net, written at save, §6). Legacy charge lines keep being read (§9).

## 5. Reconciliation (pure function, tested) [proposal]
Let **P** = amount paid, **C** = charges, **D** = discounts, **L** = entered item list-price total.
**V = P − C + D** is the item value the payment implies. For your order: 2,471.89 − 59.00 + 134.11 = **2,547.00**.
1. **Top breakdown.** If you also enter the items' subtotal or MRP **S**, it is checked: S + C − D = P, else the exact difference is shown. The amount paid is never changed.
2. **Itemisation coverage** compares **L with V**:
   - L = V → **Matches** (complete).
   - L < V → **Itemisation incomplete: ₹(V − L) of item value not itemised** (partial; Save allowed).
   - L > V → **Items exceed what you paid for items by ₹(L − V)** (Save blocked until resolved).
   - No items → **No itemisation** (Standard with a breakdown is valid).
3. **Double-count hint.** If the shortfall V − L equals D to the paisa, say "Items may already include the discount" instead of silently accepting it.
Whole paise only; each charge and discount counted once.

### Worked cases (your Amazon order: P 2,471.89; C = 50.00 + 9.00 = 59.00; D = 134.11; V = 2,547.00)
- **A. Complete.** Items 329.00 + 969.00 + 1,249.00 = 2,547.00 = V → **Matches.**
- **B. Partial.** Only the 969.00 item → **Itemisation incomplete: ₹1,578.00 of item value not itemised** (2,547.00 − 969.00). Saves normally.
- **C. No items.** Adjustments only → "No itemisation". Valid.
- **D. Over.** Items 2,700.00 exceed V by **₹153.00** → Save blocked; the amount is untouched.
- **E. Item prices already net.** Items entered at 311.68 + 917.98 + 1,183.23 = 2,412.89 and the 134.11 discount also entered → shortfall 134.11 equals D → hint "Items may already include the discount".
- **F. No discount.** P 1,009.00, charges 40.00, items 969.00 → V = 969.00 → Matches; no allocation needed.

## 6. Category allocation (what reports read) [proposal; arithmetic checked]
- Reports read `catAllocations` (or `catIds`) and `amount` only (§10). The new feature must write **`catAllocations` that sum to exactly P**.
- **Discount:** each item's share is `D × price ÷ V` for the items it applies to (default all), rounded to the paisa with the leftover paisa by **largest remainder**; item net = price − share. Case A: shares 17.32 / 51.02 / 65.77 → nets **311.68 / 917.98 / 1,183.23** (= 2,412.89 = V − D).
- **Charges:** unchanged rule — they report under the category of the **biggest categorised item** (here the 1,249.00 item: 1,183.23 + 59.00 = **1,242.23**). Totals: 311.68 + 917.98 + 1,242.23 = **2,471.89 = P**.
- **Partial** (case B): the entered item's net is 969.00 × (V − D) ÷ V = **917.98**; the not-itemised value (1,578.00 at list price) reports its net, **1,494.91**, under the **top-level category**; charges 59.00 as above. 917.98 + 1,494.91 + 59.00 = **2,471.89**. Shown as "Itemisation incomplete".
- **Uncategorised items** report under the top-level category and keep their own flag ("not individually categorised").
- A receipt-specified discount (`appliesTo` = chosen items) uses the same formula over those items only. Everything allocated is labelled **allocated**, never seller-confirmed.

## 7. People and groups [partly NOT RUN]
Each person's amount = their items − their discount share + their equal share of charges (the existing rule). The payer's own share is the residual `amount − sum(others owed)`, so smaller shares for others raise the payer's share automatically [residual rule VERIFIED in `getMyExpenseShare`]. A test must show the per-person rows never exceed P.

## 8. Standard ↔ Itemised
Switching never changes `amount`, never creates a second expense, and keeps the adjustments. The silent "amount = items total" behaviours are removed; setting the amount from items stays an explicit button. Going to Standard still asks before dropping items.

## 9. Reading old expenses without migration or double-counting
No migration and no rewrite on load. One pure function `readPurchase(txn)` returns the view every screen uses:
1. If `txn.purchase` exists **and** `txn.purchase.paidPaise === round(txn.amount × 100)` → use it. **Legacy fields are then ignored** (`priceDiscount`, `priceProcessingFee`, charge lines), so nothing is counted twice.
2. If `purchase` exists but the stamp does not match (an old app changed the amount) → treat `purchase` as **stale**: ignore it, read legacy, and show "Breakdown out of date".
3. Else read legacy: `priceMrp/priceDiscount/priceProcessingFee/priceInterestAmt/priceGstAmt` map to the top block; legacy `kind: "charge"` lines map to charges; an exact-match itemised expense reports as before (its adjustments are empty).
Editing and saving an old expense writes `purchase` **only after the top section is edited**; until then the stored record is untouched. The amount is never recomputed on load.

## 10. Impact analysis
Reads were traced in the code; behaviour on the new shape is **NOT RUN** until built.
| Area | What it reads today [VERIFIED] | Effect of this change | Risk / required action |
|---|---|---|---|
| **Budget** (Home, Budget tab, carry-forward, spent %) | `getHouseholdAttributedTotal` → `amount`, `people`, `groupAllocations`, refunds | None while `amount` = paid | Test: budget identical before/after for every legacy shape |
| **Category totals** | `getCategoryAttributedTotal` → `catAllocations` (summed per category, not netted) else `catIds`; Insights spending carries its own copy of the same rule | Correct only if `catAllocations` sums to P | **Invariant + test:** Σ `catAllocations` = P for every new expense; both copies of the rule tested |
| **Insights** (spending, commitments, savings rate, cash flow, runway) | `amount`, `catAllocations`, `catIds`, `people`, `groupAllocations`, `trackingMode`; none read `lineItems`, `price*` or `purchase` | None by construction | Static test that no reader outside the form and detail screens reads `purchase` |
| **Person / group reports** | `people[*].amount/mode`, `groupAllocations` | Others' amounts shrink by their discount share; payer's residual rises | §7 test; refund interplay NOT RUN |
| **Item-level readers** | `vendorInsights` (category spend and item totals from `item.amount`), `vehicleFinancials` (buckets from `qty × unitPrice`), `contribution` (per-item balance from `qty × unitPrice`) | These sum **list prices**; with shipping or a discount they would not equal P | **Real finding.** Change these three readers to use `netPaise` when present, else today's formula; legacy items have none, so legacy results are unchanged. A test per reader |
| **Price fields** (`priceMrp`, `priceDiscount`…) | Only the add form and two detail views in `App.jsx` (display) | Detail views switch to `readPurchase` | Display tests |
| **Transaction boundary** | Falls back to the legacy path for category splits; a pass-through base keeps unknown fields | `purchase` and `netPaise` must survive create and edit on **both** paths | Round-trip tests on both paths |
| **Sync** | `txns` is one synced collection of plain JSON; digests compare structure, not individual fields | New fields travel as data | Size of 300+ item expenses NOT VERIFIED; two-device simulation test |
| **Undo (invoice import)** | `planUndo` compares id, amount, date, account, merchant, category and the stored `lineItems` JSON; refuses if people, notes or settlements were added | `purchase` is not compared, so an edit to it would not block Undo | Add `purchase` to the comparison; test |
| **Old-app compatibility** | Old form copies known item fields only and requires items = amount | Old app **shows the right amount**; it **cannot re-save** a partial or discounted itemised expense without the user resolving the mismatch, and it drops `netPaise` on item edit | Accept and document; the stamp (§9.2) makes stale data detectable; no corruption path found |
| **Refunds** | `buildRefundTotalsByExpense` against `amount`; category Path 1 is not netted | Unchanged | Test with a refunded new-shape expense |
| **Reports, FY and calendar** | `amount`, categories | None | Covered by the unchanged-behaviour corpus |

## 11. Tests required to prove old expenses are unchanged
1. **Legacy corpus** of synthetic expenses in every shape: plain; MRP computed total; EMI with interest and GST; itemised exact match; itemised with legacy charge lines; person/group split; category split with `catAllocations`; refunded; paid by another person; invoice-imported. For each, golden outputs captured **before any change** for: budget total, category totals, insights spending, person/group amounts, the vendor/vehicle/contribution readers, detail-view text, the Undo plan and a sync round trip. They must match **after**.
2. `readPurchase`: precedence, stale stamp, legacy mapping, no double counting (a discount present both as a legacy field and in `purchase` is counted once).
3. `reconcilePurchase`: cases A–F, paise rounding, never alters P, the hint for E.
4. Allocation: Σ `catAllocations` = P for randomised inputs; largest-remainder determinism; partial and `appliesTo` cases.
5. Sign safety: no negative number is stored anywhere.
6. Mode switching leaves `amount` unchanged and creates no second expense.
7. Boundary round trip on both paths; two-device sync simulation; Undo with and without a later `purchase` edit.
8. Static guard that only the allowed modules read `purchase`.
9. The EMI tests listed in §15 and §16.7.
10. Mutation checks on each rule; phone-width browser tests on synthetic data; real-phone verification kept separate and not claimed from desktop tests.

## 12. Scope separation from INVOICE-IMPORT-006
This spec does not build invoice import. **Until it is implemented and verified, invoice import must not alter or misrepresent a discounted purchase:** an order with a discount or promotion is previewed with its reconciliation and **Confirm is withheld** (INVOICE-IMPORT-006 §4.1–4.2). The import later writes the same `purchase` record through the same functions and adds no accounting logic of its own.

## 13. Implementation plan (for your approval; nothing started)
Each stage is its own change, tested and reviewed before the next; none is pushed or deployed without your explicit approval.
1. **Characterisation first:** capture the golden outputs of §11.1 and commit only tests. No behaviour change.
2. **Pure functions:** `readPurchase`, `reconcilePurchase`, `allocatePurchase`, `checkEmiSchedule` (read-only, §16), with tests; no screen uses them yet.
2b. **Loan-storage gate, tests only (§16.9):** run G1–G6 against the **current** code with an extra unknown field on loans and down-payment expenses. **No code that writes `loan.purchase` or `emiLoanId` may be written until all six pass;** a failure selects the fallback and the plan is re-presented to you.
3. **Readers:** repoint the three item-level readers and the two detail views through `netPaise` and `readPurchase`; the characterisation tests must still pass.
4. **Form, top block:** the new top section (amount paid, charges, discounts, breakdown, EMI mode) behind a switch that stays off in production builds until verified.
5. **Form, itemisation:** partial save, "incomplete" marking, remainder to the top-level category, mode-switching rules.
6. **People/groups, Undo, boundary and sync tests;** the EMI schedule display as a read-only informational line; **re-run the §16.9 gates against the finished code** (they must still pass); old-APK compatibility check.
7. **Phone verification** (separate from desktop tests), then a release decision by you.
Each stage reports the tests run, what was not verified, and a before/after table of any figure that changed (none are expected).

## 14. Remaining unknowns [NOT VERIFIED]
- **EMI:** §15 (owner decision) and §16 (schedule check); U-EMI-1 corrected; U-EMI-3, U-EMI-4, U-EMI-5 and U-EMI-6 decided (§16.4, §16.5, §16.8, §16.9); only **U-EMI-2** (issuer formula, unendorsed) remains open.
- Sync size and two-device behaviour of 300+ item expenses; behaviour on the real Android app; how refunds interact with allocated nets; whether any report outside those traced reads line items; whether the old APK's edit screen damages `netPaise` beyond dropping it.

## 15. EMI mode and top-level charges (owner decision, with safeguards)
Decision: the proposal is accepted — **the existing EMI calculation is preserved and never gains new charges automatically.** Safeguards (all owner-set):
1. **Preserve the calculation.** The formula in §3.1 stays exactly as it is, frozen by characterisation tests. New top-level charges are **never added to it automatically.**
2. **Amount paid stays authoritative and is never overwritten by a calculated total.** The calculation is shown as "Calculated: ₹X" with the difference from the entered amount (₹0.00 or "₹Y different"). The field is **pre-filled** with the calculated total only until you type your own amount; after that your figure wins and the difference is shown. **This is a change from today**, where typing an MRP silently replaces the amount in both Full and EMI. It applies to **new entries only**; stored expenses are not recomputed.
3. **New charges are recorded separately** and each is marked **`included`** (already inside the EMI amount), **`separate`** (charged on top) or **`unknown`**. The screen shows which, wherever it is known; a charge with no answer is `unknown`.
4. **No double counting** of interest, GST, fees or charges. The expected total is `calculated total + Σ charges marked separate`; charges marked `included` are shown but not added again. The existing **Processing Fee** field is part of the calculation, so a new "processing fee" charge, and any new CGST/SGST charge (GST on interest is already in the calculation), **default to `unknown` with a warning** ("this may already be counted") instead of being added.
5. **Unclear relationship → flag, never guess.** If any charge is `unknown`, the reconciliation state is **Needs review**: it shows both figures it could be (calculated total, and calculated total + that charge) without choosing one, and never claims a match, even when the amount equals one of them.

**Reconciliation in EMI mode** (pure, tested): `expected = calcTotal + Σ separate`; states **Matches**, **Entered amount is ₹X above/below expected**, **Needs review (n unclear charges)**. The entered amount is never changed.

### Worked cases (invented figures)
Price ₹30,000 less ₹2,000 discount = ₹28,000 net; rate 15% p.a. → interest 28,000 × 15 ÷ 1,200 = **₹350.00**; GST 18% = **₹63.00**; processing fee ₹199.00 → **calculated total ₹28,612.00**.
- **G1.** No charges, amount ₹28,612.00 → Matches.
- **G2.** Delivery ₹50.00 marked `separate`: expected ₹28,662.00. Amount ₹28,662.00 → Matches; amount ₹28,612.00 → "₹50.00 below expected".
- **G3.** Delivery ₹50.00 marked `included`: expected ₹28,612.00 → Matches, shown as "included in the EMI amount".
- **G4.** Delivery ₹50.00 `unknown`: **Needs review.** It shows "equals the calculated total; equals total + ₹50.00 if charged separately" and picks neither.
- **G5.** A new processing-fee charge of ₹199.00 while the Processing Fee field is 199.00 → flagged "may already be counted"; defaults to `unknown`; not added.
- **G6.** A CGST charge of ₹35.82 while GST on interest (₹63.00) is in the calculation → flagged the same way.
- **G7.** You type ₹28,700.00 over the calculated ₹28,612.00 → the amount stays ₹28,700.00 and the screen shows "₹88.00 above the calculation".

### Tests for this section
Characterisation of the existing formula at several inputs (including rounding, rate 0, no discount, no processing fee) before any change; no charge is ever added to the calculation by code; each `emiRelation` value drives expected-total correctly; `unknown` always yields Needs review and never Matches; the double-count flags (G5, G6); the entered amount is never mutated by the calculation after the first manual edit; stored EMI expenses reload with identical amounts and `readPurchase` maps their `priceInterestAmt`, `priceGstAmt` and `priceProcessingFee` without recomputing; the down-payment and financed-amount path (`amount − down payment`) is unchanged for existing expenses.

### Unknowns [NOT VERIFIED]
- **U-EMI-1 (corrected in revision 4):** an EMI purchase does **not** store one expense carrying the full purchase value. Today it stores a **down-payment expense** (only if a down payment is entered), a **loan** whose principal is the financed amount, and, for credit-card EMIs, one **instalment expense per month** (§16.1). The earlier statement that the saved amount is the full purchase value was inaccurate.
- **U-EMI-2:** whether the calculation's one-month interest matches how your card issuers actually bill EMI interest. It is preserved as is, not endorsed.

## 16. EMI schedule reconciliation check (informational only)
### 16.1 What Arth stores for an EMI purchase today [VERIFIED by reading the save path; not run]
When **EMI** is chosen the form does **not** create one expense for the full purchase value. It creates:
1. a **down-payment expense**, amount = the down payment (**none at all if the down payment is 0**);
2. a **loan** (`direction: "taken"`) with `principal` = `financedAmount` = typed amount − down payment, `tenureMonths`, `emiAmount`, `interestRate`, `hasInterest`, and an `isEmiPlan` marker;
3. for credit-card EMIs only, **one instalment expense per month** (`isAutoEmiInstallment`), each for `emiAmount`, with the ids listed in `loan.scheduledInstallmentIds`.
There is **no stored link from the loan to the down-payment expense** (only the words "Down payment ₹X paid upfront" in the loan's note). The typed purchase value exists only as `down payment + principal`; it is not saved as one field.
So today a purchase reports as spending **down payment + each instalment** over time; the financed principal itself is not an expense. This spec does not change that treatment (§16.4, U-EMI-3).

### 16.2 The four figures, kept distinct on screen and in code
| Figure | Meaning | Where it comes from |
|---|---|---|
| **Full purchase value recorded in Arth** | what was bought | down payment + loan principal (for **new** entries also saved as a snapshot, §16.5) |
| **Cash paid today** | the down payment | the down-payment expense (new entries: the snapshot) |
| **Amount financed through EMI** | purchase value − down payment | the loan principal |
| **Schedule reconciliation result** | arithmetic consistency of the schedule | the check below |
They are never added together as separate expenses, and none is derived from another by the check.

### 16.3 The check (pure function, read-only)
`checkEmiSchedule({ purchaseValuePaise?, downPaymentPaise?, financedPaise, tenure, emiPaise, instalments? })` returns a result and **changes nothing**: no stored amount, down payment, tenure, EMI, instalment or loan is written, rounded or "fixed" to reconcile. Tests pass deep-frozen inputs to prove it.
1. **Validate, don't recalculate.** Schedule total = `down payment + emi × tenure`, compared with the stored purchase value. (Algebraically the down payment cancels: the check equals `emi × tenure` against the loan principal. It is stated both ways because the owner asked for the whole-purchase view and because a legacy loan has only the second.)
2. **Rounding tolerance.** The suggested EMI is rounded to the paisa, so the total can differ by up to half a paisa per instalment. Tolerance = `ceil(tenure × 0.5)` paise [proposal, arithmetic only]. Differences inside it are reported as "equal within rounding" and the actual paise are shown.
3. **Result states:**
   - **Equal** (within rounding): schedule total equals the purchase value.
   - **Schedule is ₹X above the purchase value** — **informational, not an error.** An interest-bearing EMI is expected to total more than the amount financed; the excess is shown as "implied financing cost (interest, GST, fees)". The check does **not** compare it with any interest, GST or fee formula.
   - **Schedule is ₹X below the purchase value** (beyond rounding) — **flagged**: the instalments would not repay the amount financed.
   - **Recorded as no-interest but ₹X above** — flagged for review, nothing chosen.
   - **Unverifiable**, never shown as a match or a mismatch, when: tenure is missing or 0; the EMI amount is unknown or 0; the principal or purchase value is unknown; a credit-card schedule is **incomplete or changed** (instalment count ≠ tenure, a listed instalment is missing, or an instalment's amount differs from the EMI); or, for a legacy loan, the down payment is **not linked** (then only the financed part, `emi × tenure` against principal, is checked and labelled "financed part only").
4. **Scope of the claim.** It validates arithmetic consistency only. It does **not** certify that the issuer's interest, GST, fees or billing formula is correct, and the screen says so.

### 16.4 No double counting; existing EMI accounting preserved (owner decision on U-EMI-3)
**Decided:** Arth's existing EMI accounting is **preserved in this phase.** No full-purchase expense is introduced on top of the existing down-payment expense and instalment expenses. The financed principal stays a loan, not an expense, exactly as today.
- The check is **read-only** and **cannot affect budgets, reports, cash flow, category totals, net worth or any other total.** It adds nothing to any total and moves nothing between records.
- The purchase value is **one purchase**; the down payment and the future EMIs are **parts of how it is financed**, never extra expenses on top of it.
- Whether the full purchase value should ever be reported differently (as one expense at purchase) is **out of scope**; any such change needs its own reviewed spec so the same money is never counted both as a purchase and as instalments.
- **Tests:** with the check present and absent, golden budget, category, insights, cash-flow, person/group, net-worth and loan figures for a corpus of EMI purchases are **identical**; a static guard that only the display component imports `checkEmiSchedule`; no writer is imported by it.

### 16.5 Where the purchase details live (owner decisions on U-EMI-4 and U-EMI-5)
**Decided:** the **loan record is the single authoritative home** of an EMI purchase's details, **whether or not there is a down payment.** The **down-payment expense carries only a loan reference** (`emiLoanId`, the loan's id) and **no copy of any purchase detail.** **No synthetic zero-value expense is ever created** to carry metadata. The decision holds only if every gate in §16.9 passes; if any fails, the fallback in §16.9 applies and the data model is **not** widened.
**What is stored (new entries only):** `loan.purchase = { v, purchaseValuePaise, downPaymentPaise, financedPaise, tenure, emiPaise, adjustments?, mode:"emi" }`. `adjustments` here are the purchase's own charges and discounts (the same structure as §4), kept once, on the loan. Legacy loans get nothing and are never rewritten; the check then reports "financed part only" (§16.3).
**Staleness:** if the live loan's principal no longer equals `financedPaise` (the loan was edited), the purchase-value leg is **Unverifiable: loan changed since purchase**; the schedule leg uses the live loan. If the down-payment expense's amount no longer equals `downPaymentPaise`, the check says **down payment changed since purchase**. Nothing is auto-corrected.
**Evidence that the loan record can carry fields (read-only review; not run):** the loan edit form and every other loan writer (repayment, bill and statement settlement, auto-EMI progress, card EMI settlement, restore through `normalizeLoans`) spread the existing record before changing fields, so unknown fields survive; `loans` is one of the synced collections of plain JSON; the down-payment expense is written directly, so an added reference field persists, and the standard edit path keeps unknown fields through its pass-through base.
**The reference is display-only.** It is never used to build a total, to move money or to link accounting between records.

### 16.6 Worked cases (invented figures)
- **S1 — interest-bearing.** Purchase value 30,000.00; down payment 6,000.00; financed 24,000.00; tenure 6; EMI 4,200.00. Schedule total = 6,000.00 + 6 × 4,200.00 = **31,200.00** → **₹1,200.00 above the purchase value (implied financing cost)**. Informational.
- **S2 — no-cost EMI.** Value 24,000.00; down payment 0; tenure 6; EMI 4,000.00 → 24,000.00 = 24,000.00 → **Equal**.
- **S3 — rounding.** Financed 10,000.00; tenure 3; EMI 3,333.33 → 9,999.99 vs 10,000.00, difference 1 paisa, tolerance 2 paise → **Equal within rounding (₹0.01)**.
- **S4 — too small.** Financed 24,000.00; tenure 6; EMI 3,900.00 → 23,400.00 → **₹600.00 below**, flagged.
- **S5 — incomplete schedule.** Tenure 12 but 9 instalment expenses exist → **Unverifiable: 9 of 12 instalments present.** Not a match, not a mismatch.
- **S6 — EMI unknown.** `emiAmount` 0 → **Unverifiable.**
- **S7 — legacy loan.** Down payment not linked → **financed part only:** `emi × tenure` against principal; the result is labelled accordingly.
- **S8 — recorded as no-interest.** `hasInterest` false but schedule ₹200.00 above → **flagged for review**; the check does not decide which figure is right.
- **S9 — nothing mutated.** In every case above, the stored purchase value, down payment, tenure, EMI, instalments and loan are identical before and after the check.

### 16.7 Tests for this section
All of S1–S9; rounding boundary at exactly the tolerance and one paisa beyond; deep-frozen inputs (no mutation); a legacy-loan corpus (principal, tenure, EMI present or missing) giving the stated results; a credit-card schedule with a deleted, edited or extra instalment giving **Unverifiable**; no code path adds the down payment or instalments to any budget, category or report total as a result of the check; static guard that the check is read-only (it imports no writer); **gate tests G1–G6 (§16.9) and every row of §16.8;** no zero-value expense is ever created; the reference is never read by a total, budget, report or cash-flow calculation (static guard); mutation checks that break the tolerance, the unverifiable rules and the "above is informational" rule.

### 16.8 The down-payment reference: lifecycle (defined, and each row is a test)
The down-payment expense is an **ordinary expense** whose amount and reporting never depend on the loan. The reference changes none of that. Outcomes are fixed in advance, with **no cascade, no repair rewrite and no automatic clearing**:
| Situation | Defined behaviour |
|---|---|
| **Loan missing** (dropped by a snapshot restore, a sync overwrite, a data reset, or never existed) | The expense stays exactly as it is and is counted exactly as today. The reference is **left in place** (so the link heals if the loan comes back through a later sync or restore). The screen says "EMI plan record not found"; the check is **Unverifiable: loan not found**. Nothing is deleted or rewritten. |
| **Down-payment expense deleted** | The loan is unchanged and keeps its snapshot. The check uses the recorded `downPaymentPaise` and says "down-payment expense no longer present". |
| **Loan closed** | Display unchanged; the check shows the schedule as history. |
| **Loan written off or converted to an expense** | The check says "No longer an active EMI plan: schedule check not applicable" — never a match or a mismatch. |
| **Reference to a loan with no `purchase` record** (a legacy or manually created loan) | Treated as not linked: "financed part only". |
| **Two expenses pointing at one loan** (for example a copied record) | Each shows the link; because the reference is display-only nothing is counted twice. |
| **Older app version rewrote the expense or the loan and dropped a field** | Reported as **Unverifiable**, never as a false match. |
There is **no loan delete operation in the app today** (loans only change status: closed, written off, converted to expense); a loan can disappear only through restore, sync overwrite or a reset [VERIFIED by searching for loan removal; the reset path was not traced], which is why the "loan missing" row is mandatory.

### 16.9 Mandatory verification gates (all must pass before any code writes `loan.purchase` or `emiLoanId`)
Each gate is a test run **against the current code first**, using an extra unknown field on existing records, so it can be done before any write path exists.
| Gate | What is proven |
|---|---|
| **G1 Loan removal** | the "loan missing" outcomes in §16.8, including a restore and a sync overwrite that drop a loan while the down-payment expense stays; every other row of §16.8 |
| **G2 Manual Add Loan flow** | creating and editing a loan by hand neither strips nor invents `purchase`; editing an EMI-purchase loan keeps it and triggers the staleness rule when principal, tenure or EMI change |
| **G3 Card-detail "new EMI" (`cc_emi`) flow** | loans and plans created there have no `purchase`, read as "financed part only", and are untouched by the check; the separate EMI-plan collection is not confused with it |
| **G4 Two-device sync** | a simulated two-device run (loan and expense changed on different devices, then merged or overwritten) never leaves a state the §16.8 rules do not cover, and loses neither record's fields |
| **G5 Snapshot restore** | a snapshot containing the fields restores byte-for-byte; a snapshot **older** than the loan restores to the "loan missing" behaviour |
| **G6 Older-app editing** | an older-app-style edit of the loan and of the down-payment expense (rebuilding the record from known fields only) leaves the check **Unverifiable**, with amounts and totals unchanged |
**Gate results, stage 2b (run; Chromium and simulation only, no phone):** G1–G6 all passed on the current code (14 unit and simulation tests, 7 real-app checks, and mutation checks that make them fail when a writer drops the fields). Findings that shape later stages: the **only reachable way to edit a loan is the Outlook "Loans" row**; the "Loans Taken" and "Manage Liabilities" list in `WealthPage` is **never rendered** (dead code), so it is not an entry point; `reconcileAutoEmiLoans` and the card EMI settlement rewrite loans (outstanding, repayments) but keep every other field. Not covered by a run: a real older app build, a real phone, the reset path, and the `cc_emi` creation flow beyond its static check.
**If any gate fails:** use the documented **fallback and do not widen the model** — store **nothing new** (no `loan.purchase`, no `emiLoanId`, no new collection); the check runs on the loan alone ("financed part only"); the top-level breakdown stays on the down-payment expense where one exists, and EMI purchases with no down payment show none. A new synced collection would need its own spec and approval.
The **issuer-interest formula stays unendorsed** (U-EMI-2): it is preserved as it is, and nothing here claims it is correct.

## 17. Safeguards that stay unchanged
1. The current calculation is preserved and frozen by **characterisation tests** written before any change (§15, §11).
2. In **Full** mode the typed amount is authoritative **for new entries** (§1.1, §15.2).
3. A charge with an **unknown** relationship to the EMI amount leaves the reconciliation at **Needs review**; the code **must not choose** a total (§15.5).
4. **Existing stored expenses, loans and instalments are never recomputed or rewritten** (§9, §16.3).
5. **Existing EMI accounting is preserved:** no full-purchase expense is added; the check cannot affect any total (§16.4).
6. **No synthetic zero-value expense** is created to carry metadata (§16.5).
7. **One home for purchase details:** the loan. The down-payment expense carries only a reference, which is display-only and has the defined lifecycle in §16.8.
8. **All gates in §16.9 are mandatory;** a failed gate means the fallback, not a wider data model.
9. **The issuer-interest formula remains unendorsed** (U-EMI-2).
