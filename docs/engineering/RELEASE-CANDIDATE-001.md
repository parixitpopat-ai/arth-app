# RELEASE-CANDIDATE-001 — typed-sentence entry + offline startup (integration, 17 Oct 2026)

Local only. Not pushed, not deployed. Production not accessed. Branch `release-candidate-1`.

## Baseline and inputs
- Production baseline: `origin/main` = `5fc65e7` (deployment `dpl_CoXbSdX9NcxuA7AnWNhgSseNSYKy`, still the latest production deployment when checked).
- Merged, each by an explicit merge commit, in this order:
  1. `release-nl-gated-preview` `c2339ad` (typed entry `5948c62`, `?nl=1` gate `0f7f0a7`, preview-build production guard `c2339ad`) -> merge `f11108e`
  2. `wp-dedupe-settlement-only` `f993d5a` (= `9747a3d`, the settlement-cleanup fix, replayed on the production base) -> merge `ec4feef`
  3. `wp-offline-startup` `0b7451a` (code `c7e2911`) -> merge `4859092`
  4. Then one commit of combined tests (`232ae50`) and this record.
- All original branches are untouched: `release-nl-gated` `0f7f0a7`, `release-nl-only`, `wp-nl-entry`, `main-nl-gated`, `main`, `wp-dedupe-settlement`, `wp-offline-startup`, `wp-sync-safety*`, `test-merge-nl`.

## Is the sync-safety work required? Determination: no engine; one fix and one guard
- The sync-safety **engine** (compare-and-swap, base tokens, dirty tracking, pinned conflict copies, tab gate) is NOT required by this combination and is NOT included. Reasons: typed entry saves through the unchanged Quick Add path; offline startup was designed and tested on the production sync, and its reconnect step uses the production first-sign-in comparison, which asks before replacing anything; the engine has never been checked against real Supabase and has 3 more conflict areas with the offline startup code (see `OFFLINE-STARTUP-001.md`). Including it would turn this into a different, riskier release.
- Included from that work: (a) the settlement-cleanup fix (production code today deletes lookalike settlement/refund records on every load and save; it also runs on the load that follows an offline reopen), and (b) the preview-build guard (without it a preview deployment of this code would use the production Supabase project).
- Consequence, stated plainly: the known weaknesses of the production sync remain (`SYNC-SAFETY-001.md`: last-writer-wins whole-snapshot upload; 3 of 5 safety properties failed in the baseline harness). The 31-scenario sync-safety harness tests the engine, which is not in this candidate, so it was **not run** here; it would fail by design. The sync paths this release touches are covered by the offline-startup harness instead (below). If you want the engine in the release, that is a separate decision with real-backend verification first.

## Conflict resolutions (all deliberate)
| Where | Conflict | Resolution |
|---|---|---|
| `package.json` test list (3 merges) | same line edited on both sides | union of both lists, entries for files that do not exist on this base dropped (a first attempt kept 12 sync-engine test names that do not exist here; `testInventory.test.js` caught it) |
| `src/App.jsx` imports (merge 2 and 3) | adjacent import lines | both kept |
| `src/cloudSync.js` | no textual conflict; semantic check: guard (`resolveCloudConfig`) and `checkCloudUser` both present, `getUser` path unchanged, dev bypass now inside the guard | read and kept as merged |
No conflict in the startup effect, first-sign-in code, or Quick Add.

## Verification (candidate code identical to `232ae50`)
- `npm test`: 1,757 / 1,757 (1,699 base + 32 typed-entry parser + 6 gate + 3 preview guard + 7 settlement fix + 10 offline). Production build passes. Lint: the 4 baseline problems.
- Typed-entry browser harness (20 checks, dev build): 2 runs, 20/20, identical hash `9d072715f9ef7671951fac74ae9daf2d`.
- Offline-startup + combined harness (production build, fake backend, synthetic data; 29 checks): 2 runs, 29/29, identical hash `da5b73fd6ac92861b41f9e4d96447825`. Includes the combined checks:
  - CI1/1b typed entry while offline-resumed: gate on, filling writes nothing, double-tap Save stores exactly one, charged to the card, no cloud writes; a second offline cold start shows no duplicate.
  - CI2 plain address offline: input hidden, ordinary Quick Add works.
  - CI3 card-bill sentence refused offline, nothing written.
  - CI4/CI5 reconnect: account confirmed, person asked, nothing sent or replaced; after "keep this device" the typed and the plain entry each reach the cloud exactly once, the 12 originals are unchanged, local = cloud.
  - CI5b the typed entry is a card expense with no bank movement; CI6 repeating the sentence is flagged as a possible duplicate, not blocked.
  - CI7/7b the other device changed the cloud meanwhile: asked; both records exist; choosing the cloud copy keeps the other device's record and backs up the typed entry.
- Account switching parity: the same sign-in A -> sign-out -> sign-in B steps (B empty; B with data; keep cloud; keep device) give identical results on the production build and on this candidate (`tools/offline-startup/switch.mjs`).
- Environment finding (read-only checks): the Vercel project has ONE environment variable (an oddly named key, scope development+preview+production) and no `VITE_SUPABASE_*`. So every build, preview or production, falls back to the production Supabase project hard-coded in the source. A preview of the OLD code therefore talks to production Supabase and real accounts work there. With this candidate's guard, a Vercel **preview** build never uses it: checked locally with `VERCEL_ENV=preview` and no variables, the page opens straight to "Create a PIN" (no sign-in screen) and attempts no non-local request; the same code as a production build shows Welcome / Sign Up / Sign In. Not verified: that Vercel sets `VERCEL_ENV=preview` on this project's preview builds.

