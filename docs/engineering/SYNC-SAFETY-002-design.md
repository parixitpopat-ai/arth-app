# SYNC-SAFETY-002 — design and test plan for the sync-safety work package

Status: **PROPOSAL, awaiting owner review. No sync code has been changed.** Branch `wp-sync-safety`, based on `wp-sync-evidence` `7bf8ffa`. `origin/main` = `5fc65e7` and is not touched. Evidence this answers: `SYNC-SAFETY-001.md` (3 of 5 safety properties fail; silent loss reproduced in 3 cases).

## 1. Invariants the design must guarantee
- **I1 No silent loss.** At every moment, every transaction ID ever saved on any device is present in at least one of: that device's live data, the cloud row, or a verified safety backup on a device. Replacing data never happens without a verified backup that contains what is being replaced.
- **I2 No newer-by-guess.** "Which side is newer" is never decided from a clock or from `savedAt`. It is decided from recorded sync history (below).
- **I3 Conflicts are surfaced, never auto-resolved.** If both sides changed since their last common point, nothing is overwritten; the person chooses, with both sides backed up first.
- **I4 Status text is true.** Every sync/backup message is produced from verified state, and says "saved" only after a read-back confirmed it.
- **I5 Reconciled.** After each sync the IDs/counts on both sides are compared and any difference is shown, not hidden.

## 2. Root causes being removed (from SYNC-SAFETY-001)
`savedAt` is re-stamped on every in-memory rebuild; the 60 s margin guesses "newer"; the push is blocked or the cloud copy wins on that guess; the pre-sync backup is throttled to one per 2 min and trimmed to 3 persisted entries; Sync Now forces the pull on the first tap; the push overwrites the whole row with no check of what it overwrites; a failed push is not remembered across a reload.

## 3. Design

### 3.1 Sync history kept on each device (persisted, `arth_sync_state`)
`{ deviceId, baseToken, baseDigest, pendingWrite, conflict, lastReconcile, lastVerifiedAt }`
- `baseToken`: the cloud row's `updated_at` value (as returned by the server) at the last moment this device and the cloud were known identical.
- `baseDigest`: SHA-256 of the canonical synced content at that moment (the snapshot without volatile fields `savedAt`, `syncMeta`).
- **Dirty is derived, not flagged:** `dirty = digest(current content) ≠ baseDigest`. Because it is recomputed from data on every boot, an unsynced change survives a reload, a crash, or a close inside the push delay with no ordering race (this removes the "closed within 900 ms" loss).
- `pendingWrite = { writeId, digest }` is persisted *before* a push is sent (for lost replies, §3.4).

### 3.2 Decision table (pure function `decideSync`, no I/O, exhaustively unit-tested)
Inputs: `{ hasBase, dirty, cloud: none | { token, digest, writeId } , networkOk }`.
| Situation | Action |
|---|---|
| Network/read failed | Stay as is; status "Not synced"; retry (§3.5). Never push, never replace. |
| Cloud row missing, local has data | Create the row (insert; fails if one appeared meanwhile → re-decide). |
| `cloud.token = baseToken`, clean | Nothing to do. |
| `cloud.token = baseToken`, dirty | Push with compare-and-swap on `baseToken` (§3.3). |
| `cloud.token ≠ baseToken`, clean | Fast-forward: verified safety backup of local, then adopt cloud, set base. |
| `cloud.token ≠ baseToken`, dirty | **Conflict** (I3): no write either way; backups of both sides; show resolution screen (§3.7). |
| No base yet (existing install or first sign-in), digests equal | Adopt token silently (nothing differs). |
| No base yet, both sides have data and differ | Conflict screen (reuses the existing first-sign-in conflict wording). |
| No base yet, local empty | Pull (with backup of the empty state skipped as nothing to lose). |
`pendingWrite` is resolved before the table is applied (§3.4).

