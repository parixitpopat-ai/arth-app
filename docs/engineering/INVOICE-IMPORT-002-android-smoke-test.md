# INVOICE-IMPORT-002 — Android smoke test for the Phase 1 invoice preview

Branch `invoice-preview-apk` (local; based on `34f9300`, adds only the Android preview build settings, an "unverified" label on the matching rules, and this file). Nothing here goes to production. Not for merging into the sync-safety release.

## What the test build is
* App name **Arth Preview**, application id `com.parixitpopat.arth.invoicepreview`: installs **beside** a real Arth app and has its own empty data. It cannot overwrite or read the real app's data.
* Built with `VERCEL_ENV=preview`, so cloud sync is **off** (`src/cloudConfig.js`: local-only, no production backend, no sign-in to your real account). Verified in the built bundle. Do not try to sign in; if a sign-in prompt appears, note it and stop.
* Debug-signed APK from the existing "Android debug APK" GitHub workflow (manual run, artifact `arth-debug-apk`, kept 14 days).

## Test files (synthetic, no customer data) + your own invoice
`1-valid-invoice.pdf`, `2-wrong-total-needs-review.pdf`, `3-credit-note-not-a-purchase.pdf`, `4-scanned-picture-no-text.pdf`, `5-damaged-file.pdf` (made by `tools/invoice-import/make-test-pdfs.mjs`). Copy them to the phone's Downloads. Also have your real Blinkit invoice PDF on the phone.

## Setup in Arth Preview (about 3 minutes)
Add three expenses (type expense, any account): **Blinkit ₹1,125 on 16 Jan 2026**, **Blinkit ₹1,135 on 15 Jan 2026**, **Cafe ₹1,130 on 15 Jan 2026**. Count the transactions you have (write the number down).

## Checklist (note Pass / Fail / what you saw)
| # | Do | Expect |
|---|---|---|
| 1 | Open Settings → Data → **Import invoice** | Banner "Preview only. Nothing is saved." Blinkit selected; Amazon/Flipkart "later" |
| 2 | **Choose invoice PDF** | The phone's file picker opens and shows Downloads |
| 3 | Pick `1-valid-invoice.pdf` | Within a few seconds: invoice date 2026-01-15, order id and invoice number shown, **3 items**, one **Handling charge ₹13**, **Invoice total ₹1,125.00**. This also proves the PDF worker loads in the Android WebView |
| 4 | Look at item 3 | "2 × MRP ₹606 · discount ₹280 is already inside the line total", line total ₹932 |
| 5 | Look at "Might already be in Arth" | Two suggestions (₹1,125 same amount; ₹1,135 similar). The ₹1,130 Cafe is NOT suggested. Nothing pre-selected. An orange note says the matching rules are unverified |
| 6 | Tap a suggestion | Only the sentence below changes ("would link…"). The Save button stays greyed out |
| 7 | Change **Payment date** to a future date | A red/amber message says it can't be in the future |
| 8 | Pick `2-wrong-total-needs-review.pdf` | "Check this before relying on it"; ₹902 shown (not corrected); "Does not add up" |
| 9 | Pick `3-credit-note-not-a-purchase.pdf` | "This isn't a purchase invoice. Nothing was added." No amounts |
| 10 | Pick `4-scanned-picture-no-text.pdf` | "This PDF is a picture, not text" (OCR) |
| 11 | Pick `5-damaged-file.pdf` | "Couldn't open this file" with next steps |
| 12 | Pick your **real invoice** | Same figures as the original PDF; **no name or address on screen**; order id and invoice number match the PDF |
| 13 | Turn on **airplane mode**, repeat step 3 | Works the same (everything is inside the app) |
| 14 | Pick the same valid file twice | Second time: "already looked at this invoice earlier in this session" (not "imported") |
| 15 | Leave the screen (Back / Close) and open Transactions | Same transaction count as before the test. Also after closing and reopening the app |
| 16 | Screenshots | Take one of any step that differs from "Expect", including the small "Code:" line at the bottom (it has no invoice contents) |

If step 3 shows "Couldn't open this file" for the valid PDF, that is the main finding (WebView or worker problem): send the Code line.

## Phase 2 — to be defined AFTER this passes on the phone (no persistence before that)
Invoice de-duplication store and key; synced invoice metadata (and sync/restore/backup coverage); link-versus-create behaviour; payment source and split payments; recovery when saving or sync fails; whether the original PDF is kept (storage design with visible save failures). Matching tolerances stay **unverified** until checked against real data.
