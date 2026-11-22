// native/biometric.js
//
// Fingerprint unlock for the Arth lock screen (Android app). The fingerprint only stands in for typing the PIN: the PIN stays set,
// stays the fallback, and the 5-wrong-tries lockout applies to PIN entry as before. Nothing about the fingerprint is stored by Arth
// (the phone keeps it); Arth keeps only the person's choice, "on" or "off", on this device.
// Plugin: @aparajita/capacitor-biometric-auth (checkBiometry, authenticate). On the web it is never used: the browser has no fingerprint here.
// Test hook: window.__ARTH_BIO_TEST__ = { available:boolean, result:boolean|"error" } stands in for the phone in browser checks.

import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";

const KEY = "arth_biometric";
const fake = () => (typeof window !== "undefined" ? window.__ARTH_BIO_TEST__ : undefined);
const isAndroidApp = () => { try { return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"; } catch { return false; } };

/** Has the person turned fingerprint unlock on, on this device. */
export function biometricOn() { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } }
export function setBiometricOn(on) { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* the choice is simply not kept */ } }

/** True when this phone has a fingerprint (or other biometry) enrolled that Arth can ask for. Never throws. */
export async function biometricAvailable() {
  const f = fake(); if (f) return Boolean(f.available);
  if (!isAndroidApp()) return false;
  try { const r = await BiometricAuth.checkBiometry(); return Boolean(r && r.isAvailable); } catch { return false; }
}

/** Like confirmBiometric, but says why it ended. @returns {Promise<{ok:boolean, code:string}>} code is the plugin's BiometryError code ("" when it matched) */
export async function askBiometric(reason = "Unlock Arth") {
  const f = fake(); if (f) f.asks = (f.asks || 0) + 1;
  if (f) return f.result === true ? { ok: true, code: "" } : { ok: false, code: typeof f.code === "string" ? f.code : "authenticationFailed" };
  if (!isAndroidApp()) return { ok: false, code: "biometryNotAvailable" };
  try {
    await BiometricAuth.authenticate({ reason, cancelTitle: "Use PIN", androidTitle: "Unlock Arth", androidSubtitle: "Touch the fingerprint sensor", allowDeviceCredential: false, androidConfirmationRequired: false });
    return { ok: true, code: "" };
  } catch (e) { return { ok: false, code: String((e && e.code) || "authenticationFailed") }; }
}

/** Ask the phone for the fingerprint. Resolves true only when the phone confirms it; a cancel, a miss or any error is false. Never throws. */
export async function confirmBiometric(reason = "Unlock Arth") {
  const f = fake(); if (f) return f.result === true;
  if (!isAndroidApp()) return false;
  try {
    await BiometricAuth.authenticate({ reason, cancelTitle: "Use PIN", androidTitle: "Unlock Arth", androidSubtitle: "Touch the fingerprint sensor", allowDeviceCredential: false, androidConfirmationRequired: false });
    return true;
  } catch { return false; }
}
