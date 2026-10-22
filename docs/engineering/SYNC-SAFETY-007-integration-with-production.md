# SYNC-SAFETY-007 — sync-safety work rebased onto production `main`

> **Update:** risk R2 below (account isolation across sign-out) is addressed by the guard in `SYNC-SAFETY-008-account-isolation.md`; the "empty cloud" account-switch row and the D1/D2 notes are read together with that document. Verification numbers in §4 are from the integration commit; the final numbers are in SYNC-SAFETY-008 §7.

Branch `wp-sync-safety-3`, built on `origin/main` = `faaf01d` (the deployed production commit). **Local candidate for review: not pushed to `main`, not merged, not deployed, no production setting changed.**
Supersedes the branch `wp-sync-safety-2` (merge base `5fc65e7`, 15 commits behind production, no offline resume). The Android auth branch is NOT part of this work.

## 1. Why this exists
Reviewing `wp-sync-safety-2` against production showed a data-safety hazard in production itself. Against the synthetic fake backend, the production build uploads this device's data over the signed-in account's cloud copy while the "Two versions of your data found" screen is still waiting for a choice (account-switch harness, other account holding 5 transactions: cloud went 5 -> 12).
**Root cause (read from the code, reproduced in the harness):** at boot with no session, `applySignedOut()` sets `cloudHydrated = true`. After a fresh sign-in the old automatic upload effect (`!cloudHydrated` gate only) therefore fired 900 ms after the account appeared, ahead of the asynchronous first-sign-in check that raises the conflict screen. The sync engine removes that upload path: nothing is sent until the engine's own boot decision has run (`syncReady`), and every later write is a compare-and-swap on the version this device last agreed with.

## 2. What was integrated, and how production behaviour was kept
The merge conflicts (App.jsx: imports, the render gate, the banners; package.json: the test list) were resolved by hand, not by taking either side. The surrounding auto-merged code was then read, because the two changes rewrite the same sign-in and sync wiring.

| Production piece | Status in this candidate |
|---|---|
| `domain/identity/offlineResume.js` (`canResumeOffline`, `classifyAuthCheck`, `OFFLINE_CHECK_TIMEOUT_MS`) | untouched |
| `checkCloudUser` (startup account check, token-expiry/unreachable classification) | untouched; `cloudSync.js` is byte-identical to production |
| `offlineResume` state, `offlineResumeRef`, `offlineRetryRef`, `offlineReenterRef`, the offline banner, the 8 s re-check, `settled` flag | untouched |
| `sessionRestoredOnBootRef`, `resumedFromOfflineRef`, `firstAuthRanRef`, `firstAuthState` and the effect that returns an offline-resumed device to offline mode if the check cannot finish | untouched (the engine plugs into the two places that used to call pull/push/first-sign-in matrix) |
| An offline-resumed device has no cloud user, so **no engine exists** and nothing can be sent until the server confirms the account | preserved (`useSyncEngine` creates the engine only for a confirmed account) |
| `loadCloudSnapshot` / `saveCloudSnapshot` | still exported from `cloudSync.js`; **App.jsx no longer calls them** (the engine uses `src/sync/supabaseCasClient.js`). They are now unused legacy code; removing them is a separate decision |
| First-sign-in screens (`CloudConflictScreen`, `CloudStateUnknownScreen`, `MasterUserProfileScreen`) | kept; their decisions now come from the engine's decision table |

### Integration decisions (need your review)
* **D1 — no question after an offline reconnect when the cloud has not changed.** Production always asked "which copy to keep?" after an offline resume because it had no history to tell "only I changed" from "both changed". The engine remembers the cloud version this device last agreed with. If the cloud is still at that version, the offline entries are a strict addition and are sent with one conditional write; if the cloud also changed, the person is asked (unchanged behaviour, tested: OS9, CI7). **This is a deliberate behaviour change.** If you prefer production's "always ask", it is a small, separate change that costs a question on every offline reconnect.
* **D2 — upgrade day.** A device with no sync history (every device the day this ships) is compared once with the cloud: equal content -> adopted silently; different -> **one** conflict choice, nothing replaced (SI1–SI6). Expect some people to see the choice once.
* **D3 — new persisted key** `arth_nl_card_note_seen` (typed-entry counter) is registered as device-only; the engine's key-inventory test forces this decision for every new key.
* **D4 — test simulator determinism** (see §5).

## 3. Reviewability
* `src/App.jsx`: **+147 / −259** versus production (the branch it came from was +470 churn on an older base). The tab gate moved to `src/components/TabGate.jsx` (27 lines, verbatim) and the engine wiring to `src/sync/useSyncEngine.js` (79 lines, no logic change). What remains in App.jsx is the part that has to touch app state: the first-sign-in/conflict handlers, the `syncReady` change notifier, the status card and the settings backup list.
* New code is almost entirely under `src/sync/` (engine, decision table, digest, safety backups, integrity, tab ownership, status text, CAS client) and `src/components/` (conflict sheet, file-backup sheet, tab-paused screen), each with tests.
* Decoupled from the Android auth branch: that branch now merges into this one with a single `package.json` test-list conflict (App.jsx and cloudSync.js combine cleanly). Proven in a scratch worktree only; nothing was merged.

## 4. Verification (all against SYNTHETIC data and local fake backends)
Final code: `wp-sync-safety-3` head (see the commit hash in the report). Results:

