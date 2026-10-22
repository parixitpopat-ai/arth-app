// screens/DeviceOwnershipScreen.jsx
//
// Account-isolation guard (SYNC-SAFETY-008). Shown when the data on this phone belongs to a different account (or to no known
// account) and someone has just signed in. Nothing has been sent, replaced or deleted when this appears; each choice that changes
// anything saves a verified backup of this phone's data first (the engine refuses to continue if it cannot).
//
// Wording is deliberate: it says whose data this is, what is about to happen, that a backup is kept, and that the other account's
// own cloud copy is untouched. "Add it" for another account's data needs a second, explicit confirmation.
import { useState } from "react";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

export default function DeviceOwnershipScreen({ T, ownership, accountEmail, localSummary, busy, error, onStartFresh, onTransfer, onSignOut }) {
  const [confirming, setConfirming] = useState(false);
  const other = ownership.kind === "other-account";
  const owner = ownership.ownerEmail || "another account";
  const who = accountEmail || "this account";
  const counts = Object.entries(localSummary || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k === "txns" ? (n === 1 ? "transaction" : "transactions") : k}`).join(", ");
  const card = { background: T.card || T.input, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 12 };
  const btn = (primary, danger) => ({ width: "100%", padding: 14, borderRadius: 14, border: primary ? "none" : `1px solid ${danger ? T.danger : T.border}`, cursor: busy ? "wait" : "pointer", background: primary ? T.accent : "none", color: primary ? "#fff" : (danger ? T.danger : T.text), fontSize: 14, fontWeight: 800, fontFamily: "Nunito,sans-serif", marginBottom: 6 });
  const note = { fontSize: 12, color: T.sub, marginBottom: 14, lineHeight: 1.4 };
  return (
    <div data-testid="ownership-screen" style={{ background: T.bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: 430, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: T.text, marginBottom: 8 }}>
          {other ? `This phone has ${owner}'s data` : "This phone has data that isn't linked to an account"}
        </div>
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 16, lineHeight: 1.45 }}>
          You are signed in as <strong>{who}</strong>. {other ? <>The data on this phone was saved while <strong>{owner}</strong> was signed in. </> : null}
          <strong>Nothing has been sent to the cloud or deleted.</strong> Choose what happens to the data on this phone.
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 6 }}>📱 On this phone</div>
          <div style={{ fontSize: 12, color: T.text }}>{counts || `${plural(ownership.txnCount || 0, "transaction")}`}</div>
          {other && ownership.unsynced === true && (
            <div data-testid="ownership-unsynced" style={{ fontSize: 12, color: T.warn, fontWeight: 700, marginTop: 8 }}>
              It includes changes {owner} never sent to their cloud copy. They are kept in a backup either way.
            </div>
          )}
        </div>

        {error && (
          <div data-testid="ownership-error" style={{ background: T.danger + "18", border: `1px solid ${T.danger}33`, borderRadius: 10, padding: "10px 12px", marginBottom: 14, color: T.danger, fontSize: 12, fontWeight: 700 }}>{error}</div>
        )}

        {!confirming && (<>
          {other ? (<>
            <button data-testid="ownership-start-fresh" disabled={busy} onClick={onStartFresh} style={btn(true)}>Start fresh as {who}</button>
            <div style={note}>This phone switches to {who}'s own data (or an empty account). {owner}'s data is saved as a backup on this phone first, and stays in their own cloud account.</div>
            <button data-testid="ownership-transfer" disabled={busy} onClick={() => setConfirming(true)} style={btn(false)}>Add this phone's data to {who}</button>
            <div style={note}>Only if both accounts are yours. The data from {owner} would be copied into {who}.</div>
          </>) : (<>
            <button data-testid="ownership-transfer" disabled={busy} onClick={onTransfer} style={btn(true)}>Add it to {who}</button>
            <div style={note}>The data on this phone becomes part of {who}. A backup is saved first. If {who} already has data in the cloud you will be asked which copy to keep.</div>
            <button data-testid="ownership-start-fresh" disabled={busy} onClick={onStartFresh} style={btn(false)}>Start fresh without it</button>
            <div style={note}>This phone switches to {who}'s own data (or an empty account). The data on this phone is saved as a backup first.</div>
          </>)}
          <button data-testid="ownership-sign-out" disabled={busy} onClick={onSignOut} style={btn(false, true)}>Sign out and decide later</button>
        </>)}

        {confirming && (
          <div data-testid="ownership-confirm" style={{ ...card, border: `1px solid ${T.warn}` }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 8 }}>Add {owner}'s data to {who}?</div>
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 12, lineHeight: 1.45 }}>
              {counts || plural(ownership.txnCount || 0, "transaction")} saved under {owner} would become part of {who}. This is meant for moving your own data between your own accounts. A backup is saved first.
            </div>
            <button data-testid="ownership-confirm-yes" disabled={busy} onClick={onTransfer} style={btn(true)}>Yes, add it to {who}</button>
            <button data-testid="ownership-confirm-no" disabled={busy} onClick={() => setConfirming(false)} style={btn(false)}>No, go back</button>
          </div>
        )}
        <div style={{ fontSize: 10, color: T.sub, marginTop: 14, textAlign: "center" }}>Backups are listed in Settings, then Backup &amp; Restore, then Sync safety backups.</div>
      </div>
    </div>
  );
}
