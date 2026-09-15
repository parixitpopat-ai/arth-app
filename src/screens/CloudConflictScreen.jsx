// screens/CloudConflictScreen.jsx
//
// P1 — Master User / Signup. First-class conflict resolution (P1-002 §6 /
// final review rule #2): source-of-truth SELECTION, not merging. Shown
// only when both this device's local data and the authenticated account's
// cloud data are independently "meaningful" (masterUserSetup.js).
//
// Deliberately not a window.confirm() — needs to show two summaries side
// by side, per the frozen requirement that Arth "tell the user exactly
// what it found and what each choice does." Reuses the same summary-count
// pattern already proven in the existing Backup & Restore screen
// (App.jsx's autoBackups cards: "{n} txns · {n} accounts").
//
// No default/pre-selected choice. Whichever side is NOT chosen is backed
// up (and that backup verified) by the caller BEFORE this screen's choice
// is acted on — see App.jsx's createVerifiedBackup + resolveConflict.

const FIELD_LABELS = {
  txns: "transactions", investments: "investments", bills: "bills", loans: "loans",
  memberships: "memberships", feePayments: "fee payments", gifts: "gifts", goals: "goals",
};

function SummaryList({ summary, T }) {
  const entries = Object.entries(summary).filter(([, count]) => count > 0);
  if (entries.length === 0) return <div style={{ fontSize: 12, color: T.sub }}>No records</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {entries.map(([key, count]) => (
        <div key={key} style={{ fontSize: 12, color: T.text }}>
          <strong>{count}</strong> {FIELD_LABELS[key] || key}
        </div>
      ))}
    </div>
  );
}

export default function CloudConflictScreen({
  localSummary,   // from summarizeMeaningfulData(local state)
  cloudSummary,   // from summarizeMeaningfulData(cloud snapshot)
  cloudSavedAt,   // display string/date, may be empty — informational only
  onKeepLocal,    // () => void — push this device's data to cloud, replacing it
  onKeepCloud,    // () => void — pull cloud data, replacing this device's data
  busy,
  error,
  T,
}) {
  const cardStyle = { background: T.card || T.input, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18, flex: 1 };

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: 430, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: T.text, marginBottom: 8 }}>Two versions of your data found</div>
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 24 }}>
          This device has data Arth hasn't synced yet, and your account already has separate cloud data.
          Choose which one to keep — the other will be backed up first, so nothing is lost, but going
          forward only your choice will be used.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 8 }}>📱 This device</div>
            <SummaryList summary={localSummary} T={T} />
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 4 }}>☁️ Your Arth account</div>
            {cloudSavedAt && <div style={{ fontSize: 10, color: T.sub, marginBottom: 8 }}>Last updated {cloudSavedAt}</div>}
            <SummaryList summary={cloudSummary} T={T} />
          </div>
        </div>

        {error && (
          <div style={{ background: T.danger + "18", border: `1px solid ${T.danger}33`, borderRadius: 10, padding: "10px 12px", marginBottom: 16, color: T.danger, fontSize: 12, fontWeight: 700 }}>
            {error}
          </div>
        )}

        <button
          onClick={onKeepLocal} disabled={busy}
          style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", cursor: busy ? "wait" : "pointer", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "Nunito,sans-serif", marginBottom: 10 }}
        >
          Keep this device's data — replace the cloud version
        </button>
        <button
          onClick={onKeepCloud} disabled={busy}
          style={{ width: "100%", padding: 14, borderRadius: 14, border: `1px solid ${T.border}`, cursor: busy ? "wait" : "pointer", background: "none", color: T.text, fontSize: 14, fontWeight: 800, fontFamily: "Nunito,sans-serif" }}
        >
          Use the cloud version — replace this device's data
        </button>

        <div style={{ fontSize: 10, color: T.sub, marginTop: 16, textAlign: "center" }}>
          Whichever you don't choose is saved to Backup & Restore before it's replaced.
        </div>
      </div>
    </div>
  );
}
