# BUG-ITM-001 — "Price/Unit" is taken literally per the entered unit, producing absurd totals for weight/volume units

`Opened 2026-09-25` · Severity: **Medium** · Status: **Open**

## Symptom

In the Itemised purchase flow (`ItemSheetModal` / item edit sheet in `AddModal`, `src/App.jsx`), entering an item with Qty `500`, Unit `g`, and Price/Unit `200` computes a line total of **₹1,00,000** (`500 × 200`), not the ₹200 the shopper actually paid for 500g of the item.

Reported via screenshot: "Paneer, 500 g @ ₹200 each" → items total ₹1,00,000, flagged against the ₹200 transaction total.

## Root cause

`src/App.jsx:3808` (and the duplicate calculations at `4645`, `4758`, `5189`):

```js
const lineItemAmount = item => (parseFloat(item.qty)||0) * (parseFloat(item.unitPrice)||0);
```

The field labeled **"PRICE/UNIT"** is multiplied by `qty` exactly as entered, with no regard to what `unit` means. For a countable unit (`nos`, pieces) this is correct — price per piece × number of pieces. For a weight/volume unit (`g`, `kg`, `ml`, `L`) it is not: a shopper who bought "500 g for ₹200" has a **total price**, or occasionally a **price per kg/L** that needs converting before multiplying by the raw gram/ml count — never a price per single gram.

This is a domain/UX mismatch between what the "Price/Unit" label implies and what a shopper naturally has in hand at the point of entry, not an arithmetic bug — the code does exactly what `qty × price-per-unit` says.

## What this ticket does NOT do

Doesn't prescribe the fix. At least two shapes are plausible and this is a product decision, not just a code change:
- Add a distinct "Total price for this line" input for weight/volume units, and back-compute the effective unit price for storage/analytics.
- Make "Price/Unit" unit-aware: for `g`/`ml`, treat entry as price-per-kg/L and convert, or offer a toggle between "per unit" and "total".

## Affected code

- `src/App.jsx:3808` — `lineItemAmount` (Itemised items total)
- `src/App.jsx:4645`, `4758` — save-time item amount recomputation
- `src/App.jsx:5189` — items-total display / mismatch-with-txn-total warning
- `src/components/` — `ItemSheetModal`'s QTY/UNIT/PRICE-PER-UNIT inputs (item add/edit sheet)

## Acceptance criteria

- A shopper entering a weight/volume-unit item (g, kg, ml, L) gets a line total that matches what they actually paid, without needing to mentally convert to price-per-gram.
- Countable-unit items (`nos`) keep their current, correct behavior unchanged.
- All four calculation sites above stay in agreement (ideally consolidated to one canonical function — this codebase already has a tracked pattern of the same formula hand-duplicated across call sites drifting apart, see `BUG-TRX-001`).
