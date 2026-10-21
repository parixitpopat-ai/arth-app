# ANDROID-AUTH-HANDOFF-001 — returning the sign-in link to the installed Android app

Status: implemented on branch `wp-android-auth-handoff`, **pushed for review only. Not merged to `main`, not deployed.** No production setting has been changed.

## 1. Root cause (from the code; not yet observed on a real phone)
The app asked Supabase for an email code with no redirect target and no PKCE (`src/cloudSync.js`), and the Android project had no
link handling at all (no intent filter for web links, no `@capacitor/app`). The emailed link therefore pointed at the Supabase
project's default Site URL and opened in the phone's browser. The browser completed sign-in and stored the session in the
*browser's* storage. The installed app runs in its own WebView with its own storage, so it never received that session.
The typed 6-digit code path works only if the Supabase email template includes `{{ .Token }}`; that could not be confirmed from the repo.

## 2. Design
* **Installed app only** (detected by `window.androidBridge` / Capacitor): PKCE + `emailRedirectTo = https://arth-app.vercel.app/auth/callback`.
  The browser/web app is unchanged (no redirect, no PKCE).
* **Android App Link** for exactly `https://arth-app.vercel.app/auth/callback` (`autoVerify`) opens the installed app directly.
* `@capacitor/app` delivers the link while the app is running (`appUrlOpen`) or when it was closed (`getLaunchUrl`).
* `src/authRedirect.js` accepts only that exact https origin+path (no credentials, no look-alike hosts, no http). Only a one-time `code` is
  exchanged (`exchangeCodeForSession`); tokens in a link are never read. A code is useless without the PKCE verifier kept inside the app,
  so an intercepted link cannot sign anyone in.
* `src/authCallback.js`: ignores untrusted links silently; ignores a duplicate tap; refuses to swap accounts if someone is already signed
  in; shows fixed friendly messages for expired / used / invalid / offline; **never logs or displays the code or session.**
* Not installed: the link opens `public/auth/callback.html` (served at `/auth/callback`): an "Open Arth" intent button plus the instruction to type the 6-digit code.
* Debug builds additionally accept `com.parixitpopat.arth://auth/callback` (separate `src/debug` manifest + `VITE_AUTH_ALLOW_DEV_SCHEME=1`, set only in the debug workflow). Release has no custom scheme.
* Local financial data, PIN, offline startup and sync code are untouched; the handler only calls the Supabase auth client.

## 3. Files
`src/authRedirect.js`, `src/authCallback.js`, `src/nativeAuthLinks.js`, `src/components/AuthCallbackBanner.jsx`, `src/main.jsx`, `src/cloudSync.js`,
`android/app/src/main/AndroidManifest.xml`, `android/app/src/debug/AndroidManifest.xml`, `android/app/build.gradle` (env-based release signing, no keys in repo),
regenerated `android/capacitor.settings.gradle` + `android/app/capacitor.build.gradle`, `public/.well-known/assetlinks.json`, `public/auth/callback.html`, `vercel.json`,
`.github/workflows/android-debug-apk.yml`, `.github/workflows/android-signed-release.yml` (new, manual, **untested**), `package.json`/lock (`@capacitor/app`),
tests `src/authCallback.test.js`, harness `tools/android-auth/run.mjs`, fake-backend PKCE support in `tools/offline-startup/fakeSupabase.mjs`.

## 4. Required configuration changes (NOT made; need approval)
1. **Supabase → Authentication → URL Configuration → Redirect URLs:** add `https://arth-app.vercel.app/auth/callback` (exact, no wildcard). Review Site URL (keep `https://arth-app.vercel.app`).
2. **Supabase → Email templates (Magic Link / Confirm signup):** the body should contain **both** `{{ .ConfirmationURL }}` (the link) and `{{ .Token }}` (the 6-digit code), so the typed-code fallback works when the link opens in a browser.
3. **Release signing key:** create one upload/signing keystore (see §5), add four GitHub repository secrets, run "Android signed release".
4. **`public/.well-known/assetlinks.json`:** replace `REPLACE_WITH_RELEASE_SIGNING_SHA256_FINGERPRINT` with the SHA-256 printed by that run, then deploy the web app. Until then verified App Links will NOT work (the placeholder is intentional; no fingerprint was invented). If Play App Signing is used later, add Play's app-signing certificate fingerprint too.
5. Deploy the web build (adds `/auth/callback`, `assetlinks.json`).

