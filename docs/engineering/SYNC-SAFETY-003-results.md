# SYNC-SAFETY-003 — results of the sync-safety work package

Date: 15 Oct 2026. Branch `wp-sync-safety` (not merged; `origin/main` = `5fc65e7` and untouched; nothing deployed).
Design: `SYNC-SAFETY-002-design.md`. Baseline evidence: `SYNC-SAFETY-001.md` at `7bf8ffa` (3 of 5 properties failing).

## Status in one paragraph
All five safety properties pass on the local, deterministic, synthetic-data harness, twice in a row with identical outcomes, and every previously failing scenario now passes. **This is not verification against real Supabase**, which was explicitly deferred by the owner and remains **unverified** (see Limitations). Cloud-sync verification for Web v1 is therefore **not complete**. Nothing was merged or deployed.

## Commits (exact)
| What | SHA |
|---|---|
| Baseline evidence (harness against the old code) | `7bf8ffa` (`wp-sync-evidence`) |
| Design + test plan | `01b9ca9`, updated by `6d50265` (D1/D2 decisions, Postgres verification) |
| Sync core + deterministic tests | `46ef191` |
| Engine wired into the app, conflict sheet, truthful status, browser harness v2 | `0f8a75b` |
| Harness check fix (R1) | `6d35d60` |
| Results/evidence/matrix (this document) | the branch head after `6d35d60`; a file cannot cite its own commit, so the final SHA is reported with the push |

## Checks run on the code at `6d35d60` (the docs commit on top changes no code)
- `npm test`: **1,763 / 1,763 pass**, 0 skipped (1,699 before + 64 new sync tests).
- Production build: passes. Lint (`eslint src`): **exactly the 4 baseline problems** (2 errors, 2 warnings); whole-repo lint additionally counts a gitignored Android bundle, as before.
- Browser harness (`node tools/sync-sim/run.mjs`), two consecutive runs: **15 of 15 pass in each**, outcome vectors identical (same MD5 of the ordered `{id, pass}` list); records `results/run-2026-10-15T10-40-55-903Z.json` and `results/run-2026-10-15T10-45-18-630Z.json`.
- Two earlier iterations of the harness failed `R1`: once because the check wrongly assumed the corrupted record was the newest (a harness mistake, fixed in `6d35d60`), and once because reconciliation was only run every 10 minutes (a real gap, fixed in `0f8a75b`: every write is now read back by default). Those intermediate records were not kept.

## The five properties
| # | Property | Before (`7bf8ffa`) | Now | Evidence |
|---|---|---|---|---|
| 1 | Durable local save before sync | Met | **Met** | `P1`: saved locally at once with the server offline, 0 writes, survived reload |
| 2 | Recoverable, immutable export | Met (harness only) | **Met, now including the app's own export** | `P2`: harness dataset SHA-256 unchanged; the app's Download backup, captured and hashed, holds exactly the device's transaction ids |
| 3 | Conflicts detected, not silently discarded | Not met | **Met** | `P3/P4`, `C-later`, `C-keep-local`, `C-use-cloud`, `L1`; unit tests for the decision table and conflict persistence |
| 4 | IDs/counts reconcile | Not met | **Met** | every write is read back and compared (ids and digest); `R1` shows a damaged cloud copy pausing sync; `P5b`/`P5c`/`P3/P4` end with device, cloud and backups reconciled |
| 5 | Interrupted sync cannot silently lose a transaction | Not met | **Met** | `P5a` (rejected write + reload), `P5b` (lost reply), `P5c` (closed inside the push delay), `Q1` (failed backup blocks replacement), `T1` (unreliable token pauses); the seeded model test |

## What changed (summary)
- **No more timestamp guessing.** Each device remembers the cloud version it last agreed with (token + content digest). "Unsynced" is derived from content, so it survives reloads and closing inside the push delay.
- **Writes are conditional.** One `UPDATE ... WHERE user_id AND updated_at = expected`; a concurrent change makes it update zero rows and the engine re-decides (never a read-then-write).
- **Conflicts replace nothing.** Both-changed becomes a recorded conflict with a sheet (keep this device / use the cloud copy / decide later / download either copy) and a banner. The side replaced is backed up first and the backup is read back; if it cannot be stored, nothing is replaced.
- **Lost replies** are recognised by a write id stored in the snapshot; **rejected and interrupted writes** stay unsynced and are retried (2 s, 5 s, 15 s, 60 s, then every 5 min, and on reconnect/visibility/boot).
- **Sync Now** never forces anything. **Status text** is generated only from verified states; "Every change saves automatically" and "saved to Backup & Restore" are gone.
- Code: `src/sync/*` (new), `src/components/SyncConflictSheet.jsx`, wiring in `src/App.jsx` (the freeze permits data-integrity fixes; logic was extracted rather than added to the monolith).

