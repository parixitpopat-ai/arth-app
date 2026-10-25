# INVOICE-IMPORT-006 — Orders with many invoices: inputs, order summary, reconciliation, bulk categorisation (SPEC ONLY)

Status: **specification for review. No code, commit-to-main, push or deployment is approved.** Builds on INVOICE-IMPORT-005 (privacy rules, single-invoice Amazon reader) and on the purchase-entry behaviour agreed in conversation (amount paid is the anchor; items are optional detail underneath).
Labels: **[VERIFIED]** = seen in the code or a real file. **[NOT VERIFIED]** = reasoned or proposed. All amounts in examples are **invented** (synthetic), except where a real figure is named.

## 1. Facts about today's app that shape the design [VERIFIED in code]
- The importer takes **one PDF per pick**, up to **10 pages and 10 MB**. Merged PDFs of hundreds of pages and ZIPs are not supported today.
- **No ZIP library** is installed (only `pdfjs-dist` for PDFs). ZIP support needs a new dependency, which is a decision (§11).
- The item catalogue remembers a category by **exact item name** (case-insensitive) only. There is no memory by product id, by seller, or by product type.
- The Amazon reader built so far reads **single-row invoices only** and has no order-summary reader.

## 2. How documents arrive (all three, mixed, in one session)
1. **Several PDFs selected together.** 2. **One merged PDF** (each page read as its own document). 3. **A ZIP of PDFs.**
- Every file, ZIP entry and PDF page is **classified separately**: Blinkit invoice, Amazon invoice, Amazon order summary, picture-only (needs OCR), password-protected, too large, not a supported document. Formats can be mixed.
- **Sequential, in memory, with progress** ("Reading 14 of 338"). Each page's text is dropped as soon as its fields are parsed; only the parsed rows are kept. The PDF bytes are not kept.
- **ZIP safety** (proposal, to be measured): only `.pdf` entries; no nested ZIPs; limits on entry count and total uncompressed size (a ZIP-bomb guard); entry names are never trusted or stored.
- **Outcome list**, never silent: every file/page ends as *read*, *exact duplicate*, *probable duplicate*, *unreadable*, *needs OCR*, *unsupported*, *skipped (too large)* or *password-protected*, reported by position ("File 14"), not by file name (file names can contain a name or order number).
- Limits (10 pages / 10 MB per PDF today) are raised per file only after a phone memory/time measurement; the numbers in the final spec come from that measurement, not from guesses here.

## 3. Order summary (source of truth for the order total)
- **Not built and not guessed.** No reader exists until you provide a sample (names, address, phone and card details blanked). Until then the layout is unknown.
- When built, it is an **allow-list reader**: it extracts only the fields needed — order number, seller (if shown per shipment), item totals, shipping, fees, promotions/discounts, refunds if any, grand total — and ignores every other line. Name, address, phone, e-mail, payment transaction ids and the full payment details are not read, returned, shown, stored or logged. A test with invented buyer data must fail if any appears.
- **Card last four digits** may be read only to *suggest* which Arth account paid. The suggestion is shown for your confirmation; Arth never selects the account silently.
- The summary is the **source of truth for the order's total**. Invoices reconcile against it.
- **No summary:** the invoices are still imported, and the order's overall reconciliation is labelled **"Unverified: no order summary"**. The amount paid is then what you type.

## 4. Reconciliation (exact discrepancy, by component)
Compared per order: **Items · Fees · Shipping · Promotions/discounts · Refunds · Grand total**. Components that appear only on the summary (shipping, instant discounts are often not on any invoice) are marked *summary-only*, not as a mismatch. A mismatch is always shown as an exact rupee figure with its direction. States: **Matches** · **₹X not covered by any invoice read** · **Invoices exceed the summary by ₹X** · **Unverified (no summary)**. Nothing is silently corrected; the amount paid is never changed to force a match. Shared fees and discounts follow the allocation rule from the purchase-entry spec; where a receipt gives no net price per item the share is labelled **allocated**, not Amazon-confirmed.