## 5. Keystore and signed build
The production release key is created by YOU on your own computer with `tools/android-release/make-keystore.sh` (random password, private files, prints the four
GitHub secrets and the certificate SHA-256). It is deliberately not generated in a cloud session or committed (`.gitignore` blocks `*.jks`, `*.keystore`, `*.p12`).
Back it up offline: losing it means no updates under the same signature and a changed App Link fingerprint.
`.github/workflows/android-signed-release.yml` has two modes: PRODUCTION (your secrets; fails unless `assetlinks.json` contains the built APK's real certificate SHA-256)
and TEST (one-off throwaway key generated inside the run; runs automatically on pushes to this branch to prove the pipeline, package id and manifest; its fingerprint is meaningless for production).
It verifies with `apksigner`/`aapt2`: package id, versionCode, certificate SHA-256, https+host+path+autoVerify in the built manifest, no custom scheme in release, and `assetlinks.json` package == APK package.

## 6. Verification performed here
* Unit/static tests (`src/authCallback.test.js`, 8 tests) and the full suite pass; production build passes.
* Browser harness (`tools/android-auth/run.mjs`) with an emulated Capacitor bridge against a synthetic PKCE backend covers: fresh sign-up, existing sign-in,
  expired link, reused link, app running, app closed (launch URL), untrusted links, dev-scheme link, already-signed-in, web unchanged, local data kept.
* **Not verified:** real Android App Link verification, Chrome/Gmail behaviour when tapping the link, the real Supabase redirect allowlist / templates,
  the signed build, any real device. The harness is not a phone.

## 7. Known behaviours
* supabase-js discards its PKCE verifier on an exchange attempt, so after a failed/used link the user must request a new code (the app says so).
* Requesting a new code replaces the pending verifier: only the latest email's link works; older links show "already used".
* The link must be opened on the same phone that requested it (the verifier lives in that app).

## 8. Phone test checklist
1. Apply §4.1–4.5 (after approval). Install the signed APK (Settings → allow install from this source; uninstall any debug build first, signatures differ).
2. Settings → Apps → Arth → Open by default: "arth-app.vercel.app" should be listed/verified. Optional check: `adb shell pm get-app-links com.parixitpopat.arth`.
3. Fresh sign-up: new email → code email → tap link in Gmail → Arth opens, you land in profile/home with no second login.
4. Existing user sign-in (app running in background; then again with the app swiped away).
5. Expired link (wait past expiry) → friendly message; request a new code; typed 6-digit code also works.
6. Tap the same link twice → second tap says used/invalid, no crash, no account change.
7. Uninstall the app → tap the link → browser page "Open Arth to finish signing in".
8. Airplane mode: open the app → local data, PIN, offline startup unchanged.
9. Signed in: tap an old link → "already signed in", account unchanged.

## 9. Review findings (gate 3) and verified lint baseline
* **Lint baseline:** the production commit `faaf01d` has exactly the same 5 problems (3 errors, 2 warnings: `App.jsx:3 __BUILD_TIME__`, `App.jsx:4205` and `19156` unused disable directives,
  `PeriodSelector.jsx:16`, `vite.config.js:11 process`). This branch adds none. My earlier "baseline 4" was a miscount.
* **Fixed during review:** the fallback page forwarded the whole query string into the `intent://` URL; it now forwards only a code matching `^[A-Za-z0-9-]{10,200}$` (or a short `error_code`).
  The signed-release workflow now always deletes the keystore (`if: always()`), has no `pull_request` trigger, and fails if the APK, manifest and `assetlinks.json` disagree.
* **Checked, no change needed:** redirect validation is exact-match on origin and path (no prefix/suffix/userinfo/http tricks; tested); PKCE verifier is supabase-js's own, kept in app storage and discarded on an attempt;
  tokens in links are never read; an already-signed-in session blocks any link (no account switch); no console/log calls in the auth modules (tested); secrets only reach steps through `env`.
* **Residual risks:** (a) `android:allowBackup="true"` is pre-existing; Android backup could copy app data including a stored session. Consider `false` or backup rules as a separate reviewed change. (b) The code appears in the browser address bar/history when the fallback page is shown (the page scrubs it with `replaceState`); it is useless without the app's verifier. (c) A bogus-but-well-formed code sent to the app burns the pending verifier, so the user must request a new code (nuisance only; requires delivering a link to the phone).
* **PRE-EXISTING PRODUCTION HAZARD FOUND (not caused or fixed by this branch):** against the synthetic fake backend, the production build (`faaf01d`) uploads this device's local data over the account's
  cloud copy while the "Two versions of your data found" screen is still waiting for a choice (account-switch harness, `B_HAS_DATA=1`: cloud B 5 -> 12 transactions). The unmerged branch `wp-sync-safety-2` leaves cloud B at 5 in the same test.
  The link sign-in goes through exactly the same code path as the typed code (harness scenario 8: identical outcome both ways), so this branch neither introduces nor worsens it, but it makes signing in on a phone easier.
  Evidence is from the fake backend: it shows what the app *sends*, not a confirmed loss on the real service. **Until the sync-safety package is reviewed and merged, do not phone-test with an account that holds real cloud data on a device that holds different local data. Use a fresh test account.**

## 10. Supabase configuration inspection (gate 4)
Not possible from this session: the Supabase tools available expose no auth-configuration read, and outbound access to the project and to `arth-app.vercel.app` is blocked by the session's egress policy
(I did not work around it). Project ref used by the app: `iggsdctjjkdknmcnibwi` (the same single project the connector lists). So the current Site URL, Redirect URLs and email templates are **unknown to me**.
Supabase docs confirm: redirect URLs are matched against an allow list in Authentication > URL Configuration; if `redirectTo` is not allowed the Site URL is used (the old behaviour, so an un-updated allow list fails safe);
`{{ .Token }}` is the 6-digit code and `{{ .ConfirmationURL }}` the link; `{{ .RedirectTo }}` exists for templates.
**Before any change, you capture the current state** (Authentication > URL Configuration: Site URL and every Redirect URL; Authentication > Emails: copy the full HTML of "Confirm sign up" and "Magic Link" into a private file). Then change only additively:
add the one redirect URL; if a template lacks `{{ .Token }}`, add a line showing the code and leave everything else as is. Do not replace templates, do not add wildcards.

## 11. Staged rollout
0. (done) Branch pushed for review; TEST-key signed build produced by CI to prove the pipeline.
1. You review the diff and this doc. Also decide on the sync-safety package (section 9) before wider use.
2. You run `make-keystore.sh`, add the four secrets, run "Android signed release" (PRODUCTION mode). It will fail the fingerprint check on purpose; note the printed SHA-256.
3. Change `assetlinks.json` to that SHA-256 on this branch (commit, review). Do not merge yet.
4. Supabase (additive only, after you save the current state): add the redirect URL; add `{{ .Token }}` to the templates if absent.
5. Merge to `main` (web deploy adds `/auth/callback` + `assetlinks.json`). Verify in a browser: `https://arth-app.vercel.app/.well-known/assetlinks.json` returns the JSON with `application/json`, and `/auth/callback` shows the fallback page.
6. Install the signed APK on ONE phone with a fresh test account; run the checklist. Only then distribute further.
## 12. Rollback
* App: uninstall/stop distributing the APK (the web app and the typed-code path are unaffected).
* Web: revert the merge commit on `main` (Vercel redeploys); `/auth/callback` and `assetlinks.json` disappear, links fall back to the Site URL like before.
* Supabase: remove the added redirect URL; restore the saved template HTML. Because the allow list is additive and the Site URL is untouched, nothing else depends on it.
* Key: never rotate casually; if the key is lost or leaked, create a new key, ship a new app version signed with it and update `assetlinks.json` (both fingerprints can be listed during transition).

## 13. CI signed-build result (TEST key)
GitHub Actions run 39693494568 on commit `8499fa3` (workflow "Android signed release", TEST mode): npm ci, full test suite, web build, `cap sync`, `assembleRelease bundleRelease`, signature/package/manifest/assetlinks
consistency step, keystore deletion and artifact upload (`arth-TEST-signed-release`, ~6.9 MB) all succeeded. The consistency step exits non-zero on any mismatch, so success means: APK signature verifies, APK package id equals the package in `assetlinks.json`,
the built manifest contains https + `arth-app.vercel.app` + `/auth/callback` + autoVerify, and the release manifest has no custom scheme. This was the first real Android build of this project; the first attempt (925aacd) failed before any job started because of a workflow syntax error (`runner` context in job `env`), fixed in 8499fa3.
Not visible to me: the log text and artifact download are served from hosts this session's GitHub proxy does not contact, so the exact printed values (versionCode, throwaway fingerprint) were not read by me. The throwaway fingerprint is irrelevant for production.
The PRODUCTION fingerprint does not exist yet: it needs your keystore (section 5).
