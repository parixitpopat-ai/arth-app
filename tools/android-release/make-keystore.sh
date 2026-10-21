#!/usr/bin/env bash
# Run ON YOUR OWN COMPUTER (not in CI, not in a shared/cloud session). Creates the Arth release keystore and prints what to put in
# GitHub secrets. Nothing is uploaded anywhere. Back the folder up offline: losing this key means you can never update the app under
# the same signature, and changing it later changes the App Link fingerprint.
set -euo pipefail
command -v keytool >/dev/null || { echo "keytool not found (install a JDK 17+)"; exit 1; }
DIR="${1:-$HOME/arth-release-keystore}"; [ -e "$DIR" ] && { echo "Refusing: $DIR already exists"; exit 1; }
umask 077; mkdir -p "$DIR"; KS="$DIR/arth-release.jks"; ALIAS="arth"
PASS="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 28)"
keytool -genkeypair -keystore "$KS" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=Arth, O=Arth, C=IN" >/dev/null
printf '%s' "$PASS" > "$DIR/password.txt"; base64 -w0 "$KS" > "$DIR/keystore.base64.txt" 2>/dev/null || base64 "$KS" | tr -d '\n' > "$DIR/keystore.base64.txt"
echo "Created $DIR (files are private to you). Keep a backup OFFLINE."
echo; echo "GitHub repo secrets to add (Settings > Secrets and variables > Actions):"
echo "  ARTH_KEYSTORE_BASE64   = contents of $DIR/keystore.base64.txt"
echo "  ARTH_KEYSTORE_PASSWORD = contents of $DIR/password.txt"
echo "  ARTH_KEY_ALIAS         = $ALIAS"
echo "  ARTH_KEY_PASSWORD      = contents of $DIR/password.txt (same value)"
echo; echo "Certificate SHA-256 (this is what goes in assetlinks.json):"
keytool -list -v -keystore "$KS" -alias "$ALIAS" -storepass "$PASS" | grep -E "SHA256:" | head -1