### 3.3 Compare-and-swap push, no schema change
The push becomes a conditional update of the one row: *update where `user_id = me` and `updated_at = baseToken`*, returning the new `updated_at`; zero rows updated means someone else wrote first → treat as conflict by re-running the decision table. First-ever write is a plain insert (a duplicate-key failure means a row appeared → re-decide). This uses only the two existing columns (`snapshot`, `updated_at`); the token is always the **server-returned** value, never a client clock. **To verify before relying on it (I have not):** that PostgREST/supabase-js `update().eq().eq().select()` returns the affected rows as I expect in the current docs, that `updated_at` is not overwritten by a trigger in a way that breaks equality, that row-level-security permits UPDATE with these filters, and timestamp-precision round-tripping (microseconds vs milliseconds). The local fake backend models this; real Supabase behaviour stays **unverified** until tested on an isolated project (decision D2).

### 3.4 Lost replies and interruptions
Each snapshot carries `syncMeta = { deviceId, writeId, digest, txnCount }`. If a push's reply is lost, the stored `pendingWrite.writeId` is compared with the cloud row's `syncMeta.writeId` on the next contact: equal → our write did land, adopt its token and mark synced; different/absent → the write did not land, still dirty, retry. Rejected writes (HTTP errors) leave `dirty` true, so they are retried, and reloading cannot discard them because nothing replaces local data unless it is clean (or backed up and chosen).

### 3.5 Retry and recovery
While dirty and not in conflict: retry with backoff (2 s, 5 s, 15 s, 60 s, then every 5 min), and immediately on the browser `online` event, on tab becoming visible, and on boot. The visible status shows the number of unsynced changes and the next retry. A failure never clears dirty.

### 3.6 Backup before any replacement (guarantee, not best effort)
A separate store `arth_sync_safety_backups` (not the rolling auto-backups, no 2-minute throttle, no 3-entry trim, newest 10 kept, never pruned below what the last replacement used). Procedure: write → read back → compare digest and transaction count → only then replace. If the write fails (for example browser storage full) the replacement **does not happen**; the person is offered a downloaded file of the data and must confirm before anything is replaced. The existing `createVerifiedBackup` read-back pattern is reused.

