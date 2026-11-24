import React, { useEffect, useRef, useState } from "react";
import { biometricAvailable, biometricOn, askBiometric } from "../native/biometric.js";
import { afterFingerprintMiss, PIN_MESSAGES } from "../domain/security/fingerprintAttempts.js";
import { DARK } from "../constants/theme";

// On the lock screen, under the keypad: asks for the fingerprint when the screen opens, asks again after a miss, and after 4 asks that did not match
// (or at once if the person chose the PIN, or the phone refuses the sensor) leaves only the PIN. Shows nothing unless the person turned it on and the
// phone can do it. domain/security/fingerprintAttempts.js holds the rule.
export default function BiometricUnlock({ onUnlocked }) {
  const [ready, setReady] = useState(false);
  const [pinOnly, setPinOnly] = useState(""); // "" = still offering the fingerprint; otherwise the message to show
  const [busy, setBusy] = useState(false);
  const asks = useRef(0), started = useRef(false), alive = useRef(true);
  const run = async () => {
    if (busy) return;
    setBusy(true); setPinOnly("");
    let go = true;
    while (go && alive.current) {
      const r = await askBiometric("Unlock Arth");
      if (!alive.current) return;
      if (r.ok) { onUnlocked(); return; }
      asks.current += 1;
      const next = afterFingerprintMiss({ asks: asks.current, code: r.code });
      if (next.action === "use-pin") { setPinOnly(PIN_MESSAGES[next.reason] || ""); setBusy(false); return; }
    }
    setBusy(false);
  };
  useEffect(() => {
    alive.current = true;
    (async () => { if (!biometricOn() || !(await biometricAvailable()) || !alive.current) return; setReady(true); if (!started.current) { started.current = true; run(); } })();
    return () => { alive.current = false; };
  }, []);
  if (!ready) return null;
  const retry = () => { asks.current = 0; run(); };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {pinOnly && <div data-testid="unlock-pin-message" style={{ marginTop: 14, color: DARK.warn, fontSize: 13, textAlign: "center", maxWidth: 280 }}>{pinOnly}</div>}
      <button data-testid="unlock-fingerprint" disabled={busy} onClick={retry} style={{ marginTop: 14, background: "none", border: `1px solid ${DARK.border}`, borderRadius: 14, minHeight: 48, padding: "0 22px", color: DARK.accent, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Inter,sans-serif", opacity: busy ? 0.5 : 1 }}>🫆 Try fingerprint again</button>
    </div>
  );
}
