# SYNC-SAFETY-005 — proposed staging / preview verification plan (PROPOSAL; nothing here has been done)

Status: **proposal for owner approval.** Nothing in this plan has been executed. It needs approvals the owner has not given: a separate Supabase test project (possible cost), Vercel environment-variable changes, any push, and any production access. Do not treat the fake-backend results as production-safe evidence.

## Hazard found while preparing this plan (fixed locally in this work package, not deployed)
`src/cloudSync.js` falls back to the **production** Supabase URL and anon key whenever `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are not set. On Vercel, every branch push builds a *preview* deployment; unless Preview-scoped variables are set, that preview would talk to the production project, with real accounts. Previews of earlier work-package branches were built the same way. Nobody is known to have signed in on them, but this is the single most important thing to close before any preview verification. The local fix: `src/cloudConfig.js` makes a **preview or development Vercel build refuse the production project** (it falls back to local-only, or uses explicit test variables); production builds and local/Android builds behave exactly as before. The build tells the app which Vercel environment it is (`VERCEL_ENV` injected by `vite.config.js`). This is covered by unit tests; it has not been exercised on Vercel.

## Goal
Verify the sync engine against a **real Supabase service** and a **real Vercel preview**, using only synthetic accounts and synthetic data, with no path by which the change reaches production or touches production data.

## Prerequisites (each needs the owner's explicit approval)
1. **A separate Supabase test project** (not the production project), created by the owner or with the owner's approval; free-tier limits or cost to be confirmed by the owner. Same table definition as production (`arth_snapshots(user_id, snapshot, updated_at)` with the same row-level-security policy). The owner provides the definition by a method they choose; I will not read production.
2. **Preview-scoped Vercel environment variables** pointing at that test project (and **not** set for Production). Change made by the owner or approved by them.
3. **Synthetic test accounts** on the test project. How to obtain email one-time codes for them is **not yet decided** and I am not certain which Supabase mechanism applies on a hosted project (options to verify in current docs: a test mailbox owned by the owner via custom SMTP; the auth admin API; pre-created users with a known test OTP if the platform offers one). Decide before step 3.
4. **A non-`main` branch** for the work. Pushing it creates a preview deployment, which is itself a deployment: the owner approves the push.

## Steps (each stops for the owner's go before the next)
1. **Static checks, read-only, no deployment:** confirm `main` is not touched; confirm `vite.config.js`/`cloudConfig.js` guard is in the branch; confirm Preview variables exist and Production variables are unchanged (owner confirms in the Vercel dashboard).
2. **Push the branch** (not `main`). Immediately read the resulting deployment (Vercel read APIs only): `target` must be `null`/preview, the `alias` list must **not** contain `arth-app.vercel.app`, the commit SHA must equal the branch head, the state must be READY. If any of these is wrong, stop and report; do not "fix" by promoting.
3. **Confirm which backend the preview talks to** before any sign-in: load the preview and check that its network requests go to the test project's host and never to the production project host (the build-time guard should make the latter impossible; this confirms it).
4. **Real-service semantics, with synthetic data only** (the questions the fake backend cannot answer): does a filtered `PATCH` that matches no row return an empty list and no error; are `updated_at` precision and any trigger as assumed; does the row-level-security policy permit `UPDATE` with the `user_id` + `updated_at` filter and `INSERT`; does a duplicate insert return code `23505`; do concurrent writers from two real browsers get exactly one winner. If any answer differs, the `version`-column migration (needs approval) replaces the token check before anything else proceeds.
5. **Re-run the scenario suite against the preview + test project** (same scenarios as `tools/sync-sim`, adapted to a real URL and real sign-in), twice, with identical outcomes: two-tab, Plan Ahead nudge, sign-in/recovery, conflicts, interrupted/rejected/lost-reply writes, backup fallback, restore.
6. **Real devices (the owner's checklist, `WEB-V1-VERIFICATION-001.md` §3) on the preview URL with the test account only**, never the owner's real account.
7. **Report** evidence; the owner decides. Promotion is a separate, explicit decision.

## Guard rails so this cannot promote itself to production
- All work stays on a non-`main` branch; `main` is not merged, rebased or force-pushed.
- Vercel only assigns the production domain to deployments of the production branch; a preview deployment never receives `arth-app.vercel.app`. Verified per deployment in step 2, not assumed.
- Nobody runs "promote" or "rollback" for these deployments; no rolling release is started.
- The build-time guard (`cloudConfig.js`) makes a preview build unable to reach the production Supabase project even if a variable were set wrongly.
- Evidence check after every step: read the deployment list for the project and confirm no new `production` deployment appeared.

## If the owner later approves a production release
- Release only after steps 4–6 pass. Known-good production deployment to roll back to: `dpl_FD6WEdbJ5RJJipxDrqnKpNHRtM4e` (commit `d302603`), alias `arth-app.vercel.app`; the docs-only commit `5fc65e7` is deployed on top as `dpl_CoXbSdX9NcxuA7AnWNhgSseNSYKy`.
- Expect a **one-time conflict screen** on installs whose local and cloud copies differ, and a different multi-tab experience (one tab at a time). Tell users first.
- Watch for: conflict-screen rate, "sync paused" statuses, backup-blocked statuses, write failures; keep the pre-release state recoverable.

## Not covered even by this plan
Behaviour on every real phone/browser combination; Web Locks support in every Android WebView (a localStorage fallback exists, best-effort); very large snapshots on slow mobile links (see the performance results); long-term storage-quota behaviour on real devices.
