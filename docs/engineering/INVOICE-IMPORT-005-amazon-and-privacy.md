# INVOICE-IMPORT-005 — Amazon.in invoices (preview only) and invoice privacy rules

Status: preview built locally and tested; **confirm/import for Amazon is deliberately not built** (see §4). Nothing here is pushed or deployed.
Evidence labels: **[VERIFIED]** = observed in a test or in a real file; **[NOT VERIFIED]** = reasoned only.

## 1. Privacy rules for every invoice reader (Blinkit, Amazon, later ones)
An invoice PDF holds the buyer's name, address and sometimes phone or e-mail; order and payment ids that tie to the buyer's account; seller PAN/GSTIN (a sole trader's GSTIN contains their PAN); and a purchase history. Rules:
1. **Read on the device only.** pdf.js text layer, no upload, no OCR. A picture-only page is reported as "needs OCR" and not read. Any future OCR must run on the device or ask first; a cloud OCR would send the whole page, including the buyer block.
2. **Never read the buyer.** Only the seller column and the item table are read. The Billing/Shipping address, buyer name, phone/e-mail, payment transaction ids and payment mode are never read, returned, shown, stored or logged. [VERIFIED by tests on synthetic pages that carry fake buyer data, and by a screen test of the whole path.]
3. **Store the minimum, and hash keys.** The synced import record must not hold the order number, invoice number or seller GSTIN in the clear. `amazonKeys` returns 32-hex-character SHA-256 prefixes for the duplicate key and the order key; the readable ids stay on the device, in memory, while the preview is open. [VERIFIED for the key function. The record writer for Amazon does not exist yet; the Blinkit record still stores `sellerGstin`, `invoiceNumber` and `orderId` in the clear. NOT changed here: see §5.]
4. **No PDF is kept** and the screen holds readings in memory only (cleared with the screen). [VERIFIED: a browser test shows localStorage byte-for-byte unchanged after reading.]
5. **Outside the app's control:** the PDF in Downloads, browser cache, screenshots of the preview. The app can say so; it cannot clear them. [NOT VERIFIED] whether error paths, crash reports or logs could carry invoice text; to be checked before any further reader.

## 2. What the Amazon reader reads (single real order seen)
One real order, two invoices in one PDF: Amazon Seller Services "Offer Processing Fees" (₹2.82 + 18% IGST = ₹3.33) and one seller's single-item invoice (₹821.19 + 18% IGST = ₹969.00).
- Read: invoice number, order number, invoice date, seller name (the left-most cell under "Sold By" only), seller GSTIN, and the item table: description, ASIN, HSN, quantity, unit price, net, tax rate, tax, total, plus the invoice's own TOTAL line.
- Checks (never "corrected"): quantity × unit = net; net + tax = total; tax = rate × net (±2 paise); rows add up to the declared TOTAL. A failure makes the invoice "needs review" and not importable.
- Amazon's own processing-fee invoice is a **charge** (type "other", GST included); shipping/delivery/handling words map to those charge types.
- **Only single-row invoices have been seen.** An invoice with several rows is reported as unverified and its row descriptions are not read.
- Invoices of one order, from one or several PDFs, are grouped by order number and de-duplicated by invoice number. The group lists what is **not** on the invoices: shipping billed outside them, discounts (including instant bank discounts) and other sellers' invoices. [VERIFIED on the real PDF: fee ₹3.33 + item ₹969.00 = ₹972.33, supported, no findings. NOT VERIFIED: shipping, discounts, multi-row invoices, other sellers, promotion-paid orders.]
- Real-file readings are checked with a throwaway script that prints amounts only; the real PDF is not in the repository. Tests use invented pages.

## 3. Screen
Import invoice → a PDF that is not a Blinkit invoice is tried as Amazon. The Amazon preview shows the privacy note, each order with its rows (item or charge, seller, quantity, tax), items, fees on invoices, **invoiced total**, a note that this is not necessarily what was paid, and "Add another invoice from this order" / "Clear". No Confirm button.

## 4. Why there is no Amazon confirm yet
The amount paid is not on these invoices (shipping and instant discounts are missing; the payment block is not read, by rule). Creating an expense from the invoiced total would record the wrong cash outflow. The agreed behaviour (amount paid is the anchor, items underneath, reconcile with "Matches / ₹X left to assign") needs the purchase-entry change, whose four decisions are still open. Confirm for Amazon follows that change.

## 5. Open items
1. Blinkit's saved import record still holds `sellerGstin`, `invoiceNumber`, `orderId` in the clear. Moving it to hashed keys is a data-format change that needs its own migration decision (existing records, duplicate checks across devices).
2. Error/log/crash-report check for invoice text.
3. More real Amazon invoices (multi-row, shipping line, promotion payment, other sellers) before the layout is called verified.
4. Phone verification of the screen. Chromium only so far.

## 6. Tests
`amazonInvoice.test.js` (9), `amazonPdf.test.js` (4, through real PDFs made by the test-only `pdfMaker`, which now writes ₹), `tools/invoice-import/amazon-browser.mjs` (A1–A13, Chromium, synthetic data). Mutation checks: reading the whole line beside the seller, skipping the net+tax check, skipping the declared-total check and un-hashing the keys each fail a test.
