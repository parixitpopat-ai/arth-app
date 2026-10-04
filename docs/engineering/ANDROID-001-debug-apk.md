# ANDROID-001 — Debug APK (Web -> Capacitor -> APK)

Status: first Android milestone. Debug build only; no product behaviour is Android-specific.

## Pipeline

1. `npm run build` — existing Vite production build into `dist/` (relative base `./`).
2. `npx cap sync android` — copies `dist/` into `android/app/src/main/assets/public` and updates native plugins.
3. `cd android && ./gradlew assembleDebug` — produces `android/app/build/outputs/apk/debug/app-debug.apk`.

`.github/workflows/android-debug-apk.yml` runs 1-3 on GitHub and uploads the APK as the artifact `arth-debug-apk`
(Actions -> Android debug APK -> Run workflow). Nothing is needed on a developer machine.

Requirements (from the generated project): JDK 21, Gradle 8.14.3 (wrapper), Android Gradle Plugin 8.13.0, compileSdk 36, minSdk 24.
Capacitor packages are aligned at 8.3.0 (`@capacitor/android` is pinned exactly).

## Application ID — every place it is configured

The current value everywhere is the Capacitor placeholder `com.example.arth`. It is **not** a production identity.

| File | What | Edit by hand? |
| --- | --- | --- |
| `capacitor.config.json` -> `appId` | Source of truth that `npx cap add android` read | Yes |
| `android/app/build.gradle` -> `namespace` and `applicationId` | The installed package id (`applicationId`) and the code namespace | Yes |
| `android/app/src/main/java/com/example/arth/MainActivity.java` -> `package` line, and the folder path `com/example/arth` | Must match `namespace`; changing the id means moving the file | Yes |
| `android/app/src/main/res/values/strings.xml` -> `package_name`, `custom_url_scheme` | Same value; the scheme is the app's deep-link scheme | Yes |
| `android/app/src/main/assets/capacitor.config.json` -> `appId` | Generated copy written by `cap sync` | No (regenerated) |
| `android/app/src/main/AndroidManifest.xml` -> `${applicationId}.fileprovider` | Derived from `applicationId` | No |

The final id is decided separately and applied to all the "Yes" rows together. A changed `applicationId` installs as a different
app and does not upgrade an existing install; once published to Play it cannot change.

## Not in this milestone

Signing keys, release/AAB, Play Store, icons/splash (Capacitor's default placeholders are in use), SMS, notifications, background work,
PIN/biometric changes, sync architecture, share intents, Android storage, AI.
