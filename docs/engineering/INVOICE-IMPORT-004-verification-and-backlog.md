# INVOICE-IMPORT-004 — verification status, phone test, two-device test, backlog

Status: written after the invoice import, expense splitting, charges card and odometer work reached production (`main` at `750a3b5`). No new feature work until the checks below are closed. Anything not verified is labelled. Desktop (Chromium) results are never evidence for Android or for real cross-device sync.

## 1. Production release
* Production commit `750a3b57be0f2fe6bb88c7b3f10d7ffdfdee56f4`. Vercel deployment `dpl_Ekdxqdm7RsKBA1RC68Gx8y5MmyPJ` (`arth-k2ivrmuqx-parixit-popats-projects.vercel.app`), state READY, target production, alias `arth-app.vercel.app`. Read from the Vercel API; the live site itself was not fetched.
* Production before this work: `852e343` (sync-safety release). Everything after it on `main` (13 commits):
  * `ea315dc` odometer capture at refuelling (deployed).
  * `af5f0bb`, `496a30a` statement-import slice 1: CSV/XLSX readers, matcher. **Not wired to anything** (no UI, no writes; nothing outside `src/domain/imports/` imports it). It shipped as inert code. **I cannot show an explicit approval for these two commits in the record I have; treat them as a question for the owner.** They can be reverted without touching anything else.
  * `34f9300` invoice preview, `e2e3f70` Phase 2 definition (doc), `2121291` confirmed import, `020cf65` fee categories and item memory, `10dc056` person/group breakup fix, `87f567b` brands, `dfd6928` charge rows combined per tax rate, `46d1707` + `cb50f6e` charges shared by splits, `750a3b5` Charges card and import from Add expense.
* New dependency in production: `pdfjs-dist` 6.4.299 (exact pin, lazy-loaded). No other dependency change.
* The live bundle is built from that commit; a clean local build of `750a3b5` contains the "From invoice" entry, the Charges card, the charge-split note, the fuel-fill and invoice-import storage keys.

## 2. Android builds: which one has what
| Build | Commit | Backend | Has the latest work? |
|---|---|---|---|
| "Arth Preview" APK you received (`invoice-preview-apk`, run 39909701263) | `bb75cf2` (Phase 1 only) | local-only, own app id | **No.** Preview screen only. No confirm, no charges, no splits |
| `main` debug APK (workflow runs on every push to `main`, latest run 40048003000 on `750a3b5`, success) | `750a3b5` | **production defaults** (built-in cloud settings) and the normal app id | Yes, but **not isolated**: it would talk to the production backend |
| Isolated preview with the latest work (`invoice-preview-apk-2`, local branch `db69ce8`) | `750a3b5` + isolation | local-only (`VERCEL_ENV=preview`), app id `…invoicepreview`, label "Arth Preview" | Yes. **Not pushed, not built.** Needs approval to push the branch and run the workflow |

The isolation (local-only cloud, side-by-side app id) is checked by the existing `cloudConfig` tests and by the earlier bundle check; it has not yet been re-checked on a build of the new branch.

## 3. Phone test (shortest useful run, ~10 minutes)
Use the **isolated preview** (empty data, no backend). Files: the five synthetic PDFs from `tools/invoice-import/make-test-pdfs.mjs` plus, if you want, your real invoice. On production web, a real import writes real data; if you test there, press Undo straight away.
1. Add two expenses by hand so the app has data: Cafe ₹100, Blinkit ₹1,125 on 16 Jan 2026 (bank account).
2. Home → **➖ Expense** (Quick Add) → **From invoice** (top right, beside "More options →"). Also check it exists in the full form: Add expense → More options → Purchase type: Standard / Itemised / **From invoice**.
3. **Choose invoice PDF** → `1-valid-invoice.pdf`. Expect 3 items, one Handling charge ₹13, total ₹1,125.00, invoice date 2026-01-15.
4. Choose the account, press **Confirm**. Expect "added", and a **Undo** button.
5. Press **Back** (returns to Home, not Settings). Open the new Blinkit expense → Edit. Expect: a **Charges** card ABOVE Items with Handling charge 13, Platform fee / Delivery rows, + CGST / SGST / Other; Items card with 3 items only; total ₹1,125.
6. Type Platform fee 5 → "Set total to ₹1,130" → note lines add up.
7. **Who is this for?** → add two people → *Link to specific items instead* → give one chips, other chips + cola. Expect the note "Charges ₹… are shared equally between 3 splits, you included" and each person's "items + charges" amount. Save. Open the expense: "Charges in this expense" block and per-person amounts.
8. Import the same PDF again: "already added", Confirm disabled.
9. Airplane mode, repeat step 3: still works (everything is on the phone).
10. Settings → Data: there is **no** "Import invoice" row any more.
Report each step Pass / Fail / what you saw, plus a screenshot of any difference.

