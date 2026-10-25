# PURCHASE-ENTRY-001 — Amount-paid anchor, top-level charges and discounts, optional itemisation (SPEC AND IMPLEMENTATION PLAN, revision 3)

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
9. The EMI tests listed in §15.
10. Mutation checks on each rule; phone-width browser tests on synthetic data; real-phone verification kept separate and not claimed from desktop tests.

## 12. Scope separation from INVOICE-IMPORT-006
This spec does not build invoice import. **Until it is implemented and verified, invoice import must not alter or misrepresent a discounted purchase:** an order with a discount or promotion is previewed with its reconciliation and **Confirm is withheld** (INVOICE-IMPORT-006 §4.1–4.2). The import later writes the same `purchase` record through the same functions and adds no accounting logic of its own.

## 13. Implementation plan (for your approval; nothing started)
Each stage is its own change, tested and reviewed before the next; none is pushed or deployed without your explicit approval.
1. **Characterisation first:** capture the golden outputs of §11.1 and commit only tests. No behaviour change.
2. **Pure functions:** `readPurchase`, `reconcilePurchase`, `allocatePurchase`, with tests; no screen uses them yet.
3. **Readers:** repoint the three item-level readers and the two detail views through `netPaise` and `readPurchase`; the characterisation tests must still pass.
4. **Form, top block:** the new top section (amount paid, charges, discounts, breakdown, EMI mode) behind a switch that stays off in production builds until verified.
5. **Form, itemisation:** partial save, "incomplete" marking, remainder to the top-level category, mode-switching rules.
6. **People/groups, Undo, boundary and sync tests;** old-APK compatibility check.
7. **Phone verification** (separate from desktop tests), then a release decision by you.
Each stage reports the tests run, what was not verified, and a before/after table of any figure that changed (none are expected).

## 14. Remaining unknowns [NOT VERIFIED]
- **EMI:** resolved in §15 (owner decision); two unknowns remain there (U-EMI-1, U-EMI-2).
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
- **U-EMI-1:** in EMI mode the saved `amount` is the full purchase value and the cash paid today is only the down payment; the rest is financed. So "amount actually paid" here means the **total payable** (down payment + EMIs), not today's cash. Whether you want that total checked against tenure × EMI + down payment is not decided.
- **U-EMI-2:** whether the calculation's one-month interest matches how your card issuers actually bill EMI interest. It is preserved as is, not endorsed.
