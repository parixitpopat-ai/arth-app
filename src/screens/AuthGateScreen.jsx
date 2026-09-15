// screens/AuthGateScreen.jsx
//
// P1 revision: Sign Up and Sign In are explicit, separate entry points
// again (reverses the original P1-001 "single Continue with email" call —
// noted, not silently absorbed). Mode is chosen on WelcomeScreen and
// passed in here; it changes copy and, critically, whether an unknown
// email is allowed to create a new account.
//
// Sign In passes shouldCreateUser=false: an unrecognized email errors
// instead of silently creating a new account (explicit requirement).
//
// Still owns only its own local form state — email, code, stage, busy,
// error. No App.jsx state coupling. Still relies on the existing
// supabase.auth.onAuthStateChange listener in App.jsx to pick up a
// successful verifyOtp() call — doesn't thread a session callback back.

import { useState } from "react";
import { requestEmailOtp, verifyEmailOtp } from "../cloudSync";

const COPY = {
  signup: {
    heading: "Create your Arth account",
    button: "Send OTP",
    notFoundHint: null,
  },
  signin: {
    heading: "Sign in to Arth",
    button: "Send OTP",
    notFoundHint: "We couldn't find an Arth account for this email. Use Sign Up instead if you're new.",
  },
};

export default function AuthGateScreen({ mode = "signin", onBack, T }) {
  const [stage, setStage] = useState("email"); // 'email' | 'code'
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const copy = COPY[mode] || COPY.signin;

  const inputStyle = {
    width: "100%", background: T.input, border: `1px solid ${T.border}`, borderRadius: 12,
    padding: "14px", fontSize: 16, color: T.text, fontFamily: "Nunito,sans-serif", textAlign: "center",
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) { setError("Enter a valid email address."); return; }
    setBusy(true); setError("");
    try {
      await requestEmailOtp(trimmed, mode === "signup");
      setStage("code");
    } catch (err) {
      // Supabase returns a generic-sounding error for "user not found" on
      // shouldCreateUser:false — surface the mode-specific hint instead of
      // the raw SDK message when we're in Sign In mode.
      if (mode === "signin" && copy.notFoundHint) {
        setError(copy.notFoundHint);
      } else {
        setError(err.message || "Couldn't send the code. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    const trimmed = code.trim();
    if (!trimmed) { setError("Enter the code from your email."); return; }
    setBusy(true); setError("");
    try {
      await verifyEmailOtp(email.trim(), trimmed);
      // No further action here — onAuthStateChange in App.jsx picks up the
      // new session and the top-level gate re-renders past this screen.
    } catch (err) {
      setError(err.message || "That code didn't work. Please check and try again.");
      setBusy(false);
    }
  };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ maxWidth: 400, margin: "0 auto", width: "100%", padding: "24px 24px" }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", color: T.accent, fontSize: 22, cursor: "pointer", padding: 0, marginBottom: 16 }}>←</button>
        )}
        <div style={{ fontSize: 20, fontWeight: 900, color: T.text, textAlign: "center", marginBottom: 32 }}>{copy.heading}</div>

        {stage === "email" ? (
          <>
            <input
              style={inputStyle} value={email} type="email" autoFocus
              placeholder="Email address"
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendCode()}
            />
            {error && <div style={{ color: T.danger, fontSize: 12, fontWeight: 700, marginTop: 10, textAlign: "center" }}>{error}</div>}
            <button
              onClick={handleSendCode} disabled={busy}
              style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 14, border: "none", cursor: busy ? "wait" : "pointer", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 800, fontFamily: "Nunito,sans-serif" }}
            >
              {busy ? "Sending..." : copy.button}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: T.sub, textAlign: "center", marginBottom: 14 }}>
              We sent a 6-digit code to <strong style={{ color: T.text }}>{email}</strong>
            </div>
            <input
              style={{ ...inputStyle, fontSize: 22, letterSpacing: 6, fontWeight: 800 }} value={code}
              inputMode="numeric" maxLength={6} autoFocus placeholder="······"
              onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && handleVerifyCode()}
            />
            {error && <div style={{ color: T.danger, fontSize: 12, fontWeight: 700, marginTop: 10, textAlign: "center" }}>{error}</div>}
            <button
              onClick={handleVerifyCode} disabled={busy}
              style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 14, border: "none", cursor: busy ? "wait" : "pointer", background: T.accent, color: "#fff", fontSize: 15, fontWeight: 800, fontFamily: "Nunito,sans-serif" }}
            >
              {busy ? "Verifying..." : "Verify & continue"}
            </button>
            <button
              onClick={() => { setStage("email"); setCode(""); setError(""); }}
              style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 14, border: "none", background: "none", cursor: "pointer", color: T.sub, fontSize: 12, fontWeight: 700, fontFamily: "Nunito,sans-serif" }}
            >
              Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
