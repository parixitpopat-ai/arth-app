# SYNC-SAFETY-009 — live receiving, open-from-the-phone, compressed backups

Status: built and tested in Chromium against a model backend. NOT verified on a real phone, on Android, or against real Supabase timings.

## 1. The startup stall (root cause found with the harness)
Two things answer at startup: the saved-session check (`checkCloudUser`) and the Supabase auth listener (`INITIAL_SESSION`).
When the listener answered first, `cloudUser` was set while `sessionRestoredOnBootRef` was still false, so the returning-device
first-sync effect ran and stopped. The session check then set the ref to true and `cloudHydrated` to false, but nothing started
the first sync again, so "Loading your data…" waited for ever (reproduced on the previous release with an instant, healthy backend).
Fix: `sessionConfirmedTick` (bumped when the server confirms the session) is a dependency of that effect, so it runs again.

## 2. Open from the data on the phone
A returning device that has data and a finished profile opens at once (`canOpenFromDevice`); its first sync runs in the background
and a small "Syncing with your account…" line shows meanwhile. A device with nothing saved still waits for the cloud copy.
Sync writes are held until the first sync cycle has finished (`syncReady` needs `firstSyncDone`).

## 3. Live receiving (every 20 s while visible)
`engine.pollRemote()` asks only for the cloud copy's `updated_at` (`cas.peek`). Only a difference starts a normal cycle, which decides as always:
clean device → verified backup, then takes the newer copy; device with its own unsynced changes → conflict screen. It skips while a
write is pending, sync is paused, a conflict waits, the device is offline, or the engine is stopped. A failed look changes nothing.
No Supabase Realtime is used: the `supabase_realtime` publication is empty for `arth_snapshots` (checked 2026-11-07), and enabling it is a database change that was not made.
Limit: up to ~20 s delay, a few bytes per look; a change made on another device while this one is being edited is handled by the existing conflict rules, not merged.

## 4. Backup copies are compressed
Safety backups and automatic backups are stored as `z1:` + base64(zlib(JSON)) (`fflate` 0.8.2, exact pin). Plain-JSON lists from earlier versions still load and are converted on the next write.
Ratio on real data is NOT measured (the synthetic test data is far more repetitive than real data).
Manual harnesses under `tools/sync-sim` and `tools/offline-startup` read the lists through `src/sync/packedList.js`.
`navigator.storage.persist()` is requested once; the browser may refuse.

## 5. Not done
Per-record sync (each save still uploads the whole data, ~2 MB for ~670 transactions), moving live data to IndexedDB, Realtime.

## 6. Photos (what makes the data big) — added 2026-11-08, NOT yet released
Measured on the cloud copy (sizes only, no image was viewed): ~1.97 MB uploaded per save; ~1.26 MB of it is about five embedded photos
(`imageBase64` / `paymentImageBase64` on `txns` and `bills`), most of them also stored a second time on the matching bill/transaction.
~660 transactions and 21 bills carry an empty photo field. Everything else (≈670 transactions, all other lists) is ≈0.7 MB.
Photos were saved exactly as picked (5 file inputs + the biller-documents add).
- `src/domain/images/shrinkImage.js`: longest side 1600 px, JPEG q0.75; the ORIGINAL is kept when the type is not jpeg/png/webp, the file is under 60,000 characters, decoding fails, or the result is not under 90% of the original. Used when attaching, and by `shrinkAllPhotos` for existing data (identical photos are shrunk once and stay identical).
- Settings → Backup & Restore → "Photos on bills and transactions" (`PhotoOptimizeCard`): preview first (changes nothing); then a verified safety backup (`before-photo-optimize`) must be saved, else a downloaded backup file must be confirmed; only then are photos swapped. Applied by matching the exact photo text, so photos added after the preview are never touched.
- Backups: `z2:` format stores identical large strings once (the same photo on a bill and its payment).
- Early warning strip when less than ~300 KB of browser storage is left (before the full-screen guard at ~32 KB).
Not measured: how much REAL photos shrink (tests use synthetic canvas photos). Not done: moving photos or live data out of the browser's ~5 MB localStorage (IndexedDB); per-record sync.