| Gate | Result |
|---|---|
| `npm test` | 1,857 / 1,857 pass (production baseline 1,758; +99 sync tests); repeated runs identical |
| Production build | passes |
| Lint | 5 problems = the production baseline (same files/lines); none added |
| Offline-startup / offline-resume suite (`tools/offline-startup/run.mjs`, adapted, §5) | 29 / 29 pass; outcome vector identical before and after the App.jsx extraction |
| Sync-safety harness (`tools/sync-sim/run.mjs`), 31 scenarios (rejected writes, interrupted pushes, stale snapshots, divergent devices, tab ownership, backups, restore, sign-in) | 31 / 31 pass in two consecutive runs with identical outcome vectors (records `tools/sync-sim/results/run-2026-10-22T00-47-43-127Z.json`, `…T01-15-11-338Z.json`) |
| Account switch (`tools/offline-startup/switch.mjs`), other account has different data | choice screen shown; **other account's cloud stays at 5** (production: overwritten to 12) |
| Account switch, other account's cloud empty | previous account's 12 local transactions are uploaded into the new account without a question. **Identical on production**; see risk R2 |
| Typed-entry browser harness (`tools/nl-entry/browser.mjs`) | 28 / 28 pass; combined typed-entry + offline + reconnect + conflict scenarios CI1–CI7 also pass in the offline suite |
| Android auth harness compatibility (scratch merge, not committed) | all scenarios identical to the standalone branch; in "local data + different cloud copy" the cloud now stays `C001–C009` until the person chooses |
| PostgreSQL 16 compare-and-swap checks (`tools/sync-sim/pg-verify/cas-semantics.sh`, throwaway local cluster) | reproduced: ms-precision tokens match on `timestamptz`/`timestamp(6)` but not `timestamp(0)`; a `BEFORE UPDATE` trigger that sets `now()` overrides the client token; two overlapping conditional UPDATEs -> exactly one wins, the other updates 0 rows; check-then-write and plain upsert lose updates |

## 5. Harness changes made for the integration (so the results are comparable)
* `tools/offline-startup/run.mjs`: the "established phone" fixture now performs its first sync (answering the one-time choice with "keep this device") so the device holds sync history, as every real returning device does; "another device changed the cloud" is applied after that sync. OS2/OS4/OS10b/CI4/CI5 now expect no question and conditional writes only (D1); OS9/CI7 (both changed) still expect the question. `USE_CLOUD` also matches the sheet's "Use the cloud copy".
* `tools/sync-sim/lib.mjs`: the amount field is matched exactly (`"0"`), because production's typed-entry box has a placeholder containing "0".
* `src/sync/testing/sim.js`: **a defect in the inherited test simulator.** The "same seed, same event log" model test failed intermittently (1 in 40 runs on `wp-sync-safety-2` itself, 3 in 40 after merging). Two devices' timers on the same instant ran their engines concurrently through real asynchronous crypto, so which write won varied. The safety invariants (no transaction lost, tokens advance, devices converge) held in every run; only reproducibility failed. The simulator now waits for all engines after each timer; 0 failures in 60 isolated runs afterwards. No engine code changed.

## 6. Unresolved risks (not verified; do not read synthetic results as proof)
* **R1 — real Supabase compare-and-swap and RLS are unverified.** PostgREST's answer to a zero-row UPDATE (assumed `[]`, no error), the real `arth_snapshots.updated_at` column type (a `timestamp(0)` would make distinct writes share a token), any trigger that rewrites `updated_at`, and the UPDATE/INSERT row-level-security policies are unknown to me. This session cannot read them (no auth-config tool; outbound access to the project is blocked). **Needs your approval to run read-only structure queries** (column types, triggers, policies; no row data) on the production project, or for you to run them. Until then the engine's conditional writes are verified only on a local PostgreSQL and a fake server.
* **R2 — account isolation across sign-out (pre-existing): RESOLVED in `SYNC-SAFETY-008`.** The phone's data now has a recorded owner; a different account signing in is asked, and nothing is uploaded or replaced until the person chooses (with a verified backup first).
* **R3 — two real devices.** Two-device behaviour is modelled (seeded randomised model, two browser contexts on one fake server). It has not been run on two physical devices against the real service.
* **R4 — mobile data-transfer overhead.** Every successful write is followed by a read of the whole cloud copy (reconciliation), roughly doubling transfer per write; measured only on the synthetic benchmark (`tools/sync-sim/perf.mjs`, earlier record `results/perf-2026-10-16.json`, not re-run here). Large images inside transactions make this matter on mobile data. A relaxed verification interval exists (`fullVerifyEveryMs`) at the price of a longer detection window. Needs a real-device measurement.
* **R5 — real-device verification** of the whole flow (Android app and phone browsers, flaky networks, the PIN screen interplay, storage-full behaviour) has not been done.
* **R6 — D1 and D2 are behaviour changes** (§2).
* **R7 — no automatic merge:** a true conflict needs one human decision and may mean re-entering a few records.
* **R8 — dead code:** `loadCloudSnapshot`/`saveCloudSnapshot` remain but are unused.
* **R9 — App.jsx** is still ~20k lines; the remaining wiring is intentionally left where it touches app state.

## 7. Rollback
* Nothing is deployed. To drop the candidate: delete the branch.
* After a future deploy: revert the merge commit on `main` (Vercel redeploys the previous build). Data safety on rollback: the engine stores its history under `arth_sync_state` and backups under `arth_sync_safety_backups`; the old code ignores both keys, and local data keys are unchanged, so rolling back leaves the person's data and the cloud copy as they were. Safety backups stay on the device (restorable from Settings > Backup while the new build is installed; downloadable as files before rolling back).
* Rolling back re-exposes the production hazard in §1 (upload racing the first-sign-in choice).

## 8. Staged rollout proposal (for approval; nothing started)
1. You review this document and the diff; decide D1/D2 and R2.
2. Read-only production structure check (R1), or you provide the output of the queries.
3. Preview deployment of the branch with the preview guard (`cloudConfig.js`) so it cannot touch the production project; exercise it with synthetic accounts on two real devices.
4. Merge to `main` only after your approval; first production use with a single test account that holds no real data.
