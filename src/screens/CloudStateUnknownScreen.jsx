// screens/CloudStateUnknownScreen.jsx
//
// P1 — Master User / Signup, final review rule #3: if OTP succeeds but
// cloud hydration/setup state is unknown AND there is no trustworthy local
// fallback, block until cloud state is known — never create a local Master
// User under uncertainty. Shown only for a genuinely new device/account
// pairing with nothing cached locally; a device with existing trustworthy
// local state never reaches this screen (it keeps using the existing,
// unmodified offline-capable path instead — see App.jsx's gate).

export default function CloudStateUnknownScreen({ onRetry, busy, error, T }) {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ maxWidth: 400, margin: "0 auto", width: "100%", padding: "24px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: T.text, marginBottom: 8 }}>Can't reach your Arth account</div>
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 4 }}>
          You're signed in, but this device can't confirm your account's existing data yet, and there's
          nothing saved on this device to fall back on.
        </div>
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 24 }}>
          To make sure nothing gets overwritten or lost, Arth won't continue until it can check.
        </div>
        {error && (
          <div style={{ background: T.danger + "18", border: `1px solid ${T.danger}33`, borderRadius: 10, padding: "10px 12px", marginBottom: 16, color: T.danger, fontSize: 12, fontWeight: 700, textAlign: "left" }}>
            {error}
          </div>
        )}
        <button
          onClick={onRetry} disabled={busy}
          style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", cursor: busy ? "wait" : "pointer", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 800, fontFamily: "Nunito,sans-serif" }}
        >
          {busy ? "Checking..." : "Try again"}
        </button>
      </div>
    </div>
  );
}