## Known limitations (carried into the release)
- Real Supabase, real phones, the installed home-screen app: untested.
- Production sync weaknesses remain (above). A device switched to another account uploads its local data to that account when the new account is empty (same on the production build today).
- After offline use, reconnecting always shows "Two versions of your data found" when both sides hold data, even if nothing differs.
- Service worker: stale cache until the next online visit; first visit cannot work offline; the browser may evict the cache.
- Typed entry v1 limits (INR, common English phrasing, ?nl=1 only) as in `NL-ENTRY-001`.

## Deployment procedure (needs your explicit approval; nothing below has been done)
1. Pre-flight: confirm the candidate SHA, `origin/main` still `5fc65e7`, production deployment still `dpl_CoXbSdX9…`.
2. Safest first step (optional): push the candidate as a branch; Vercel builds a PREVIEW (behind your Vercel login, local-only because of the guard). Check the deployment is a preview, holds no production alias, and its page opens to "Create a PIN" with no network calls to `supabase.co`. Typed entry and offline reopen of the UI can be tried on a phone there with hand-entered data; sign-in cannot (no cloud in preview).
3. Production: pushing `main` triggers the production deployment. The agent environment refused a push of a non-`main` branch as a production deploy earlier, so you may need to do this step yourself or grant the permission. Fast-forward `main` to the candidate only (no force push).
4. After deploy: read the deployment (state READY, commit = candidate, alias `arth-app.vercel.app`), then run the controlled validation below.

## Controlled production validation (safeguards)
1. Download a backup first (Backup & Restore). One device only; close other tabs and devices.
2. Use `https://arth-app.vercel.app/?nl=1`. Typed entry stays hidden at the plain address.
3. Online: add one small entry labelled NLTEST; confirm it appears once, then reload.
4. Offline: with the app loaded, enable airplane mode, add one small entry, close the app fully, reopen it in airplane mode (PIN, then banner "Offline"), add a second entry.
5. Reconnect: the app asks which copy to keep. Choose "Keep this device" only if you made no change on another device; the other copy is backed up first. Check each NLTEST entry exists exactly once and your balances are unchanged.
6. Stop and roll back on: any "Can't reach your Arth account" wall with data present, a missing earlier transaction, a duplicate, or the choice screen not appearing after offline use.
Not safe to test in production: two devices changing data at once (the production sync can overwrite).

## Rollback
- Fastest: Vercel dashboard -> Deployments -> `dpl_CoXbSdX9NcxuA7AnWNhgSseNSYKy` (commit `5fc65e7`, marked rollback candidate) -> promote / "Instant rollback". (MCP route: `request_promote`; needs your approval.)
- Git: `git revert -m 1 <merge commits>` on `main`, or reset the branch used for production to `5fc65e7` with your approval; then push triggers a rebuild.
- Devices that already registered the service worker: the rolled-back build no longer registers it, but the old worker stays installed until replaced. Rolling back therefore needs a build that unregisters it (ship a tiny `sw.js` that calls `registration.unregister()` and clears the `arth-shell-v1` cache); the app files stay network-first, so users get the rolled-back page whenever online. This is a real limitation of any service worker rollback.
- User data is never modified by the rollback; entries made offline stay in the device's storage.

## Addendum (18 Oct 2026): typed entry ON by default (branch `rc2-nl-always-on`)
Requested after the production release of `3db38bf`. `isNaturalLanguageEntryEnabled` now returns true unless the address carries exactly one `nl=0` (an emergency off switch that needs no deployment). Nothing is stored. Checked locally: 1,757 / 1,757 unit tests (6 gate tests rewritten), build, lint = 4 baseline; typed-entry browser harness 22/22 twice, identical hash `1d234dd06847c4eda29bd7c7ef5a193f`; offline + combined harness 29/29 twice, identical hash `8436b278cc8d3b2067a10e45d214cdea`. The typed-entry harness now computes "today" in Asia/Kolkata like the browser (it had used the machine's UTC date, which disagreed for 5.5 hours a day). Not deployed.

## Addendum 2 (18 Oct 2026): designer review applied (branch `rc3-nl-ux`, not deployed)
One 48 px row (₹ placeholder, icon button, Enter fills), collapses to the sentence with Edit; "Filled" tags that clear on edit; Save stays enabled and, when only the account is missing, scrolls to and highlights the Account field with "Choose an account to save" (`saveDirect` still refuses without an account); "Choose account" in empty-field style; matching cards directly under the Account field (name ··1234, 44 px); one amber message at a time (13 px, icon) saying what is wrong and what to do; card-bill / income / refund / repayment sentences name what was detected and offer "Open full form" with the amount carried over; shortened card note shown the first three times; category suggestion as a chip inside the Category field ("Name · Suggested", never applied unless tapped). While a typed entry is active Category and Account stack full width (the half-width Account field truncated "Choose account" at 320 px). Verification: 1,763 / 1,763 unit tests; build; lint = 4 baseline; typed-entry harness 32/32 twice, hash `8400c766c6e34864ab168a6fd4cefb2b`; offline + combined harness 29/29 twice, hash `8436b278cc8d3b2067a10e45d214cdea`.