## 7. Backup copies leave out photos that survive elsewhere — added 2026-11-08, NOT yet released
Decision (user, 2026-11-08): "all records, no photos in backups." Refined so that nothing is lost for good:
- A backup leaves out a photo ONLY when the exact same photo exists in the data that replaces the backed-up data (`survivor`): for the copy taken before taking the cloud copy (survivor = cloud copy) and before keeping this device (backing up the cloud copy; survivor = this device); automatic rolling copies leave out photos the live data holds. A photo that exists nowhere else is always kept.
- Never reduced: conflict holds, sign-out copies, account hand-over copies (all pinned), and the two copies taken before a manual restore.
- Each reduced backup records what it left out (`omitted`: record id + field). Restoring (or downloading) a backup puts those photos back from the data as it is now (`fillOmittedPhotos`); a photo whose record no longer holds it stays empty and the restore message says how many.
- Known limit: an automatic backup does not protect a photo that was deleted from the live data after the backup was taken (it was left out because the live data had it then).
- Records are always complete in every backup; only photo text is left out.

## 8. Loan given from the Add screen — added 2026-11-08, NOT yet released
Request: a loan to a friend must not be a transfer, and must not ask for a destination account.
- Add Transaction (full form, "More options") has a "🤝 Loan given" choice beside Transfer. It opens `LoanGivenSheet` (person, amount, date, "Paid from" = my own non-card accounts or "Not from an account", note), carrying over the amount and date already typed.
- `domain/loans/loanGiven.js` builds the loan (direction given, source person, outstanding = principal) and, when it left one of my accounts, the existing money-out entry (`buildLoanDisbursalTxn`: no destination, no category, not spending). A destination account is refused by the builder.
- Storage is unchanged on purpose: the money-out entry is still `type:"transfer"` with `toAccId:null` and `isLoanDisbursal:true`, because balances, budgets and calendars already depend on that shape. What changed is what the person sees: the detail sheet says LOAN GIVEN (shown as money out, naming the account), the account ledger says "Loan given · name", and editing the entry opens a notice that leads to the loan (`LoanEntryNotice`) instead of the transfer form (which would demand a To account).
- Not done: the quick Add screen (Expense/Income only) has no Loan given choice; it lives under More options. An existing plain transfer cannot be converted into a loan given; delete it and record the loan. Deleting the money-out entry does not delete the loan.

## 9. Credit card bill paid as an expense — added 2026-11-08, NOT yet released
Report: marking an expense as a "Bill payment" and linking it to the credit card's bill counted the payment as spending. Cause: the expense form's bill-match list included card STATEMENT bills (`isCcStatement`); linking marked the statement paid by an expense, which counts as spend a second time and leaves the card's balance untouched (the Payments screen already avoids this by recording a `cc_payment`).
- Card statements are no longer offered as a bill an expense can pay (whole-expense match list and the per-item link list).
- The expense form shows "Paying a credit card bill?" when the expense is linked to a card statement, has the amount of an unpaid card statement, or is in the Credit Card Bills sub-category; "Record as card payment" switches the same form to a card payment (From = the account chosen, To = the card).
- Converting an EXISTING expense to a card payment keeps its id, keeps the statement paid by it, and (like a new card payment) lowers the card's outstanding and settles EMI instalments. Outstanding is floored at 0, so a card balance already corrected by hand will not go negative, but it is reduced again.
- Not done: entries already saved as expenses are not converted automatically; each is converted from its own Edit screen.
- Follow-up (same day): the first version only recognised an expense linked to a card STATEMENT. A real entry ("Icici CC 8004 Bill Payment", Bill payment switched on) was linked to a bill the expense had made for ITSELF, so no hint appeared. The hint now also recognises the description (credit card / CC together with bill / payment / paid / dues / statement, in the description, note, reference or SMS), picks the card by the last four digits it finds (or the only card), and has a "No, it is an expense" dismiss. Converting removes the self-made bill (only when: no biller, not a statement, paid by this entry, no other payment on it) and its payment record, and the entry no longer points at it.

