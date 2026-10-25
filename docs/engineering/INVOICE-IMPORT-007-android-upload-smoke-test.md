# INVOICE-IMPORT-007 — Android smoke test for multi-file invoice upload and Amazon preview

Status: **checklist only. No real-phone result exists yet; the flow is NOT claimed ready for phone use until you have run this.** Chromium and simulation tests have passed on a desktop; they say nothing about Android.

## What you are testing
The **Arth Preview** test build (separate app id `com.parixitpopat.arth.invoicepreview`, its own empty data, cloud sync **off**, so it cannot read or change your real Arth data). Build it from the local branch `invoice-preview-apk-3` (the feature branch plus the earlier isolation commit). The flow is **preview only**: it reads PDFs on the phone, shows what they contain, and **saves nothing**. There is no Confirm for Amazon.

## Test files (synthetic; made by `node tools/invoice-import/make-amazon-test-pdfs.mjs <folder>`, or sent to you separately)
`A1` one seller invoice · `A2` three fee invoices merged in one PDF · `A3` a second seller's invoice · `A4` a different order · `A5` the same invoice as A1 again · `A6` a picture-only PDF · `A7` a damaged file. Put them in the phone's Downloads. Also try one **real** Amazon invoice of your own at the end.

## Checklist (note Pass / Fail / what you saw)
| # | Do | Expect |
|---|---|---|
| 1 | Settings → Data (or Add expense → From invoice) → **Import invoice** | The screen opens; "Review first… nothing is added until you press Confirm" |
| 2 | Tap **Choose invoice PDF** | The file picker opens and lets you select **several** files |
| 3 | Select **A1 + A2 + A3 + A5 + A6 + A7** together | A "Reading 1 of 6…" line with a **Stop** button while it works, then the preview |
| 4 | Look at **What was read** | Files 6 · invoices read 5 (A1, 3 fee invoices, A3; A5 is a repeat of A1) · exact duplicates 1 · probable duplicates 0 · unreadable 1 · picture needing OCR 1 |
| 5 | Tap **Result for each file** | One line per file or page, "File n", with its outcome; **no file names** |
| 6 | Look at the order card | "Unverified — no order summary" · "5 invoices read" · sellers collapsed · "Processing fees × 3" collapsed |
| 7 | Open a seller group and the fee group | Items with tax shown; fee group lists each source invoice and amount |
| 8 | Read the warning under the total | "This is not necessarily what you paid…" and it mentions discounts and shipping |
| 9 | Look for a Confirm / Save button | **None** for Amazon; a note says it is not available yet |
| 10 | Check the whole screen | **No name, address, phone, card or payment id** anywhere |
| 11 | Tap **Add more invoices**, choose **A4 + A1** | A second order card appears; A1 is counted as a repeat; numbering continues (File 7, 8) |
| 12 | Rotate the phone / use a narrow screen | No sideways scrolling; buttons are easy to tap |
| 13 | Tap **Clear** | Everything disappears |
| 14 | Choose **A6 alone** | "picture, not text" explanation (no Amazon card) |
| 15 | Switch to another app and back during a larger selection | The screen is still there; nothing was saved |
| 16 | Your **real** Amazon invoice | Same figures as the PDF; seller and items correct; **your name and address are not shown** |
| 17 | Close the app, reopen, open **Import invoice** | Empty: the readings were not kept |
| 18 | Settings → check your transactions | **No new expense** was created by any of the above |

## What to report
For each failing row: what you did, what you saw, and (if it was slow) how long it took. If a large selection (for example 100+ invoices) is slow, please note the file count and the time: **no limit has been raised**, and the limits stay at 10 pages and 10 MB per file until this measurement exists.

## Measured so far (Chromium, desktop sandbox, not a phone)
50 synthetic files read in about 29 seconds (roughly 0.6 s per file); heap about 52 MB after the run. A phone may be slower. These are not Android numbers.
