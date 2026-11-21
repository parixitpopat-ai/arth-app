# Android signing key: moving it out of the public repo

The repository is public. `android/app/arth-debug.keystore` and its password (in `android/app/build.gradle`) are therefore public too:
anyone can sign an APK that Android accepts as an update to the installed Arth app. The fix is a new key that never enters the repo.

Android will NOT install an app signed with a different key over the installed one, so the switch needs a backup, an uninstall, and a restore.

## One-time switch (on your own computer, not in this repo)

1. **Back up your data in the app** (Settings, backup/export) and keep the file somewhere safe. Check it opens or lists your accounts.
2. Make the new key. Needs Java (`keytool`). Pick a long random password and store it in a password manager:

       keytool -genkeypair -v -keystore arth-release.keystore -alias arthkey -keyalg RSA -keysize 2048 -validity 10000

3. Turn it into one line of text:  `base64 -w0 arth-release.keystore`  (on a Mac: `base64 -i arth-release.keystore`)
4. GitHub, the repo, Settings, Secrets and variables, Actions, New repository secret. Add three:
   - `ARTH_KEYSTORE_BASE64` = the one line from step 3
   - `ARTH_KEYSTORE_PASSWORD` = the password from step 2
   - `ARTH_KEY_ALIAS` = `arthkey`
5. Keep `arth-release.keystore` and its password backed up OFF the computer too. If both are lost, no future build can update an installed app.
6. Run the workflow (Actions, Android debug APK, Run workflow). The run's annotations should say "using the key from repository secrets".
7. On the phone: uninstall the old Arth, install the new APK, restore the backup from step 1.

## After it works

Ask Claude to delete `android/app/arth-debug.keystore` and the fallback password in `build.gradle`. The old key stays in git history,
but once no build uses it, it can no longer be used to update your app. Rewriting history is optional and needs a force-push.
