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