## 4. Data integrity: what is verified and what is not
Verified by code and tests (Chromium / Node):
* An import writes the expense and its `invoiceImports` record in one step and reads them back; on failure both are rolled back and a message is shown (`confirm-browser.mjs`, CF-series).
* **Undo** removes only an expense that is exactly as the import left it. This session closed one gap: Undo now also refuses if anything has been added since (people, groups, allocations, a note, a settlement), so it cannot throw away someone's split. For a linked import it refuses if items were tagged to people. (`invoiceImport.test.js`.)
* Import never edits an existing expense's amount, date or account. A "link" only adds item lines to an expense that had none.
* Duplicate key = seller GSTIN + invoice number; a repeat is blocked, with an explicit "import again" only when the earlier expense no longer exists.

Verified on **simulated two devices** (two Chromium contexts, local fake backend, synthetic data, `tools/sync-sim/invoice-devices.mjs`; the real Supabase and real phones were not used):
* I1 an import's expense AND record reach the other device; starting expenses untouched.
* I2 on the other device the same invoice is blocked as already added.
* I3 Undo on one device removes the expense and the record in the cloud and on the other device.
* I4 backend rejects the save: the device keeps expense + record together, nothing half-saved reaches the cloud, both arrive exactly once after recovery.
* I5 server applied the write but the reply was lost: after reopening, one expense and one record, no repeat.
* I6 both devices import the same invoice while apart: one device shows "both changed — tap to review"; both expenses survive (cloud, device or pinned backup). Duplicate prevention cannot work across two devices that have not synced; the conflict screen is what protects you.
* I7 one device edits an existing expense while apart and the other imports: the edit, the import and the invoice record all survive (cloud, device or pinned backup). Nothing is overwritten silently.

**Not verified:** real Supabase; real phones; the Android WebView; the conflict-resolution screens with real `invoiceImports` data (the generic conflict flow was verified in SYNC-SAFETY; the invoice-specific resolution choices were not exercised).

## 5. Two real devices: shortest test (needs you, ~10 minutes)
Use **two installs that share one test account and are NOT your real account**, on the isolated build only after cloud sync for it is explicitly enabled (it is off by default). Until then, do not run this on production data.
1. Phone 1 and phone 2 signed in to the test account, synced (headline "Synced").
2. Phone 1: import invoice 1, confirm. Wait for "Synced". Phone 2: pull-to-open the app; expect the expense and "already added" for the same PDF.
3. Phone 1: Undo (still on the review screen). Sync. Phone 2: expense gone.
4. Both phones in airplane mode: both import invoice 1. Turn data on, phone 1 first, then phone 2. Expect a "both changed" notice on one of them and no loss; choose to keep both and delete one expense by hand.
Report anything that differs from "Expect".

## 6. Backlog (visible, not started)
1. Monthly platform-fee (and other charge) report. The data is saved per expense (`kind: "charge"`, `chargeType`); `chargeBreakdown()` is the function a report would call.
2. Brand-comparison screen. Data saved in `invoiceImports[].lines` (brand, product, size, barcode, price).
3. "Who is this for?" on the invoice review screen itself.
4. Wire-or-remove decision for statement-import slice 1 (inert code in production).
5. Real-device and real-backend verification of sync (section 5).
6. Optional in-CI APK isolation check; Vercel Node-version check.

**Explicitly unsupported (refused or ignored, nothing is created):** refunds, credit notes, cancellations; split or wallet payments; invoices that are a scanned picture (needs OCR); Amazon and Flipkart invoices; keeping the PDF; merging several invoices into one expense; invoices that do not reconcile (shown for review, not importable).

## 7. Historical imports: safe, explicit path (nothing is changed automatically)
Older imports keep their old lines (for example five separate "Delivery and other charges" rows). Options, each per expense and each your choice:
* **Edit by hand (no data lost):** open the expense → Edit → delete the old delivery lines → type the handling amount in the Charges card (₹13.00 for the sample) → lines add up → Save. People and notes stay.
* **Re-import:** delete the expense yourself, then import the PDF; Arth shows "imported earlier; that expense no longer exists" and offers "import again" as a ticked box. People or notes on the old expense are lost with it.
* Leave it as it is. Reports still count it correctly; only the charge breakup is missing.
