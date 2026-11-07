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
