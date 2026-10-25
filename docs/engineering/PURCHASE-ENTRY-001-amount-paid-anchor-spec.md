# PURCHASE-ENTRY-001 — Amount-paid anchor, top-level charges and discounts, optional itemisation (SPEC ONLY)

Status: **documentation only; nothing here is approved for code, push or deployment.** Separate from `INVOICE-IMPORT-006`, which depends on it for orders with discounts.
Labels: **[VERIFIED]** = read in the code or run in a throwaway script outside the repository. **[NOT VERIFIED]** = reasoned or proposed. All example amounts are invented except the Amazon figures you supplied.
Principle (owner): **the current expense model must not dictate incorrect accounting.** If it cannot represent a payment accurately, say so; never silently change the amount or misclassify a discount.

## 1. Requirement (from the owner)
- **Top = what I paid and how the amount was calculated.** Amount actually paid (the anchor, the real cash outflow), MRP if applicable, discounts including instant bank discounts, processing fees, handling/shipping/delivery, CGST/SGST/other charges, payment account, date, note, reference.
- **Bottom = what I bought and how it is categorised.** Optional itemisation; each item has a category; items can be added, edited, removed without changing the amount paid. An empty list is fine.
- **The item list never determines or silently changes the amount paid.**
- **Reconcile, don't force:** *Matches* · *₹X left to assign* · *items exceed what was paid by ₹X; resolve*. No double-counted charges; no discount counted twice.
- **Standard** = one expense, amount paid. **Itemised** = the same single expense with optional item detail. Switching never changes the total or creates a second expense.

## 2. How the app behaves today [VERIFIED by reading the code unless stated]
1. Typing an **MRP** in the price breakdown makes the **saved amount** = MRP − discount + processing fee + EMI interest + GST on interest. It replaces the typed Amount. Shipping, handling and CGST/SGST are not part of it.
2. **Itemised needs an exact match:** items + charge lines must equal the typed amount, or Save is blocked. A partial item list cannot be saved.
3. **Charges are stored as lines** (`kind: "charge"`, with a type) inside the item list. Standard mode has no place for them. A discount has **no line representation**.
4. **Items can change the amount:** switching Itemised → Standard sets the amount to the items total; with no amount typed, the items' sum fills it.
5. **Category reporting reads raw item amounts.** It is correct today only because items must equal the total.
6. A top-level **discount, processing fee, MRP and interest** are already stored on an expense (`priceDiscount`, `priceProcessingFee`, `priceMrp`, `priceInterestAmt`…). Today they feed the computed total and are displayed on the detail screen.
7. **A negative line is unsafe** (INVOICE-IMPORT-006 §4.1): the item form drops a minus sign on edit; a category rollup puts the whole discount on one category; charge sharing skips non-positive charges. The domain `LineItem` class rejects negatives.
8. Undo and sync treat line items as generic data (undo compares stored JSON) [undo VERIFIED; two-device sync NOT RUN].

## 3. Proposed model (additive; smallest safe change) [NOT VERIFIED — proposal]
**Amount paid stays `amount`.** Nothing recomputes it. Because it is unchanged, **an older app version reading new data still shows the correct amount** — a deliberate safety property.
**New optional top-level record** on an expense, e.g. `purchase`:
- `adjustments`: a list of `{ kind: "charge" | "discount", type, label, amountPaise }` where **every amount is positive and the sign comes from `kind`**. A discount is stored once, as a positive number under `kind: "discount"`, and subtracted by the calculation. **No negative numbers are ever stored**, which avoids every §2.7 failure by construction.
- charge types as today (handling, delivery, platform fee, CGST, SGST, other) plus a *processing fee* and a *discount* type list (instant bank discount, coupon, other).
- `mrp` (optional): the pre-discount list price, informational.
**Items** stay in the existing line-item list and are **items only** from now on.
**Legacy fields are read, not rewritten** (§8). If `purchase` exists it takes precedence over legacy `priceDiscount`, `priceProcessingFee` and charge lines, so nothing is counted twice.

## 4. The reconciliation function (pure, tested) [proposal]
`reconcilePurchase({ paidPaise, items, adjustments })` returns:
`itemsPaise`, `chargesPaise`, `discountsPaise`, `explainedPaise = itemsPaise + chargesPaise − discountsPaise`, `differencePaise = paidPaise − explainedPaise`, and a state:
- **Matches** when the difference is zero and items exist; **Explained without items** when there are no items (Standard with a breakdown);
- **₹X left to assign** when `differencePaise > 0` and there are items (partial itemisation);
- **Items exceed what was paid by ₹X** when `differencePaise < 0`, which blocks Save until resolved.
Rules: whole paise only; each charge and discount counted once; the function never alters `paid`; an already-included discount (a price printed net of discount) is not entered again, which is why `mrp` is informational and items are entered at the price actually charged.

