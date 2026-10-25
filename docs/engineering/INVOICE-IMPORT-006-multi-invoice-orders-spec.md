# INVOICE-IMPORT-006 — Orders with many invoices: inputs, order summary, reconciliation, categorisation (SPEC ONLY, revision 2)

Status: **documentation only. No code change, implementation commit, push to `main` or deployment is authorised.** Builds on INVOICE-IMPORT-005 (privacy rules, single-invoice Amazon reader, preview only).
Out of scope for this increment: the **Standard/Itemised purchase-entry redesign** (amount paid at the top, items underneath). Its four open decisions need their own reviewed spec (§12).
Labels: **[VERIFIED]** = seen in the code or a real file. **[NOT VERIFIED]** = reasoned or proposed. Every amount in an example is **invented**, except where a real figure is named.

## 1. Facts about today's app that constrain the design [VERIFIED in code]
- The importer takes **one PDF per pick**, up to **10 pages and 10 MB**.
- **No ZIP library** is installed (only `pdfjs-dist`).
- Item categories are remembered by **exact item name** only (case-insensitive). Nothing is remembered by product id, product type or seller.
- Brand stripping uses a **starter brand list that is grocery-oriented and unverified** (Lay's, Haldiram's, Amul…). It knows no brands for batteries, cushions or pillows, so product-type extraction for Amazon items cannot reuse it as is.
- An itemised expense today must have its lines add up **exactly** to its total, or Save is blocked. Whether a **negative line** (a discount) is accepted by the item form is [NOT VERIFIED].
- The Amazon reader built in 005 reads **single-row invoices only** and there is **no order-summary reader**.