### Example A — everything reconciles (synthetic, mirroring your Amazon order)
| Component | Order summary | Invoices read | Result |
|---|---|---|---|
| Items | 2,547.00 | 329.00 + 969.00 + 1,249.00 = 2,547.00 | 0.00 difference |
| Fees | 9.00 | 3 fee invoices × 3.00 = 9.00 | 0.00 |
| Shipping | 50.00 | not on invoices | summary-only |
| Instant bank discount | −134.11 | not on invoices | summary-only |
| **Grand total** | **2,471.89** | 2,547.00 + 9.00 + 50.00 − 134.11 = 2,471.89 | **Matches** |
The expense is one ₹2,471.89 payment. (In your real file a fee invoice is ₹3.33; three of them would be ₹9.99 and the screen would show a ₹0.99 difference against a ₹9.00 summary fee line. That is the behaviour wanted: show it, don't hide it.)

### Example B — an invoice is missing
Summary items 2,547.00; invoices read 329.00 + 969.00 = 1,298.00. Result: **₹1,249.00 not covered by any invoice read** (prompt: add the other invoices). Grand total still comes from the summary; the expense is still ₹2,471.89.

### Example C — invoices exceed the summary
Summary items 2,547.00; invoices read total 2,600.00 → **Invoices exceed the summary by ₹53.00**, with a hint if a probable duplicate or another order's invoice is present. Nothing is dropped automatically.

### Example D — no order summary, 338 invoices
Overall total shows **"Unverified: no order summary"**. Every invoice is still imported and grouped. The amount paid is typed by you, and the screen shows the invoiced total beside it with the exact difference.

## 5. Grouping, duplicates, and one payment = one expense
- Invoices are **grouped by order number**; any number per order. Order and invoice numbers are held in memory for the session and, if saved at all, saved only as hashed keys (INVOICE-IMPORT-005 §1).
- **Exact repeats** (same file fingerprint, or same seller + invoice number) are counted once and listed as duplicates. **Probable duplicates** (same seller, date, amounts and description but different invoice numbers) are **kept and flagged for you to decide**. Distinct invoices are never discarded automatically.
- **One actual payment is one expense.** A second import of the same order links to or updates that expense and never creates another. Before creating, Arth also looks for an existing same-amount expense, as the Blinkit flow does.
- **Invoices are supporting evidence:** the expense keeps compact evidence records (hashed key, seller name, date, total, line summary), not PDFs. **PDFs are never persisted** unless you explicitly approve it later. [NOT VERIFIED: sync size of several hundred evidence records; to be measured before the record shape is final.]

## 6. Summary screen (details collapsed by default)
```
Amazon order · 25 Oct 2026            Summary: ₹2,471.89   [Matches]
 Read 331 · Exact duplicates 4 · Probable duplicates 2 · Unreadable 1 · Needs OCR 1 · Unsupported 1 · Items to review 57
 ▸ Seller A            12 items        ₹ 9,420.00
 ▸ Seller B             3 items        ₹ 2,150.00
 ▸ Processing fees × 120               ₹   399.60   (each source invoice listed when expanded)
 ▸ Shipping / discounts (summary only) ₹  −84.11
```
Fee invoices combine into one line with the count and total, **keeping every source invoice and amount** for audit. (Counts above are illustrative: 338 files = 4 exact duplicates + 331 read + 3 not readable; 331 = 211 item invoices + 120 fee invoices; 120 × ₹3.33 = ₹399.60.)

## 7. Bulk categorisation (priority order; no seller-wide dumping)
1. **Exact product** remembered (product id such as ASIN when printed, else exact normalised name), if the match is reliable → pre-filled, shown as *remembered*.
2. **Same seller and product type** remembered, only if reliable → shown as a **suggestion to review**, not pre-filled.
3. **Seller-based suggestion** only where that seller's previously categorised products consistently belong to one category → a **suggestion to review**, and never applied to every product of a seller automatically.
4. Otherwise **left for review** (uncategorised).
- Reliability thresholds are **proposals [NOT VERIFIED]** and need your approval and testing on your own history: rule 2 needs ≥ 60% word overlap with an earlier item from the same seller, all earlier matches agreeing; rule 3 needs ≥ 5 earlier items from the seller with ≥ 90% in one category. Product type has no taxonomy on invoices, so it is derived from the item words; that is the weakest rule.
- The review screen groups items as **Remembered (n) · Suggested, review (n) · Needs a category (n)**, with bulk apply per group or selection, per-item correction, and nothing saved until you confirm.
- **Learning after save:** the exact product, and seller + product type, are remembered. A seller-wide default is never written.
- **Items still uncategorised at save** fall to the order's category (as the Blinkit flow does today) and stay marked uncategorised for later review. [Decision, §11.]

## 8. Flow
1. Choose files / a merged PDF / a ZIP (and optionally the order summary).
2. Progress; outcome list. 3. Order cards (collapsed) with reconciliation state and counts.
4. Resolve: probable duplicates, unreadable files, missing invoices. 5. Review categories in the three groups.
6. Account step: suggestion from the card's last four digits (if read) for you to confirm; otherwise you choose.
7. Confirm → one expense (amount = summary grand total, or the typed amount when unverified), items/charges beneath, invoices linked as evidence. Nothing is created before Confirm.

## 9. Privacy (additions to INVOICE-IMPORT-005)
Buyer block and payment details are never read; the card's last four are optional and confirm-only; file names, order numbers and invoice numbers are not logged; no PDF or ZIP is kept; all processing is on the device. Tests with invented buyer data cover the order-summary reader, the ZIP path, and the merged-PDF path.

## 10. Verification plan (before anything ships)
Unit tests for each reconciliation state and Examples A–D; a synthetic **338-document stress test** for memory and time (Chromium first, then a phone); duplicate/probable-duplicate tests that prove no distinct invoice is dropped; categorisation tests proving a seller's products are never all assigned one category; ZIP-bomb and malformed-ZIP tests; mutation checks on the reconcile function and the privacy guard. Phone verification is separate and not claimed from Chromium.

## 11. Decisions needed from you
1. **ZIP dependency:** add a small ZIP library (new dependency), or support ZIP later.
2. **Thresholds** in §7 (60% / 5 items / 90%) and whether rules 2–3 only ever suggest.
3. **Uncategorised at save:** fall to the order category (proposed), or block saving until categorised.
4. **Evidence record shape and size** after the sync-size measurement.
5. **Order summary sample** (blanked) so its reader can be specified.
6. **Purchase-entry decisions** (EMI interest, top-level charges storage, discount splitting, remainder category) remain open and block Confirm.