## 10. Needs details, the category wheel and the Home tiles — added 2026-11-09, NOT yet released
Request: every expense should have a category and sub-category, and (except vehicle costs) belong to a person or group; show what is uncategorised, do not block saving, allow editing old entries; "Me is Me, the operator of the app."
- Found: the Spend by Category wheel (`categories`) and the tiles (`stats`) exist but were not in the saved Home layout (8 core cards + goalsHome), and Arrange can only hide/show/move cards already in the list. `backfillCardOrder` now appends `needsDetails`, `categories` and `stats` when missing (existing order and hidden cards kept).
- `domain/transactions/completeness.js`: `expenseGaps` (category; sub-category when the category has any; person/group). Owner = Me, another person, a one-time person, someone who paid, a group (incl. group allocations) or a vehicle. Me IS a person (the one who enters the expenses), so Me alone counts (`ME_COUNTS_AS_OWNER = true`, one switch); the operator's own person id is treated as Me. What fails the rule is an expense tagged to nobody.
- Home: "Needs details" card (count, amount, per-gap counts) opens `NeedsDetailsSheet` (filters; tap = the normal edit form, old entries included). The wheel gains an "Uncategorised" slice (current month). Rows get a "❓ Uncategorised / No sub-category / No person/group" chip. The Add/Edit form shows "Still missing: ..." but never blocks Save.
- Measured on the cloud copy (2026-11-09, 501 expenses): 14 no category (~Rs 37k), 71 category without sub-category (~Rs 100k), 103 tagged to nobody and not vehicle (47 more are Me-only and count as complete). Nothing was changed in that data.
- Not done: bulk assignment (select several, set category/person once); automatic suggestions for old entries; the wheel's Uncategorised slice only covers the current month.

## 11. Petty cash given to a person — added 2026-11-09, NOT yet released
Request: cash handed to a spouse, outside any monthly commitment, who spends it on the house; leftover stays with her and is used on later house purchases; her purchases are recorded with who paid; it must not show as owed either way and must not count in net worth. Named "Petty cash" (the accounting term for cash held by someone for small purchases) rather than "advance"; it is not limited to a spouse or to the house (any person, any purpose, in the note).
- A/O/C in "Who is this for?" are Attribute / Own / Collect. None fits (Own = I owe them, Collect = they owe me, Attribute = tag only).
- `domain/person/pettyCash.js`: petty cash is a `transfer` with a source account (or none, for cash in hand), NO destination, `isPettyCash` and `pettyCashPersonId` (same shape as a payback / a loan given). It is not spending; the account is debited once; it is not an asset.
- Her purchases stay ordinary expenses "Paid by" her (existing, `paidBy.js`). In `settlements`, what I owe her is paid from the petty cash FIRST: `iOwe = max(0, owed - petty)`, `pettyHeld = max(0, petty - owed)`; then paybacks (reimbursement) apply as before. `pettyHeld` is not a receivable and not in net worth.
- UI: "Petty cash" in the Add screen's type row and "💼 Petty cash" on a person's page; `PettyCashSheet` (person, amount, date, paid from own non-card account or cash in hand, note; no destination). Her page shows "₹X petty cash with her" (given / used / still owed). The entry is labelled PETTY CASH, edits through the same sheet, and is "Petty cash given" in the calendar.
- Limit: every expense recorded "Paid by" her draws the petty cash down. Her own personal spends should not be recorded as "Paid by" her. Not done: showing it in the People list; returning leftover cash (record it as a payback from her side if needed).

## 12. Vendors: spend by vendor and "same vendor?" merging — added 2026-11-09, NOT yet released
Request: "ABC Textile" / "ABC Textiles" are one company but two vendors (example only); ask before merging; show vendor-wise spend.
- A vendor is the `merchant` text on an entry; the app already matched it ignoring capitals only. Found in the real cloud copy (names only, nothing changed): "DudhSagar Dairy" (2) vs "Dudh Sagar Dairy" (1) = two vendors; "Goa Electricity Department" (6) vs "Goa electricity Department" (1) = already one vendor (capital letter only).
- `domain/vendors/vendorMerge.js`: `vendorSpend` (expenses only, gross amounts, by period), `findVendorDuplicates` (same after lower case, company words pvt/ltd/llp/inc/co/company/private/limited/the/and removed, non-alphanumerics removed, one trailing "s"; "Store/Shop" deliberately NOT dropped), `mergeVendors` (renames `merchant` on transactions and bills; returns what it changed), `undoVendorMerge` (by id; anything edited since is left alone).
- UI: Money > Reports > Vendors tab (this financial year, or all time; search; tap a vendor for the existing vendor page). A "same vendor?" card per suggestion: choose the spelling to keep (most used is pre-selected), Merge or "Not the same". Nothing merges without a tap; the last merge can be undone (until the next merge or reload). "Not the same" is remembered per set of spellings (`arth_vendor_not_same`, device-only: a second device asks again; a NEW spelling asks again).
- Limits: amounts are the full amount of each expense (not "my share"); only `merchant` is renamed (not descriptions or item names); a hyphenated or very different spelling is not suggested; undo is for the last merge only and is lost on reload.