## 2. Inputs (decision 1)
Supported, alone or **mixed in one selection**: (a) several PDFs chosen together, (b) one merged PDF (each page read as its own document), (c) a ZIP of PDFs.
- Every file, ZIP entry and page is classified separately: Blinkit invoice, Amazon invoice, Amazon order summary, picture-only (needs OCR), password-protected, too large, unsupported. Formats need not match.
- **Sequential, in memory, visible progress** ("Reading 14 of 338"). A page's text is dropped once its fields are parsed; only parsed rows are kept.
- **Clear per-file outcome**, reported by position ("File 14"), never by file name: *read · exact duplicate · probable duplicate · unreadable · needs OCR · unsupported · skipped (too large) · password-protected*. A skipped file is never silently ignored.
- **Limits are not raised yet.** Today's 10 pages / 10 MB per PDF stay in force until measured on a real Android phone. **Proposed candidates, for measurement only [NOT VERIFIED]:** merged PDF up to 500 pages and 50 MB; ZIP up to 400 entries and 100 MB uncompressed. The numbers that ship come from the measurement in §11, not from these.
- **ZIP dependency gate.** A ZIP library is added only after a written check of: *maintenance* (recent releases, open security issues), *bundle size* (added kB and whether it loads only when a ZIP is chosen), *security* (known advisories, protection against ZIP bombs and path tricks, no code execution), *compatibility* (Android WebView and the app's build), and *licence*. Candidate libraries are not named or chosen until that check is done. Until then ZIP input is documented and not built.
- **ZIP safety rules** (whichever library): only `.pdf` entries; no nested ZIPs; caps on entry count and total uncompressed size; entry names are never trusted, shown or stored.

## 3. Order summary (decision 4)
- **No reader is specified or built until you supply a real sample** (name, address, phone and card details blanked). Its layout is unknown; nothing here guesses it.
- Once a reader has been **validated against a real sample**, the summary is the **source of truth for the order total**, and the invoices reconcile against it.
- It is an **allow-list reader**: order number, seller, item totals, shipping, fees, promotions/discounts, refunds if applicable, grand total. Every other line is ignored.
- **Without a summary** the invoices can still be imported and the total is labelled **"Unverified — no order summary"**; the amount paid is whatever you type.

## 4. Reconciliation rules
Per order, by component: **Items · Fees · Shipping · Promotions/discounts · Refunds · Grand total**. Components that only the summary carries (shipping, an instant bank discount) are marked *summary-only*, not as errors. A mismatch is an exact rupee figure with a direction. Never corrected silently; the amount paid is never changed to force a match.
States: **Matches · Missing coverage ₹X (not on any invoice read) · Invoices exceed the summary by ₹X · Unreadable files n · Unresolved items n · Unverified — no order summary.**
**Amounts and the expense model in this increment.** The purchase-entry redesign is out, so an imported order must fit **today's** expense model: one expense, lines that add up exactly to its amount. Shipping and fees from the summary become charge lines. A discount can only be represented in one of two ways: (a) a negative line — [NOT VERIFIED] that the form accepts it — or (b) an **allocated** reduction of the item amounts, shown as "allocated", never as the seller's confirmed net price. Which one is used is an open decision (§12).

## 5. Duplicates, one payment = one expense, evidence (decision 4)
- **Exact repeats** (same file fingerprint, or same seller + invoice number) are **counted once** and listed.
- **Probable duplicates** (same seller, date, amounts and description, different invoice numbers) are **kept and flagged for your review**. Distinct invoices are never discarded automatically.
- **One actual payment remains one expense.** Re-importing an order links to the existing expense and never creates a second. Before creating, Arth also looks for an existing same-amount expense, as the Blinkit flow does.
- **Invoices are linked supporting evidence**, stored as compact records (hashed keys, seller name, date, totals, line summary), never as PDFs. [NOT VERIFIED] the sync size of several hundred such records; measured before the shape is final.
- **Repeated processing-fee lines may be grouped for display** ("Processing fees × N · ₹T"). Every source invoice and its amount stays in the data and is listed when the group is expanded.

## 6. Privacy (decision 5)
All reading is on the device; PDFs, ZIPs and page text are not persisted. Names, addresses, phone numbers and full payment details are never read, returned, shown or logged. File names, order numbers and invoice numbers are not logged. **Card last four digits** may be read only to *suggest* an account, shown for your confirmation; they never select an account. Tests with invented buyer data must cover the invoice reader, the order-summary reader, the merged-PDF path and the ZIP path.

## 7. Categorisation (decision 2)
Rules, in priority order:
1. **Exact product match** from remembered categories (product id such as an ASIN when printed, otherwise exact normalised name) → **may be prefilled**, shown as "remembered".
2. **Same seller + same product type** → a **suggestion only**.
3. **Seller-based** → a **suggestion only**, and only where that seller's earlier products consistently sit in one category.
4. Otherwise **left for review**.
Never "all products from this seller get one category". Nothing similar or seller-based is applied without your action.

### 7.1 What "product type" means (your Lays / cushions question)
Yes: for "Lay's Magic Masala Chips 52 g" the type word is **chips**; for "Reliance Bamboo Cushions" it is **cushions**. The rule is: remove the brand, size/quantity/colour words and pack words; keep the **head noun**; compare singular and plural as the same (*cushion/cushions*). Two honest limits:
- **Brand removal is the weak step.** The starter list knows grocery brands only. "Reliance" and "Envie" are unknown to it, and "Bamboo" is a material, not a brand or a type. So the type word is **proposed to you the first time and confirmed or edited by you**, then remembered; it is not guessed silently.
- **Titles with two products** ("Charger + 4X AA Batteries") have two type words. Such items are left for review, not split automatically.
Product type is therefore the weakest rule; that is why rule 2 only suggests.

### 7.2 Thresholds are unvalidated — how they will be tested
The earlier figures (60% word overlap, at least 5 seller items, 90% agreement) are **proposals only and must not ship**. Process: (1) build the suggestion engine to run **silently** (shadow mode) over your own past categorised items and over a synthetic set; (2) compare each suggestion with the category you actually chose; (3) report precision and coverage per rule and per threshold, including failure examples (brand words, materials, two-product titles); (4) you review that report and set the production thresholds; (5) only then do suggestions appear on screen. No target number is promised before the data is seen.

## 8. Uncategorised items (decision 3)
- The import **can be saved with uncategorised items.**
- **Reporting fallback:** each uncategorised item reports under the **order's category**. The fact that it was **not individually categorised is preserved** on the item (a "category source" of *chosen*, *remembered* or *order fallback*), so it can be reviewed later and never looks the same as a deliberate choice.
- **Before Confirm** the screen shows the count — "**57 of 211 items are not individually categorised**" — and the wording never implies a finished itemisation ("Itemisation incomplete" until the count is 0).
- Because today's form blocks saving while an item is uncategorised, this needs a deliberate change in the import path only; the existing manual form is untouched. [NOT VERIFIED] how reports treat an item with no own category until built and tested.

## 9. Phone-width flow (390 px wide; every screen has one clear action)
```
1  Choose            2  Reading            3  Orders
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│ Import       │    │ Reading      │    │ Amazon order     │
│ invoices     │    │ 14 of 338    │    │ 25 Oct 2026      │
│ [Choose files│    │ ▓▓░░░░░░     │    │ Summary ₹2,471.89│
│  PDF / ZIP]  │    │ Read 12      │    │ ✔ Matches        │
│ + order      │    │ Duplicate 1  │    │ Read 331 · Dup 4 │
│   summary    │    │ Unreadable 1 │    │ Probable dup 2 ▸ │
│ Not stored   │    │ [Cancel]     │    │ Unreadable 1 ▸   │
└──────────────┘    └──────────────┘    │ ▸ Seller A  12   │
                                        │ ▸ Fees ×120 ₹399 │
4  Categories         5  Confirm        │ [Review items]   │
┌──────────────┐    ┌──────────────┐    └──────────────────┘
│ Remembered 90│    │ One expense  │
│ Suggested 64▸│    │ ₹2,471.89    │
│ Needs cat 57▸│    │ Paid from:   │
│ [Apply to    │    │ ◻ Card ••1017│
│  selected]   │    │  (suggested; │
│ Nothing saved│    │  you confirm)│
│ until Confirm│    │ 57 of 211    │
└──────────────┘    │ items not    │
                    │ categorised  │
                    │ [Confirm]    │
                    └──────────────┘
```
Order cards and seller groups are collapsed by default; counts are tappable; targets are at least 44 px. [NOT VERIFIED] on a real phone.

## 10. Worked reconciliation cases (invented figures)
**A — Matches** (mirrors your Amazon order): summary items 2,547.00, fees 9.00, shipping 50.00, instant discount −134.11. Invoices: 329.00 + 969.00 + 1,249.00 = 2,547.00; three fee invoices × 3.00 = 9.00. Shipping and the discount are *summary-only*. 2,547.00 + 9.00 + 50.00 − 134.11 = **2,471.89 = grand total → Matches.** One expense of 2,471.89. (Your real fee invoice is ₹3.33; three would be 9.99, shown as a 0.99 difference against a 9.00 summary fee line.)
**B — Missing coverage:** summary items 2,547.00; invoices read 329.00 + 969.00 = 1,298.00 → **Missing coverage ₹1,249.00.** The expense is still the summary total; the missing items are listed as unresolved.
**C — Invoices exceed the summary:** summary items 2,547.00; invoices total 2,600.00 → **exceed by ₹53.00**, with a probable-duplicate hint if one exists.
**D — No summary:** total shows **"Unverified — no order summary"**; you type the amount paid; the invoiced total and exact difference are shown beside it.
**E — Unreadable file:** a picture-only invoice worth an unknown amount: the order shows "Unreadable files 1" and, if a summary exists, the missing coverage is reported as the exact gap, not attributed to that file.
**F — Probable duplicate:** two invoices, same seller, date, ₹969.00, different numbers: both kept, flagged; the total shows both until you mark one. Exact repeat: same seller + number → counted once.
**G — Refund** (only if the summary shows one, layout unknown): items 2,547.00, refund −329.00 → net items 2,218.00 reconciled against the summary's net.
**H — Large order:** 338 files = 4 exact duplicates + 331 read + 3 not readable; 331 = 211 item invoices + 120 fee invoices; 120 × 3.33 = ₹399.60 shown as one grouped line with 120 source invoices kept.

## 11. Testing plan and unknowns
**Unknowns (all [NOT VERIFIED]):** the order-summary layout; multi-row and multi-page Amazon invoices; shipping lines on invoices; promotion-paid orders; whether the item form accepts a negative line; how reports treat items with no own category; the sync size of evidence records; real-phone memory and time for hundreds of pages; the chosen ZIP library; all categorisation thresholds.
**Tests before anything ships:**
1. Unit tests for every reconciliation state and cases A–H.
2. Privacy tests with invented buyer data on every reader and input path; mutation checks that break each rule and must fail a test.
3. Duplicate tests proving no distinct invoice is dropped.
4. Categorisation: exact-match prefill only; similar and seller matches never prefill; a seller's products are never all assigned one category; shadow-mode evaluation report (§7.2).
5. Stress test of 338 synthetic documents in Chromium, then **measurement on a real Android phone** (peak memory, time, progress responsiveness, cancel). Page and size limits are set from that measurement only.
6. ZIP library gate (§2) and malformed/hostile ZIP tests.
7. Phone verification is separate and is not claimed from desktop tests.

## 12. Decisions still open
1. ZIP library choice, after the §2 gate. 2. Production categorisation thresholds, after the §7.2 report. 3. Discount representation in this increment: negative line vs allocated reduction (§4). 4. Evidence record shape and size. 5. The blanked order-summary sample. 6. The **separate purchase-entry spec** and its four decisions (EMI interest, storage of top-level charges, discount splitting between people, category of an unassigned remainder). Confirm for Amazon orders is not built until the items in 3–6 are settled.