### 3.7 Conflict resolution (decision D3: explicit choice, no automatic merge)
Screen shows counts and the IDs/descriptions present only on this device and only in the cloud. Choices: **Keep this device** (cloud copy backed up locally first, then replaced by this device's), **Use cloud copy** (this device backed up first, then replaced), **Decide later** (sync paused with a persistent banner, local edits keep saving locally), plus **Download both as files**. After a choice, base is reset and a reconciliation is run.
Why not auto-merge transactions: a transaction also moves account balances, card outstanding, bill and contribution links, budget and person totals, which live in other arrays; merging only `txns` could leave those inconsistent. A safe merge needs a per-record change log (architecture change) and is out of scope; the cost is that a true conflict needs one decision from the person and may mean re-entering a few records, which the difference list makes possible.

### 3.8 Reconciliation after every sync
After a push: read back `syncMeta` from the row and require `writeId`, `digest` and `txnCount` to equal what was sent. After a pull/adopt: recompute digest and ID set from the applied data and compare with the cloud's. A mismatch is shown ("N transactions differ", with IDs) and keeps the device dirty/blocked; it is never reported as synced. The last result is stored in `lastReconcile` and shown in Settings. (Reading back the full row after every push would double traffic; the full ID-set comparison happens on pulls, on conflict, and on Sync Now.)

### 3.9 Sync Now and status messages
Sync Now never forces anything: it runs the decision table once and reports the outcome. The status line is produced by one pure function from the state `synced (verified at T) | pending (n changes, retry at T) | offline/failed (reason) | conflict | reconcile-mismatch | paused`. The strings "Every change saves to cloud automatically" and "saved to Backup & Restore" are removed; the latter appears only as "Backup <time> verified, contains <n> transactions" after §3.6 succeeded.

### 3.10 Code layout (keeps the ARCH-004 freeze)
Logic goes in new modules, with App.jsx only wired to them (this is a data-integrity bug fix, which the freeze permits, but extraction keeps App.jsx from growing): `src/sync/decideSync.js`, `syncState.js`, `digest.js`, `safetyBackup.js`, `cloudClient.js` (CAS push/pull over an injected client), `syncEngine.js` (timers, network and storage injected), `statusText.js`. `cloudSync.js` keeps its production URL fallback unchanged (the harness guards cover it). The first-sign-in path (`runFirstAuthMigration` / `resolveConflict`) is kept and routed through the same client.

## 4. Migration of existing installs
Existing devices have no `baseToken`. First run after the update: if the local and cloud digests are equal, the token is adopted silently. If they differ, the conflict screen appears once (safe; no data replaced). This is a visible behaviour change for anyone currently out of sync.

## 5. Test plan
**Layer 1 — deterministic Node tests (fast, in `npm test`).** Engine and modules run against an in-memory backend and storage with a fake clock, fake timers and fault injection; no browser, no network.
1. `decideSync` table: every row above, plus stale-cloud (10 min / 10 s / future-dated) cases proving the age never matters.
2. Each reproduced failure as a named regression test (written first and shown failing against today's behaviour by porting the current rule into a reference implementation test, then passing): reject-then-reload; close inside the push delay then reopen at 10 s and 10 min; stale cloud then edit then Sync Now (one tap); divergent devices at both ages; lost reply; write applied twice.
3. Backups: replacement refused when the backup write fails; backup not throttled; backup read-back mismatch blocks replacement; newest 10 retained.
4. CAS: a stale token is rejected and re-decided; insert race; token is the server value.
5. Retry/backoff schedule, `online`/visibility triggers, dirty survives restart.
6. Reconciliation: induced mismatch (server drops a transaction) is detected and reported, not called synced.
7. Status text: one test per state; forbidden strings never appear in non-verified states.
8. **Randomised two-device model test with fixed seeds** (edit, push, reject, drop reply, go offline/online, reload, conflict choice): after every step assert I1 (every created ID is live somewhere or in a verified backup) and that the run's event log hash is identical across two executions of the same seed.
**Layer 2 — browser harness (existing `tools/sync-sim`).** The nine scenarios already recorded become pass requirements; run twice; compare result vectors and evidence hashes for identity; add scenarios for: conflict screen choices both ways, "Decide later", quota-full backup refusal, reconciliation mismatch display.
**Isolation guards (all layers):** synthetic users/data only; local fake backend; the harness refuses to start unless the configured Supabase URL host is `localhost`/`127.0.0.1`; every non-local request is aborted and recorded and fails the run if it targets `*.supabase.co`; tests never read real `localStorage` profiles.
**Gate before any proposal to merge:** full `npm test`, production build, lint (`src` = 4 baseline), both harness runs identical with all five properties passing, evidence and matrix updated with exact SHAs.

## 6. Decisions needed from the owner
- **D1 — Concurrency check:** use `updated_at` as the compare-and-swap token with no schema change (this design), or add a `version` column with a server-side check (stronger, needs a migration on production, which I will not run).
- **D2 — Real-backend verification:** the fake server cannot show Supabase-specific failures. Options: a separate Supabase test project with synthetic data (may have a cost; I will not create one without approval), or leave real-backend behaviour **unverified** and say so in the matrix.
- **D3 — Conflict policy:** explicit choice with backups, no automatic merge (this design). Confirm.
- **D4 — Backup storage:** localStorage with a forced file download if full (this design), or add IndexedDB for larger backups (more code).
- **D5 — One-time conflict screen** for existing installs whose local and cloud copies differ (§4). Confirm.
- **D6 — Read-only look at the production table definition** (column list, policies, triggers only; no rows) to check §3.3's assumptions. I have not done this; say yes or no.

## 7. Known limits that remain after this work package
Two tabs of the same device can still race (a cross-tab lock would be a follow-up); no per-record merge; reconciliation after a push checks `syncMeta`, not every ID; real-Supabase behaviour unverified unless D2 is approved; Plan Ahead nudge sync is covered only through the same snapshot and stays **Unverified** until its own scenario passes against the real client.
