// screens/MasterUserProfileScreen.jsx
//
// P1 — Master User / Signup. The dedicated "My Profile" surface for the
// account owner (__me__), deliberately separate from EditPersonModal
// (App.jsx) which remains untouched and continues to serve every ordinary
// contact exactly as before.
//
// Fields, per P1-002 final review: name, emoji, phone, dob ONLY.
//   - No relation/personType/creditLimit/spendBudget/favorite/modules/
//     color/anniversary/notes — none of these are Master User identity;
//     see masterUserSetup.js header for the full reasoning.
//   - No email field. The authenticated Supabase email is the canonical
//     account identity and is never collected or edited here as if it
//     were an ordinary Person email field (P1-002 final review rule #1).
//
// Two entry contexts, one component:
//   - First-run setup (isFirstRun=true): shown by the top-level gate when
//     masterUserSetupComplete is false. No "skip"/"back" — this is the
//     one-time confirmation the freeze doc requires.
//   - Later edit (isFirstRun=false): reachable from Settings, same fields,
//     with a close/cancel affordance.
//
// PROPS CONTRACT, same pattern as PersonProfileScreen.jsx: theme + data +
// callbacks passed in, zero App.jsx state coupling beyond what's given.

import { useState } from "react";

const EMOJI_CHOICES = ["🙂", "🙋", "🙋‍♂️", "🙋‍♀️", "🧑", "👩", "👨", "🧔", "👩‍💼", "👨‍💼", "😎", "🤓"];

export default function MasterUserProfileScreen({
  mePerson,           // current __me__ people[] record (may be the hardcoded default)
  accountEmail,        // cloudUser.email — shown read-only, never editable here
  isFirstRun = true,
  onSave,              // (fields) => void — fields is { name, emoji, phone, dob }, caller does the merge + sets masterUserSetupComplete
  onClose,             // only used when isFirstRun is false
  T,
}) {
  const [name, setName] = useState(mePerson?.name && mePerson.name !== "Me" ? mePerson.name : "");
  const [emoji, setEmoji] = useState(mePerson?.emoji || "🙂");
  const [phone, setPhone] = useState(mePerson?.phone || "");
  const [dob, setDob] = useState(mePerson?.dob || "");
  const [error, setError] = useState("");

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) { setError("Please enter your name."); return; }
    setError("");
    onSave({ name: name.trim(), emoji, phone: phone.trim(), dob });
  };

  const inputStyle = {
    width: "100%", background: T.input, border: `1px solid ${T.border}`, borderRadius: 12,
    padding: "12px 14px", fontSize: 14, color: T.text, fontFamily: "Nunito,sans-serif",
  };
  const labelStyle = { fontSize: 12, fontWeight: 800, color: T.sub, marginBottom: 6, display: "block" };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 430, margin: "0 auto", width: "100%", padding: "24px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
        {!isFirstRun && (
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.accent, fontSize: 22, alignSelf: "flex-start", cursor: "pointer", padding: 0, marginBottom: 12 }}>←</button>
        )}

        <div style={{ fontSize: 22, fontWeight: 900, color: T.text, marginBottom: 6 }}>
          {isFirstRun ? "Welcome to Arth" : "My Profile"}
        </div>
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 24 }}>
          {isFirstRun
            ? "Let's set up your profile — this is who Arth's financial data belongs to."
            : "Your identity within Arth's financial model."}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 280 }}>
            {EMOJI_CHOICES.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                style={{
                  fontSize: 26, width: 48, height: 48, borderRadius: 14, cursor: "pointer",
                  background: emoji === e ? T.accentSoft : T.input,
                  border: `2px solid ${emoji === e ? T.accent : T.border}`,
                }}
              >{e}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Your name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Priya Sharma" autoFocus />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Phone (optional)</label>
          <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Your phone number" type="tel" />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Date of birth (optional)</label>
          <input style={inputStyle} value={dob} onChange={e => setDob(e.target.value)} type="date" />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Account email</label>
          <div style={{ ...inputStyle, color: T.sub, background: T.bg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>{accountEmail || "—"}</span>
          </div>
          <div style={{ fontSize: 10, color: T.sub, marginTop: 6 }}>
            This is how you sign in — it's separate from any personal email you might add to your profile later.
          </div>
        </div>

        {error && (
          <div style={{ background: T.danger + "18", border: `1px solid ${T.danger}33`, borderRadius: 10, padding: "10px 12px", marginBottom: 16, color: T.danger, fontSize: 12, fontWeight: 700 }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: canSave ? "pointer" : "not-allowed",
            background: canSave ? T.accent : T.border, color: canSave ? "#fff" : T.sub,
            fontSize: 15, fontWeight: 800, fontFamily: "Nunito,sans-serif",
          }}
        >
          {isFirstRun ? "Continue into Arth" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
