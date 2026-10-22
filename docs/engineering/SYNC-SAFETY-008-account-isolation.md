# SYNC-SAFETY-008 — account isolation on a shared phone, and what the production schema shows

Branch `wp-sync-safety-3`. **Not merged, not deployed, no production setting changed.** Builds on `SYNC-SAFETY-007-integration-with-production.md`.

## 1. The problem
Signing out keeps the device's data (by design: nothing is lost if the person signs back in). Nothing recorded *whose* data it was. So after account A signed out and account B signed in, the sync rules treated the phone's data as B's:
* B's cloud row missing or without user data -> the rules wrote A's transactions into B's account (no question).
* B's cloud populated -> a question was asked, but about "your two copies", as if both were B's.
Production had the same behaviour, plus an upload that raced the question (`SYNC-SAFETY-007` §1; fixed by the engine).

## 2. The guard
**Ownership record** `arth_data_owner = { userId, email, at, source }`, device-level, never synced (registered as device-only in the key-inventory test).
It is written only when ownership is *known*:

| When | `source` |
|---|---|
| the phone holds no user data (nothing to protect), including a fresh install | `clean-device` |
| a session the server already knew continues (restored on startup, or resumed from offline and then confirmed) and no owner is recorded | `session` |
| the engine's own sync history already names this account (devices that synced before this record existed) | `sync-history` |
| the person signs out (the leaving account owns what stays) | `sign-out` |
| the person chooses to add the phone's data to the new account | `transfer` |
| the person chooses to start fresh | `start-fresh` |

**Every sync cycle checks it before any cloud call** (`ownershipGate`, `src/sync/syncEngine.js`): same account -> proceed; nothing to protect -> claim and proceed; **different recorded owner -> stop**; data with *no* recorded owner on an interactive sign-in -> stop. "Stop" means: no read, no write, no retry, no replacement, status `ownership`, and the app shows `DeviceOwnershipScreen` instead of the app. The block is derived from storage each time, so it survives reload; a restored session for the new account does **not** override a recorded different owner (tested: close on the question, reopen).

**The person's choices** (`engine.resolveOwnership`), each only after a *verified* pinned backup of the phone's data (if it cannot be verified, nothing changes):
* **Start fresh as this account**: needs a connection (reads this account's own cloud copy first); replaces the phone's data with *only* this account's data (or an empty account), then records the owner. The previous account's data stays in the pinned backup (Settings -> Backup & Restore -> Sync safety backups) and in its own cloud copy.
* **Add this phone's data to this account** (for another account's data this needs a second confirmation): records the transfer. It uploads nothing by itself: the next sync still follows the normal rules, so a populated cloud copy still produces the explicit "two copies" choice.
* **Sign out and decide later**: nothing changes.

**Why "start fresh" builds its own snapshot.** The app's restore function deliberately *keeps* the device's current list when the incoming snapshot lacks that key (so a snapshot saved before a feature existed does not wipe it): billers, membership relationships, gifts, goals, expected income, insurance, commitments, pay groups and others. Applying B's cloud copy (or nothing) would have left A's lists in place and synced them into B. `startFreshSnapshot` makes every data key present on the phone explicitly empty, lays B's own data over it, and the engine then checks that no transaction of the previous account remains (otherwise it pauses instead of recording success). Verified in the real app (AS7: A's goal is gone from the phone and absent from B's cloud copy).

## 3. The conflict-screen optimisation (decision D1), restated
A question is skipped **only** when the engine can show the copies have not diverged: a recorded common point *for this account* exists, the cloud token still equals it, and ownership is this account's. Everything else asks: cloud moved and this side changed (`both-changed`), no common point and both hold data, a common point recorded for a different account (history is per account), a different owner. Identical content is adopted silently (nothing to choose). Tests: `decideSync` table cases, `OS9`/`CI7` (both changed -> asked), the ownership suite.

## 4. Production schema inspection (read-only; structure only, no row data, no writes)
Project `iggsdctjjkdknmcnibwi`, queried through the Supabase connector with catalog-only statements. Results for `public.arth_snapshots`:

| Item | Observed | Meaning for the sync engine |
|---|---|---|
| `updated_at` | `timestamp with time zone`, precision 6, nullable, default `now()` | Matches millisecond tokens (microsecond storage); the earlier risk of a `timestamp(0)` column colliding tokens does **not** apply. Nullable: a NULL token would read back as no common point (the engine then asks rather than writes) |
| Triggers | none | Nothing overrides the client-supplied `updated_at`; the engine's tokens are stored as sent |
| Constraints | PK `id`; `UNIQUE (user_id)`; FK `user_id -> auth.users(id) ON DELETE CASCADE` | One row per account; a second insert fails with 23505 (the engine treats it as "a row appeared": decides again); deleting an auth user deletes the row |
| RLS | enabled, not forced; one policy "Users can only access own data": `FOR ALL`, role `public`, `USING (auth.uid() = user_id)`, `WITH CHECK (auth.uid() = user_id)` | One account cannot read, update, delete or insert another account's row, and cannot re-assign a row to another user. `anon` has no `auth.uid()`, so sees nothing |
| Grants | `anon` and `authenticated` hold every table privilege, including `TRUNCATE`, `TRIGGER`, `REFERENCES` | RLS is the only guard on rows. `TRUNCATE`/`TRIGGER`/`REFERENCES` are not governed by RLS (PostgREST does not expose TRUNCATE, but the privilege exists). **Hardening suggestion, not performed:** revoke those three (and probably all of `anon`'s) privileges. Needs your approval; low urgency |

**Still unverified (cannot be read from structure):** how PostgREST answers a zero-row conditional `UPDATE` (documented behaviour with `.select()` is HTTP 200 and `[]`; the adapter treats `[]`, and also a non-array, as "conflict", which is the safe reading, and treats any error as a failure, never as success); that the `+00:00` token text round-trips through the `.eq("updated_at", token)` filter on the real service; behaviour under two real concurrent writers. These need a throwaway test project or branch (no production writes). Exact read-only SQL used (re-runnable; none touches rows):

```sql
-- columns and precision
select column_name, data_type, datetime_precision, is_nullable, column_default
from information_schema.columns where table_schema='public' and table_name='arth_snapshots' order by ordinal_position;
-- constraints, indexes, triggers, RLS flag, policies, grants (catalog only)
select 'constraint', conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.arth_snapshots'::regclass
union all select 'index', indexname, indexdef from pg_indexes where schemaname='public' and tablename='arth_snapshots'
union all select 'trigger', tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid='public.arth_snapshots'::regclass and not tgisinternal
union all select 'rls', relname, 'rowsecurity='||relrowsecurity||' force='||relforcerowsecurity from pg_class where oid='public.arth_snapshots'::regclass
union all select 'policy', policyname, 'cmd='||cmd||' roles='||roles::text||' using='||coalesce(qual,'-')||' check='||coalesce(with_check,'-') from pg_policies where schemaname='public' and tablename='arth_snapshots'
union all select 'grant', grantee||':'||privilege_type, '' from information_schema.role_table_grants where table_schema='public' and table_name='arth_snapshots' and grantee in ('anon','authenticated','public');
```
Interpretation guide: a `timestamp(0)` or `timestamp` without time zone would be a defect (collisions / session-time-zone dependence); any non-internal trigger touching `updated_at` would invalidate the compare-and-swap; a policy that is not `auth.uid() = user_id` on both USING and WITH CHECK would break isolation.

Other observation (Vercel, names only; no values read): the project has one environment variable whose *name* is a string beginning `sb_publishable_…` (applied to development, preview and production). It is not `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, so it appears to be a misnamed entry and has no effect on the build (the app falls back to its built-in production defaults; preview builds are held local-only by `cloudConfig.js`). Worth cleaning up in the dashboard; not touched.

## 5. Tests added (all synthetic)
* `src/sync/ownership.test.js` (41 tests): A -> sign-out -> B with B's cloud empty and populated; start fresh and transfer, each with empty and populated cloud; unsynced edit made as A survives in the backup; returning to A; same account out and in; fresh install (populated and empty cloud); offline-resumed/restored session with and without a recorded owner; close on the question and reopen; data with no owner on an interactive sign-in; failures while resolving (no connection, unverifiable backup) change nothing; repeated reloads keep it blocked; the pure classification table; the start-fresh snapshot; the decision table for the conflict question; per-account history; and a **20-seed randomised multi-account model** with the invariant "no account's cloud copy ever contains a transaction that was neither created by that account nor deliberately transferred to it, and nothing is lost", run twice per seed for reproducibility.
* **Mutation check:** with the gate removed, 34 of the 41 fail; restored, all pass.
* `tools/offline-startup/accounts.mjs` (13 scenarios in the real app against the fake backend): AS1/AS2 (empty and populated), AS3 (start fresh), AS4a/AS4b (transfer: second confirmation; populated cloud still asks), AS5 (sign out from the question), AS6 (closed and reopened on the question), AS7 (lists the app keeps), AS8/AS8b (interruption while resolving, then retry), AS9 (same account), AS10 (fresh install), SAFE.

## 6. Behaviour changes and open decisions
* **D5 — new question.** After a sign-out and a *different* account's interactive sign-in on a phone that still holds data, the person is asked what to do with that data. Previously: silent upload (empty cloud) or a question framed as two copies of one person's data.
* **D6 — data with no recorded owner** (phones that signed out before this version): treated as "not linked to an account yet" and asked, with "add it to this account" as the first choice. Signed-in phones that simply continue are claimed without a question.
* **Sign-out does not first push unsynced edits.** They stay on the phone, flagged on the question, and are kept in the backup if the person starts fresh. A "send my changes before signing out" step is a possible follow-up.
* **Restoring a backup** of another account's data into the current account is still an explicit action under the existing restore confirmation; it is not blocked.
* **Forced sign-out by the server** (session revoked) does not run the sign-out hook; the owner was already recorded when the account first synced on this phone.

## 7. Verification (final candidate; all synthetic data, fake backends, local only)
Commit: see the report (the commit that carries this table is the head of `wp-sync-safety-3`).

| Gate | Result |
|---|---|
| `npm test` | 1,898 / 1,898 pass (production baseline 1,758; +140: sync engine/model tests, 41 ownership tests) |
| Production build | passes |
| Lint | 5 problems = production baseline; none added |
| Sync-safety harness, 31 scenarios (`tools/sync-sim/run.mjs`) | 31 / 31, two consecutive runs, identical outcome vectors (`results/run-2026-10-22T07-35-20-394Z.json`, `…T07-45-21-418Z.json`). SI2–SI4 updated to the new contract (an existing install with no recorded owner is asked first; "Add it to this account" then behaves as before) |
| Offline-startup / offline-resume suite (`tools/offline-startup/run.mjs`) | 29 / 29 (unchanged expectations) |
| Account-isolation suite in the real app (`tools/offline-startup/accounts.mjs`) | 13 / 13 (AS1–AS10, SAFE) |
| Original account-switch script (`switch.mjs`) | other account has data: cloud stays at 5 (production: 12). Other account's cloud empty: stays empty, 0 (production: 12) |
| Typed-entry browser harness (`tools/nl-entry/browser.mjs`) | 28 / 28 |
| Android auth harness against a scratch merge of `wp-android-auth-handoff` (not committed) | 1,906 unit tests pass; all link flows unchanged; in "local data + a different cloud copy" the person now meets the ownership question first, local data and the cloud copy are untouched, and the link behaves identically to the typed code. The only merge conflict is the `package.json` test list |

Not verified: real Supabase conditional-write behaviour (zero-row UPDATE response, token round-trip through the filter), two real devices, mobile data overhead, any real device; see `SYNC-SAFETY-007` §6 (R1, R3–R5) and §4 above.