### Worked cases (your Amazon order)
Items 329.00 + 969.00 + 1,249.00 = **2,547.00**; shipping 50.00 + processing fees 9.00 = **59.00** charges; instant bank discount **134.11**; paid **2,471.89**.
- **A, complete:** 2,547.00 + 59.00 − 134.11 = 2,471.89 → **Matches.**
- **B, partial:** only the 969.00 item entered: 969.00 + 59.00 − 134.11 = 893.89 → **₹1,578.00 left to assign** (2,471.89 − 893.89). Saves normally; the remainder reports under the top-level category.
- **C, none:** no items; adjustments only → explained 2,471.89, **no itemisation**.
- **D, over:** items total 2,700.00: 2,700.00 + 59.00 − 134.11 = 2,624.89 → **exceeds what was paid by ₹153.00** (2,624.89 − 2,471.89 = 153.00). Save blocked; amount untouched.
- **E, double-count guard:** the same ₹134.11 discount entered as a discount and as a reduction of item prices would show as **exceeds by ₹134.11**, never silently accepted.

## 5. Category allocation (reporting)
- Reports must **sum to the amount paid exactly**. Items carry list prices, so the **net of shipping, fees and discount is spread over items in proportion to item price, rounded to the paisa with the leftover paisa given by largest remainder**, and labelled **allocated** (never presented as seller-confirmed pricing). For case A the net adjustment is 59.00 − 134.11 = −75.11, giving 319.30 / 940.42 / 1,212.17 = 2,471.89 [VERIFIED arithmetic].
- **Partial itemisation:** the unassigned remainder reports under the expense's **top-level category**.
- **Uncategorised items:** report under the top-level category and keep a flag that they were not individually categorised, so the screen can say so (INVOICE-IMPORT-006 §8).
- Existing exact-match itemised expenses keep today's rollup (their adjustments are zero), so their reports do not change.

## 6. People / group splits
- Charges are shared **equally by the number of splits, the payer included**, as today [VERIFIED, `chargeShare`].
- **Discounts** need a rule — see decision 3. Whatever is chosen, shares must add back to the amount paid exactly.

## 7. Standard ↔ Itemised
Switching changes only which sections show. It **never** changes `amount`, never creates a second expense, and the silent "amount = items total" behaviours (§2.4) are removed; setting the amount from the items stays an explicit button. Going to Standard asks before dropping items, as it does now, and keeps the adjustments.

## 8. Preserving existing expenses
- **No migration and no rewrite on load.** Every existing expense keeps its stored `amount` and fields.
- **Read adapters:** an expense with legacy `priceDiscount` / `priceProcessingFee` / charge lines is shown in the new top block by mapping those fields; the new reconcile line shows *Matches* or the exact difference. Old expenses that used the computed MRP total keep their stored amount.
- **Editing and saving** an old expense writes the new `purchase` record only after you edit the top section, and legacy fields are then ignored (precedence rule §3), never both counted.
- **Tests required:** a corpus of synthetic expenses in every legacy shape must load, display, report and undo identically before and after.

## 9. Phone-width top block (390 px) — proposal
```
Amount paid        ₹ 2,471.89            ← the anchor
Paid via  Card ••1017   Date  25/10/2026
Note · Reference
▼ Breakdown (optional)
  MRP / items price   2,547.00
  − Discount          134.11   [Instant bank ▾]
  + Shipping           50.00
  + Processing fee      9.00
  + CGST / SGST / Other  …
  ─────────────────────────
  Explained 2,471.89  ✔ Matches
Standard | Itemised
▼ Items (optional)       ₹1,578.00 left to assign
```
## 10. Remaining unknowns [NOT VERIFIED]
Behaviour of reports, budget and insights on the new shape; sync size and two-device behaviour of `purchase`; how the old APK renders it; the item form's handling of a purchase with partial items; EMI interest in "Full" mode; whether other screens read `priceDiscount`.

## 11. Decisions needed (recommendations)
1. **EMI interest.** Keep the computed total only when "EMI" is selected; in "Full" the typed amount is authoritative. *Recommend yes.*
2. **Top-level charges.** Store them in the new `purchase.adjustments` list so Standard expenses can have them. *Recommend yes.*
3. **Discount and people-splits.** Reduce each person's share in proportion to their items, or keep the discount with the payer. *Recommend proportional; your call.*
4. **Remainder category.** Unassigned remainder under the top-level category. *Recommend yes.*

## 12. Testing plan
Unit tests for `reconcilePurchase` (cases A–E, paise rounding, no mutation of `paid`); allocation sums to paid for many random cases; legacy corpus (§8); sign-safety (no negative stored); mode-switch tests (amount unchanged); mutation checks; browser tests at phone width on synthetic data; two-device sync simulation; real-phone verification kept separate and not claimed from desktop tests.
