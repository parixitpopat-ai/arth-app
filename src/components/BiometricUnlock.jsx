import React, { useEffect, useRef, useState } from "react";
import { biometricAvailable, biometricOn, confirmBiometric } from "../native/biometric.js";

// On the lock screen, under the keypad: asks for the fingerprint once when the screen opens and leaves a button to ask again.
// Shows nothing unless the person turned it on and the phone can do it. A miss just leaves the PIN keypad as it was.
export default function BiometricUnlock({ onUnlocked }) {
  const [ready, setReady] = useState(false);
  const asked = useRef(false);
  const run = async () => { if (await confirmBiometric("Unlock Arth")) onUnlocked(); };
  useEffect(() => {
    let gone = false;
    (async () => { if (!biometricOn() || !(await biometricAvailable()) || gone) return; setReady(true); if (!asked.current) { asked.current = true; run(); } })();
    return () => { gone = true; };
  }, []);
  if (!ready) return null;
  return <button data-testid="unlock-fingerprint" onClick={run} style={{ marginTop: 18, background: "none", border: "1px solid #26332c", borderRadius: 14, minHeight: 48, padding: "0 22px", color: "#22c55e", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Inter,sans-serif" }}>🫆 Use fingerprint</button>;
}