## How the tests were checked for being real
- **Negative control:** a model of the old rules (`src/sync/testing/legacy.js`) reproduces each documented loss in the same scenarios the new engine now passes (reject-then-reload, close-inside-delay, stale-cloud-then-Sync-Now, divergent devices).
- **Mutation checks** (engine deliberately broken, tests must fail): conflict turned into overwrite, pending write not persisted, stale writes allowed, backup skipped, token check removed, reconcile verdict removed, digest ignoring content, retry removed, backup not read back: each is caught. One change (removing the early return for a recorded conflict) is not caught because the decision table independently reaches the same outcome, so it is an equivalent change, not a gap.
- **Randomised model test:** 20 fixed seeds x 90 random steps (edits, restarts, offline spells, rejected writes, lost replies, time, conflict choices) on two devices; after every step no created transaction is missing from every device, the cloud and every verified backup; cloud tokens only advance; after healing the devices converge; a re-run of each seed produces the identical event log hash.
- **Isolation:** synthetic users/data; local fake backend; the harness refuses to start unless the dev server's own environment injection shows `VITE_SUPABASE_URL=http://localhost:54399`; every non-local request is aborted and recorded; the run fails on any request to `*.supabase.co` or any unconditional cloud write. Result in both runs: 0 Supabase requests, 0 unconditional writes (only `fonts.googleapis.com` was attempted and aborted). No real data, account or production project was used.

