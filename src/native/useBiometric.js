// Settings: the "Unlock with fingerprint" row. Turning it on asks for the fingerprint once, so it is on only if it works on this phone.
import { useState, useEffect, useCallback } from "react";
import { biometricAvailable, biometricOn, setBiometricOn, confirmBiometric } from "./biometric.js";

export function useBiometric(setToast) {
  const [available, setAvailable] = useState(false);
  const [on, setOn] = useState(() => biometricOn());
  useEffect(() => { let gone = false; biometricAvailable().then(a => { if (!gone) setAvailable(a); }); return () => { gone = true; }; }, []);
  const toggle = useCallback(async () => {
    if (on) { setBiometricOn(false); setOn(false); setToast?.({ message: "Fingerprint unlock is off. The PIN still works.", icon: "🔒" }); return; }
    const ok = await confirmBiometric("Turn on fingerprint unlock");
    if (!ok) { setToast?.({ message: "The fingerprint was not confirmed, so it is still off.", icon: "⚠️" }); return; }
    setBiometricOn(true); setOn(true); setToast?.({ message: "On: touch the sensor instead of typing the PIN. The PIN is still the fallback.", icon: "🫆" });
  }, [on, setToast]);
  return { available, on, toggle };
}
