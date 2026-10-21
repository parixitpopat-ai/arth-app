# ANDROID-AUTH-HANDOFF-001 — returning the sign-in link to the installed Android app

Status: implemented on branch `wp-android-auth-handoff`, **local only: not pushed, not deployed.** No production setting has been changed.

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

## 5. Keystore and signed build (untested pipeline)
Locally on your own computer (keep the file and passwords private; back them up, losing the key means no updates):
`keytool -genkeypair -v -keystore arth-release.jks -alias arth -keyalg RSA -keysize 2048 -validity 10000`, then `base64 -w0 arth-release.jks` for the secret
`ARTH_KEYSTORE_BASE64`; also set `ARTH_KEYSTORE_PASSWORD`, `ARTH_KEY_ALIAS`, `ARTH_KEY_PASSWORD`. The workflow runs tests, builds a signed APK and AAB,
and prints the signing SHA-256 in the run summary. Not run here (no Android SDK / Google Maven in this environment).

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