## Limitations (remaining, stated plainly)
1. **Real Supabase is unverified.** The fake server and the Postgres 16 experiments (`tools/sync-sim/pg-verify`) show the database-level semantics and the engine's behaviour; they do not show: how PostgREST answers a zero-row UPDATE (assumed an empty list), the production `updated_at` column type/precision, any trigger on it, the row-level-security policy for UPDATE, or timestamp round-tripping through the real API. **If the production column were coarser than milliseconds the concurrency check would not be reliable and the `version` column migration would be required** (the engine pauses instead of overwriting when it detects a token that did not advance, but that cannot undo a collision that already happened). Release gate: confirm the production table definition (read-only, needs the owner's decision D6) or run isolated testing on a separate project (needs the owner's authorisation, D2).
2. **Cost: each write is now followed by a read of the whole cloud copy** (reconciliation). This roughly doubles the data transferred per write; images inside transactions make this matter on mobile. `fullVerifyEveryMs` can relax it at the price of a longer window before a bad cloud copy is noticed.
3. **No automatic merge** (decision D3, confirmed by default and not objected to): a true conflict needs one decision and may mean re-entering a few records; the sheet lists how many exist only on each side. A per-record change log would be a separate architecture change.
4. **One-time conflict screen** for installs whose local and cloud copies differ and that have no sync history yet (nothing is replaced).
5. **Two browser tabs on one device** are not coordinated; a cross-tab lock is a follow-up.
6. If browser storage is too full to save sync history itself, sync stays safe but cannot record progress (status shows pending/failed).
7. Reconciliation compares transaction ids/counts and a content digest of the whole snapshot, not field-by-field semantics; after adopting a cloud copy the device's own re-normalised content is treated as "in sync".
8. The first-sign-in path now uses the same engine; it was exercised by the unit and model tests and by the harness through the empty-device adoption (`establish`), but the full first-sign-in screen flow (Welcome, OTP, profile) was not driven end to end.
9. **Plan Ahead nudge sync** travels in the same snapshot but has no scenario of its own: still **Unverified**.
10. Not verified on a real device or on the deployed site; nothing was deployed.

## Owner decisions still open
D6 (read-only look at the production table definition) and D2 (authorise isolated real-service testing) gate any claim about real Supabase. D4 (backup storage) was implemented as browser storage with the replacement refused if it cannot be written; a forced file download fallback and IndexedDB were not built. Merge to `main` needs the owner's explicit approval.


---

# Second work package (SYNC-SAFETY-004): local safety gaps closed — 16 Oct 2026

Branch `wp-sync-safety-2`, based on local `main` `8be4052`. **Not pushed, not deployed; `origin/main` untouched.** Code commits: `ad5b200` (integrity, verified backups, pinned conflict copies, file fallback, tab gate), `d458a60` (nudge / recovery / two-tab / sign-in scenarios, restore safeguards, preview-build guard, perf benchmark), `adc4cbf` (engine re-checks file-backup checksum). The docs/records commit on top changes no code; its SHA is reported in the hand-off message (a file cannot cite its own commit). Preview-verification proposal: `SYNC-SAFETY-005-preview-verification-plan.md`.

## Checks on code at `adc4cbf`
- `npm test`: **1,801 / 1,801 pass**, 0 skipped.
- Production build passes. `eslint src`: **exactly the 4 baseline problems** (2 errors, 2 warnings), none new.
- Browser harness against the local fake Supabase + fake sign-in, two consecutive runs: **31 of 31 pass in each**, identical outcome vector (same MD5 `cfc4f8dc17df27558119e6d675143c87`), 0 requests to any Supabase host, 0 unconditional cloud writes. Records: `results/run-2026-10-16T04-47-20-427Z.json`, `results/run-2026-10-16T04-56-32-841Z.json`.
- New scenarios: two tabs (TAB1–3), Plan Ahead nudge (BN1–3), backup-file fallback (FB1–2), restore from a safety backup (RB1), sign-in/recovery incl. existing installs with no history and divergent copies (SI1–SI6).

## What closed
- **Whole-snapshot verification:** backups and reconciliation compare every list record-by-record plus dangling references (transaction↔bill↔payment↔membership↔relationship↔fee links), not just transactions.
- **"Decide later" keeps both copies:** both versions are pinned (never pruned) until the conflict is resolved.
- **File fallback:** if browser storage cannot hold a backup, a recoverable export is downloaded and re-selected, verified against the exact data digest; if no verified backup can be secured, the replacement is refused.
- **Two tabs:** one owner tab (Web Locks, localStorage-lease fallback); other tabs show a paused screen; a foreign write marks a tab stale and its engine stops.
- **Manual restore** backs up both this device and the cloud copy first, and refuses if either cannot be secured.
- **Preview builds** cannot use the production Supabase project (`src/cloudConfig.js`).

## Bugs found by this work (fixed)
1. Browser harness: fresh installs auto-create a few lists, so every new device raised a conflict screen. Fixed (`hasUserData`).
2. A runtime-only initialisation-order crash in `App.jsx` (invisible to build and lint) was caught by the first harness scenario. Fixed.
3. A simulated device reload left the old engine running (duplicate backups). Fixed (`engine.stop()`).

## Test-quality checks
12 deliberate breaks of the code: 11 caught by tests (one needed a new test, added in `adc4cbf`). One ("backup restore rehearsal skipped") is behaviourally equivalent because a backup read back identical to its source cannot restore worse than the source; documented, not a gap.

## Performance (synthetic snapshots; device timings measured on loopback, phone times ESTIMATED from stated link profiles; verify on real devices)
Data: `tools/sync-sim/results/perf-2026-10-16.json`. Read-back adds roughly 40–50% to the time of each write and doubles the data moved per write; the dominant cost is the pre-existing whole-snapshot upload.
| Snapshot | Size | Digest | 4G good write (+read-back) | 3G write (+read-back) |
|---|---|---|---|---|
| typical year, no images | 0.28 MB | 13 ms | well under 1 s | 6.2 s (+2.7 s) |
| 500 txns, no images | 1.9 MB | 76 ms | n/a here | 40 s (+16 s) |
| 500 txns + 10 photos | 2.07 MB | n/a here | n/a here | 44 s (+18 s) |
| 500 txns + 25 photos | 5 MB | n/a here | 4.3 s (+1.7 s) | 105 s (+42 s) |
| 1000 txns + 60 photos | 12 MB | n/a here | n/a here | 251 s (+101 s) |
5 MB is about the usual localStorage ceiling (not verified per browser): large photo sets are the risk. "n/a here" = not tabulated in this document; see the JSON.

## Remaining limitations (stated plainly)
1. **Real Supabase is still unverified** (zero-row PATCH response, `updated_at` type/precision/trigger, UPDATE policy). If the column is coarser than a millisecond, a `version` column migration is needed.
2. Two-tab, nudge and sign-in evidence is local fake-backend only; fake sign-in is not real email OTP. No real-device or deployed-site test.
3. Web Locks in Android WebView unverified; the lease fallback is not atomic.
4. Pinned conflict copies (two) may not fit on very tight storage; there is no file fallback for those holds (status tells the person to use Download).
5. A normaliser (`dedupeSettlementTxns`) may drop records; this is reported (restore drops / reconcile pause), not prevented.
6. The preview-build guard relies on `VERCEL_ENV` at build time; verified in a local build only, not on Vercel. Earlier preview deployments of previous branches may have used the production backend.
7. A stale tab stays halted until reload. Signed-out edits cannot sync until sign-in.
8. One-time conflict screen for existing installs whose local and cloud copies differ.
**Cloud sync is NOT declared production-safe.**