## 13. Bank statement import (CSV, Excel, text PDF)

Open a bank account (Money → the account) → Import statement. The account is fixed; pick a file, review, press Import. Reading creates nothing; the file is read on the device and never stored or uploaded.

- **Readers:** `domain/imports/csv.js`, `xlsx.js`, `statementPdf.js` (text layer only, via the existing pdf.js reader; scanned PDFs are refused with a reason), one entry point `readStatementFile.js` that detects the kind from the file's bytes.
- **Direction comes from the balance column when it disagrees with the headings.** The sample layout shown (an IDFC First PDF found on the internet, not the owner's data) has amounts under "Credit" that LOWER the running balance. If reversing every sign makes the balance add up and the stated signs do not, the parser reverses them and says so (`balance.signsReversed`). Not verified against a real export; the preview always shows the balance check result.
- **Import rule:** debit → expense, credit → income, **no category** (they appear under Needs details). A debit that reads like a credit-card bill payment becomes a `cc_payment` to the card whose last four digits appear in the text (or the only card), so it is not counted as spending; with no match it stays an expense and is flagged.
- **Duplicates:** every row has an `importKey` stored on the created transaction (`importBatchId`, `importSource` too). Re-importing a file shows those rows as "imported before". A row with the same amount within ±2 days of an existing entry on that account is "looks already in Arth" and unticked by default. Existing entries are never changed.
- **Undo:** by batch id, from the "Done" card or "Earlier imports" on the same screen. Entries added by hand are untouched.
- **Known effect:** imported rows change the account's computed balance. The screen says by how much; it does not adjust any opening balance.
- **ICICI-style PDF layout (from a partial screenshot, not a real file):** headings printed over two lines, a serial-number column, dotted dates (02.04.2026) and multi-line remarks are handled (`statementPdf.js` joins stacked heading lines; "Cheque Number" is a recognised reference heading). Verified only on a synthetic PDF drawn to look like it.
- Tests: `domain/imports/*.test.js` (unit), `tools/imports/statement-browser.mjs` (Chromium, synthetic files: CSV, PDF, bad file, re-import, undo). No real statement and no Android/device check yet.
- **Match balances (tap, with undo):** when every row has a balance and the running balance adds up on every row (≥2 rows), the screen offers "Set these balances": the account's opening balance becomes the balance before the first row (dated the first row's date) and its "current balance as of" note (`arth_checkpoints`) becomes the last row's balance (dated the last row's date). Entries dated before the new opening date stop counting toward the balance (the screen says how many; they stay in the records). Undo restores the previous opening balance, its date and the previous note exactly. Never automatic; never offered when the statement's balance does not add up. Pure logic: `domain/imports/statementBalances.js`.
- **Merge a row into an entry you already have:** a row marked "looks already in Arth" shows your entry and a "Merge into my entry" button. Merging adds no transaction; your entry keeps everything (amount, date, category, people, notes) and only gains the link fields (`importKey`, `importBatchId`, `importSource`, `importMerged`; the statement's reference is copied only if the entry had none, flagged `importSetRef`). The row is then "imported before" if the file is loaded again. An entry that is already linked cannot be merged into again. Undo of the batch removes the entries it created and un-links merged ones exactly (`buildImport.js` `applyMerges` / `undoImportBatch`).
- **Matching counts payment rails (fix after first real use):** an entry recorded against a UPI handle / debit card linked to the bank (its `accId` is the rail) is now compared as the bank's own, and a part-paid expense (`paymentLines`) is compared by its slice from this account. Before, such entries were invisible to the matcher, so the statement row was offered as new and an extra entry was created. `matchStatement(..., {linkedIds})`.
- **P needs no A / O / C:** a person marked P (paid from their petty cash) is the payer; their row no longer blocks Save with "Choose A, O or C", and is left out of the split unless a mode was chosen for it.
