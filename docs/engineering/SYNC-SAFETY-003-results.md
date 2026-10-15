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
