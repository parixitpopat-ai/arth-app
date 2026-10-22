// Shown before signing out when this phone holds changes the account's cloud copy has not received (SYNC-SAFETY-008).
// It does not send anything and does not delete anything. It says where the changes are, whether they are ALSO in a backup that was
// actually saved and read back (it never claims one that was not), and it never suggests that the data is safe to discard.
export default function SignOutWarningSheet({ T, info, accountEmail, busy, onStay, onSignOut }) {
  const unknown = info.unsynced === null;
  const bk = info.backup;
  const when = bk && bk.at ? (() => { try { return new Date(bk.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); } catch { return bk.at; } })() : "";
  const lines = unknown ? [
    "Arth could not check whether this phone holds changes that were never sent to your account.",
    "Nothing is sent while you sign out, and nothing on this phone is deleted.",
  ] : [
    `Some changes on this phone have not reached ${accountEmail || "your account"}'s cloud copy${info.neverSynced ? " (this phone has not completed a sync for this account)" : ""}.`,
    "Arth will not send them while you sign out. Signing out does not delete them: they stay on this phone.",
    ...(info.conflict ? ["This phone and your cloud copy also differ, and you have not chosen between them yet."] : []),
  ];
  return (
    <div data-testid="signout-warning" role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 100001, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: T.card || T.bg, border: `1px solid ${T.border}`, borderRadius: 18, padding: 20, maxWidth: 400, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: T.text, marginBottom: 10 }}>You have changes that aren't saved to your account</div>
        <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13, color: T.text, lineHeight: 1.5 }}>
          {lines.map((l, i) => <li key={i} style={{ marginBottom: 4 }}>{l}</li>)}
        </ul>
        {!unknown && bk && bk.verified && (
          <div data-testid="signout-backup-verified" style={{ fontSize: 12, color: T.text, background: T.accentSoft || T.input, borderRadius: 10, padding: "9px 11px", marginBottom: 12 }}>
            ✅ A backup of this phone's data was saved and checked{when ? ` (${when})` : ""}{bk.txnCount != null ? `: ${bk.txnCount} transaction${bk.txnCount === 1 ? "" : "s"}` : ""}. These changes are also kept there (Settings, then Backup &amp; Restore, then Sync safety backups).
          </div>
        )}
        {!unknown && bk && !bk.verified && (
          <div data-testid="signout-backup-failed" style={{ fontSize: 12, color: T.danger, background: T.danger + "18", borderRadius: 10, padding: "9px 11px", marginBottom: 12, fontWeight: 700 }}>
            ⚠️ A backup could not be saved and checked{bk.error ? ` (${bk.error})` : ""}. Until you sign back in and sync, these changes exist only on this phone. Do not clear the app's data or uninstall it.
          </div>
        )}
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 14, lineHeight: 1.45 }}>
          To send them to your account, stay signed in and use Settings, then Sync Now, or sign back in to this account later. If someone else signs in on this phone, they will be asked what to do with this data.
        </div>
        <button data-testid="signout-stay" disabled={busy} onClick={onStay} style={{ width: "100%", padding: 13, borderRadius: 14, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "Nunito,sans-serif", cursor: busy ? "wait" : "pointer", marginBottom: 8 }}>Stay signed in</button>
        <button data-testid="signout-anyway" disabled={busy} onClick={onSignOut} style={{ width: "100%", padding: 13, borderRadius: 14, border: `1px solid ${T.danger}`, background: "none", color: T.danger, fontSize: 14, fontWeight: 800, fontFamily: "Nunito,sans-serif", cursor: busy ? "wait" : "pointer" }}>Sign out anyway</button>
      </div>
    </div>
  );
}
