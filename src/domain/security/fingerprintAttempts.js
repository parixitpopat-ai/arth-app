// domain/security/fingerprintAttempts.js
//
// The lock screen's fingerprint: how many times Arth asks, and when it hands over to the PIN. Pure.
// Arth asks the phone for the fingerprint up to MAX_ASKS times. A prompt that ends without a match counts as one ask and Arth asks again.
// It goes straight to the PIN when the person chose it (cancel / "Use PIN"), or when the phone itself will not take a fingerprint any more
// (the sensor is locked out, not available, or not set up). How many wrong touches ONE prompt allows is decided by Android, not by Arth.

export const MAX_ASKS = 4;
const PIN_NOW = new Set(["userCancel", "userFallback", "systemCancel", "appCancel", "biometryLockout", "biometryNotAvailable", "biometryNotEnrolled", "noDeviceCredential", "passcodeNotSet", "notInteractive", "invalidContext"]);

/** @param {{asks:number, code?:string}} s  asks = prompts that have ended without a match so far (including this one); code = why this one ended
 *  @returns {{action:"ask-again"|"use-pin", reason:string}} */
export function afterFingerprintMiss({ asks, code = "" }) {
  if (PIN_NOW.has(code)) return { action: "use-pin", reason: code === "userCancel" || code === "userFallback" ? "chosen" : "phone" };
  if (asks >= MAX_ASKS) return { action: "use-pin", reason: "tries" };
  return { action: "ask-again", reason: "retry" };
}

export const PIN_MESSAGES = {
  chosen: "",
  phone: "The fingerprint is not available right now. Enter your PIN.",
  tries: "The fingerprint did not match. Enter your PIN.",
};
