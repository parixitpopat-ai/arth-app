// screens/DeviceOwnershipScreen.jsx
//
// Account-isolation guard (SYNC-SAFETY-008). Shown when the data on this phone belongs to a different account (or to no known
// account) and someone has just signed in. Nothing has been sent, replaced or deleted when this appears.
//
// Every option says exactly what will happen, in order, and what will NOT happen:
//   - Start fresh: a backup of this phone's data is saved and CHECKED first (if it cannot be checked, nothing changes); only then is
//     the phone switched to this account's own data. Nothing is uploaded to this account.
//   - Add this phone's data to this account: always needs a second, explicit confirmation. A backup is saved and checked first. It never
//     overwrites this account's cloud copy: if the account already has data, both copies are shown and the person chooses.
//   - Sign out: nothing changes.
import { useState } from "react";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function Steps({ T, items, tone }) {
  return (
    <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 12, color: tone === "warn" ? T.warn : T.sub, lineHeight: 1.5 }}>
      {items.map((t, i) => <li key={i} style={{ marginBottom: 3 }}>{t}</li>)}
    </ul>
  );
}

export default function DeviceOwnershipScreen({ T, ownership, accountEmail, localSummary, busy, error, onStartFresh, onTransfer, onSignOut }) {
  const [confirming, setConfirming] = useState(false);
  const other = ownership.kind === "other-account";
  const owner = ownership.ownerEmail || "another account";
  const who = accountEmail || "this account";
  const counts = Object.entries(localSummary || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k === "txns" ? (n === 1 ? "transaction" : "transactions") : k}`).join(", ") || plural(ownership.txnCount || 0, "transaction");
  const card = { background: T.card || T.input, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 12 };
  const btn = (primary, danger) => ({ width: "100%", padding: 14, borderRadius: 14, border: primary ? "none" : `1px solid ${danger ? T.danger : T.border}`, cursor: busy ? "wait" : "pointer", background: primary ? T.accent : "none", color: primary ? "#fff" : (danger ? T.danger : T.text), fontSize: 14, fontWeight: 800, fontFamily: "Nunito,sans-serif", marginBottom: 6 });
  const freshSteps = [
    `First, a backup of this phone's data (${counts}) is saved and checked. If it can't be checked, nothing is changed.`,
    `Then this phone shows only ${who}'s own data, or an empty account if there is none.`,
    other ? `${owner}'s data is not deleted from their account: it stays in their cloud copy and in the backup on this phone. Nothing is uploaded to ${who}.` : `The data now on this phone stays in that backup. Nothing is uploaded to ${who}.`,
    ...(other && ownership.unsynced === true ? [`Changes ${owner} never sent to their cloud copy exist only on this phone and in that backup.`] : []),
  ];
  const transferSteps = [
    `A backup of this phone's data (${counts}) is saved and checked first. If it can't be checked, nothing is changed.`,
    other ? `Then ${counts} saved under ${owner} would become part of ${who}.` : `Then ${counts} on this phone would become part of ${who}.`,
    `If ${who} already has data in the cloud, nothing is overwritten: you will be shown both copies and asked which to keep.`,
    `If ${who} has no data yet, this phone's data becomes the start of ${who}'s data.`,
    ...(other ? [`Only do this if both accounts are yours.`] : []),
  ];
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
          <div style={{ fontSize: 12, color: T.text }}>{counts}</div>
          {other && ownership.unsynced === true && (
            <div data-testid="ownership-unsynced" style={{ fontSize: 12, color: T.warn, fontWeight: 700, marginTop: 8 }}>
              It includes changes {owner} never sent to their cloud copy.
            </div>
          )}
        </div>

        {error && (
          <div data-testid="ownership-error" style={{ background: T.danger + "18", border: `1px solid ${T.danger}33`, borderRadius: 10, padding: "10px 12px", marginBottom: 14, color: T.danger, fontSize: 12, fontWeight: 700 }}>{error}</div>
        )}

        {!confirming && (<>
          <div style={{ ...card, marginBottom: 10 }}>
            <button data-testid="ownership-start-fresh" disabled={busy} onClick={onStartFresh} style={btn(other)}>Start fresh as {who}</button>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text, margin: "6px 0 4px" }}>What happens</div>
            <Steps T={T} items={freshSteps} />
          </div>
          <div style={{ ...card, marginBottom: 10 }}>
            <button data-testid="ownership-transfer" disabled={busy} onClick={() => setConfirming(true)} style={btn(!other)}>Add this phone's data to {who}</button>
            <div style={{ fontSize: 12, color: T.sub }}>You will be asked to confirm. Nothing is uploaded yet.</div>
          </div>
          <button data-testid="ownership-sign-out" disabled={busy} onClick={onSignOut} style={btn(false, true)}>Sign out and decide later</button>
          <div style={{ fontSize: 12, color: T.sub, marginBottom: 6 }}>Nothing changes. The data stays on this phone.</div>
        </>)}

        {confirming && (
          <div data-testid="ownership-confirm" style={{ ...card, border: `1px solid ${T.warn}` }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 8 }}>Add this phone's data to {who}?</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 4 }}>What happens, in order</div>
            <Steps T={T} items={transferSteps} />
            <button data-testid="ownership-confirm-yes" disabled={busy} onClick={onTransfer} style={btn(true)}>Yes, add it to {who}</button>
            <button data-testid="ownership-confirm-no" disabled={busy} onClick={() => setConfirming(false)} style={btn(false)}>No, go back</button>
          </div>
        )}
        <div style={{ fontSize: 10, color: T.sub, marginTop: 14, textAlign: "center" }}>Backups are listed in Settings, then Backup &amp; Restore, then Sync safety backups.</div>
      </div>
    </div>
  );
}
