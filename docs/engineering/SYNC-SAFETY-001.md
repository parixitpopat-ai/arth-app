# SYNC-SAFETY-001 — isolated cloud-sync safety test (synthetic data only)

> **Baseline record.** This describes the sync behaviour before the fix. Current status and results: `SYNC-SAFETY-003-results.md`.

Date: 15 Oct 2026. Status: **evidence gathered; four of the five required properties are NOT met.** Cloud-sync verification for Web v1 is **not complete**.

## Why this exists
The owner will not test two-device sync on real financial data: an earlier sync made transactions disappear and one had to be re-entered by hand. This test replaces that request. It never uses, reads or writes the owner's data, the production Supabase project, or any real account.

## What was built (`tools/sync-sim/`)
- `fakeSupabase.mjs` — a local stand-in for the three Supabase calls `src/cloudSync.js` makes (session check, read the user's one snapshot row, upsert it). It keeps an **append-only log of every write** and can inject faults: latency, reject the next N writes (HTTP 500), apply a write but drop the response, go offline.
- `lib.mjs`, `run.mjs` — drive the **real, unmodified app** in Chromium (two "devices" = separate browser contexts) with synthetic transactions (`B001…`, `A001`, test user `sync-test-a@example.invalid`).
- **Isolation, enforced:** the app is pointed at `http://localhost:54399` by env var; every request to any non-local host is aborted and recorded; the run fails if any request goes to `*.supabase.co`. Result in both runs (the second run repeated every pass/fail result of the first): **0 Supabase requests**; the only non-local host the app tried was `fonts.googleapis.com` (aborted).
- Note: `src/cloudSync.js` falls back to the production project URL and anon key when `VITE_SUPABASE_URL` is unset. The harness always sets it and also blocks non-local hosts; anyone running it must keep both guards.

Run it: start the dev server with `VITE_SUPABASE_URL=http://localhost:54399 VITE_SUPABASE_ANON_KEY=synthetic VITE_FORCE_DEV_AUTH_BYPASS=false npx vite --port 5196`, then `node tools/sync-sim/run.mjs`. Each run writes a hashed, write-once record to `tools/sync-sim/results/`.

What is simulated and what is not: the server is a model of the Supabase behaviour the app relies on (one row per user, last write wins, `updated_at` set by the server). It is not Supabase itself, so it cannot show Supabase-specific failures (row-level-security policy mistakes, auth-token refresh, rate limits, real network behaviour). "Offline created/edited" records are made by taking the fake server offline while the real app is used.

## The five properties, with the evidence

| # | Property | Result | Evidence (run `run-2026-10-15T06-07-57-342Z.json`) |
|---|---|---|---|
| 1 | Durable local save before async sync | **Met** | With the server offline, a new expense was in `localStorage` immediately after Save, the server had received 0 writes, and the expense survived a reload. |
| 2 | Recoverable, immutable export of the test dataset | **Met for the harness export; the in-app export not tested** | The 12-transaction baseline was written once, SHA-256 `b7778ace…e1e4b0`, contents re-read and compared (12/12 IDs, no diff); a tampered copy is detected; hash unchanged after all scenarios. OS read-only is advisory only because the harness runs as root. The app's own Download backup file was **not** exercised here. |
| 3 | Conflicts detected, not silently discarded | **NOT met** | Device B created a transaction offline while device A's snapshot reached the cloud 10 s earlier: B's transaction is gone from B, the cloud and every local backup, and no conflict message is shown. Only when A's snapshot is more than 60 s old does the app notice, and then it only blocks syncing (see findings 1 and 3). |
| 4 | Transaction IDs and counts reconcile before/after sync, incl. offline creates | **NOT met** | Expected union 14 IDs (12 base + A's + B's); after reconnecting, both device B and the cloud hold 13 in the 10 s case (B's missing) and the devices never converge in the 10-minute case (B lacks A's, cloud lacks B's). |
| 5 | Interrupted sync cannot silently lose a transaction | **NOT met** | 3 of 5 interruption cases lose it silently (below). |

Interruption cases (property 5):
- Server rejects the write (500): local copy kept and "Sync failed" is shown, but after a reload within 60 s of the last good write the transaction is **gone** from the device and is not in the cloud (local backups were not checked in this case). **Lost.**
- Write applied but response lost: local and cloud agree afterwards. **Held.**
- App closed within the 900 ms push delay, reopened: cloud written 10 minutes ago, kept locally (not synced, no loss); cloud written 10 s ago, **lost**, in no backup.
- Cloud snapshot older than 60 s: edits are not pushed at all (finding 1); one tap on Sync Now then replaces the device with the cloud copy and the edit is **lost**, in no backup (finding 2).

## Findings (code locations are in `src/App.jsx` at the pinned main; verify before relying on them)
1. **`savedAt` is not "last edited".** `cloudSnapshot` stamps `savedAt: new Date()` inside a `useMemo` (≈ line 9187), so it is the time the in-memory snapshot was last rebuilt (on every load and every change), not the time of the last change or last sync. `pullCloudSnapshot` (≈ 9481) compares it with the cloud's `savedAt` using a 60-second margin to decide whether local data is "newer". Consequences seen: (a) cloud older than 60 s → the app sets `syncConflictPendingRef` and **stops auto-pushing**, yet Settings still says "Every change saves to cloud automatically"; (b) cloud within 60 s → the cloud copy replaces local data with no prompt, discarding unsynced local edits.
2. **The "saved to Backup & Restore" promise is not reliable.** Before overwriting, the pull saves a "pre-sync" backup but skips it when the previous pre-sync backup is under 2 minutes old (≈ 9507). The boot-time pull already made one, so the backup taken at Sync Now time was skipped and the edit was in no backup, while the message says it was saved. The persisted list is also cut to its first 3 entries (≈ 9180).
3. **One tap on Sync Now already forces the pull** when a conflict is pending (`pullCloudSnapshot(syncConflictPendingRef.current)`, ≈ 15094), although the message says "tap again".
4. **Whole-snapshot, last-writer-wins.** `saveCloudSnapshot` upserts the entire snapshot per user with no version check; there is no per-transaction merge. Two devices that both changed anything cannot both keep their changes.
5. From reading the code (not separately tested): `pushCloudSnapshot` catches a failure and only sets a status text; there is no retry queue and no "unsynced changes" marker that survives a reload. The next push happens on the next change.

## What this does not show
- It does not reproduce the owner's original incident; it shows mechanisms that can cause the same symptom (finding 1 → 2 → 3). I have no evidence of which one happened.
- The 60-second windows matter: losses occur within them, and the owner's real timing is unknown.
- Behaviour against real Supabase is unverified. Plan Ahead nudge sync (`planNudges`) is **not** covered here and remains **Unverified**.

## Proposed next step (needs the owner's decision; nothing has been changed in the sync code)
Make the five properties true, in this order, each with a failing test first from this harness: (1) stop using a rebuilt-on-render timestamp: keep a persisted `lastSyncedVersion` and a local "dirty since" marker; (2) never replace local data without a verified, non-throttled backup that contains it; (3) detect divergence (both sides changed since the last common version) and require an explicit choice, never auto-apply; (4) retry unsynced changes and keep a pending-changes marker across reloads; (5) reconcile IDs and counts after every sync and show any difference. These change sync behaviour for all users, so they need approval and a design review before code.
