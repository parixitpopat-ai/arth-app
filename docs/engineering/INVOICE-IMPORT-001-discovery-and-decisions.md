# INVOICE-IMPORT-001 — discovery findings and Phase 1 decisions

Status: Phase 1 = read-only preview. Local branch `feat-invoice-discovery`; not pushed, not deployed. Evidence base: **one** real Blinkit tax invoice (one page, text layer), seen as an image and as a PDF. Everything else is marked **Unverified**.

## Evidence (verified on that one invoice)
* PDF has a text layer; no OCR needed. Parsed through pdf.js 6.4.299 (Node 22, Chromium); customer block is never read.
* Printed totals reconcile to ₹1,125.00 from the row totals and the amount in words; three rows are ₹0.01 off between taxable+tax and total (printed rounding), reported as warnings, never corrected.
* Discount is inside each item's printed line total (MRP × qty − discount = line total). There is no separate discount line.
* The three "Delivery and other charges" rows (one under each item) add to ₹13.00 and equal the annexure "Handling charge" (12.381 taxable + 0.310 CGST + 0.310 SGST = 13.001): one shared charge.
* Header: order ID (10 digits), invoice number (a different code), invoice date (ISO, no time), place of supply, seller GSTIN + FSSAI, registered-office GSTIN. No payment method, no card digits, no order time.

## Decisions (user, this phase)
| # | Decision | Status |
|---|---|---|
| 1 | Preview follows the real structure: invoice date, order ID, invoice number, items, taxes, fees, total | Implemented |
| 2 | Discounts stay inside each line's printed total; show MRP, discount, qty, line total; no negative line | Implemented |
| 3 | Repeated delivery/other-charge rows are shown as ONE handling charge only when rows and annexure verify; source rows kept | Implemented |
| 4 | Invoice date shown; editable payment date; no invented order time | Implemented (edit is local to the preview; nothing saved) |
| 5 | Probable matches are suggestions; the user selects one; similar amounts supported; never auto-linked | Implemented as suggestions; selection is local, no link is written. Tolerance (max ₹25 or 5%, ±3 days, merchant text for non-exact) is **my proposal, Unverified** |
| 6 | Uncategorised items allowed; tax and line detail preserved; line sum is not forced to equal an expense amount | Preview keeps all detail. Whether the live Add form accepts negative or fee lines is **Unverified**; domain `LineItem` rejects negatives, which this design does not need |
| 7 | Key = seller GSTIN + invoice number; order ID separate; missing identifiers and repeats handled explicitly | Implemented for this session only (no store in Phase 1) |
| 8 | No silent partial-order import, no assumed payment allocation | Preview says plainly it cannot tell from one file whether an order has other invoices; hints when a matching expense is larger. Split-invoice layouts **Unverified** (no sample) |
| 9 | Local parsing only; PDF is NOT stored (no base64 in localStorage). Retention needs its own storage design with visible save failures | Implemented (file is read in memory and dropped). Storage design **not started** |
| 10 | Actionable outcomes for unreadable / unsupported / review-required; diagnostics free of invoice contents | Implemented (status and finding codes only; in memory) |

## Still unverified (do not treat as established)
* Android WebView and Electron behaviour of pdf.js (only Node and Chromium were exercised). **No Android device or emulator is available to the coder; Android is untested.**
* Refund, credit-note, cancelled-order and split-invoice documents; Amazon and Flipkart.
* Other Blinkit layouts (IGST, multi-page, merged files). The file name says "merged"; only a single page was seen.
* The PDF-to-table reader depends on this layout's column positions; a redesign will be reported as "layout not recognised", not guessed.
* Where the invoice key will live for "already imported" to survive sync and reinstall (new synced list, like fuel fills): designed, not built.

## Deviations from the design flow (flagged)
* Entry: Settings → Data row for Phase 1, not a Quick Add row (smaller change to the frozen App.jsx; Quick Add entry is Phase 2).
* Processing shows what was actually checked after reading, not a simulated progress list.
* No category suggestions in Phase 1.

## Next deliverable
Real-phone check of the preview in the Android app (needs a debug build installed on a device), then Phase 2 design for confirmed import (storage of the key, link vs create, payment source).
