// Shown above everything while a returning sign-in link is being exchanged, and when it fails. Fixed texts only.
import { useSyncExternalStore } from "react";

export default function AuthCallbackBanner({ handler }) {
  const state = useSyncExternalStore(handler.subscribe, handler.getState);
  if (state.status === "exchanging") {
    return (
      <div data-testid="auth-callback-busy" role="status" style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 800, fontFamily: "Nunito,sans-serif" }}>
        Signing you in…
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div data-testid="auth-callback-error" role="alert" style={{ position: "fixed", left: 12, right: 12, top: 12, zIndex: 100000, background: "#fff7ed", color: "#7c2d12", border: "1px solid #fdba74", borderRadius: 12, padding: "12px 14px", fontSize: 14, fontWeight: 700, fontFamily: "Nunito,sans-serif", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span aria-hidden="true">⚠️</span>
        <span style={{ flex: 1 }}>{state.message}</span>
        <button onClick={handler.dismiss} aria-label="Dismiss" style={{ background: "none", border: "none", color: "#7c2d12", fontSize: 18, fontWeight: 800, cursor: "pointer", minWidth: 32, minHeight: 32 }}>×</button>
      </div>
    );
  }
  return null;
}
