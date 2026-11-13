// screens/WelcomeScreen.jsx
//
// P1 revision — shown only on a genuinely new/unestablished device (no
// prior Supabase session found at all — see cloudSync.hasEverAuthenticatedOnThisDevice).
// No PIN keypad here: there is no established PIN yet on a device that's
// never completed auth, so showing one would be meaningless (explicit
// product decision this revision).

export default function WelcomeScreen({ onChoose, T }) {
  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ maxWidth: 400, margin: "0 auto", width: "100%", boxSizing: "border-box", padding: "24px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: T.text, marginBottom: 8 }}>Welcome to Arth</div>
        <div style={{ fontSize: 14, color: T.sub, marginBottom: 40 }}>Your money. One place.</div>

        {/* Sign In first, then Sign Up, both the same weight: most people opening a fresh install are returning (reinstall, new phone). */}
        <button
          data-testid="welcome-signin"
          onClick={() => onChoose("signin")}
          style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", cursor: "pointer", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 800, fontFamily: "Nunito,sans-serif", marginBottom: 12 }}
        >
          Sign In
        </button>
        <button
          data-testid="welcome-signup"
          onClick={() => onChoose("signup")}
          style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", cursor: "pointer", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 800, fontFamily: "Nunito,sans-serif" }}
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}
