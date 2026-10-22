import React from "react";
import BottomSheet from "./BottomSheet";
import { RADIUS, TOUCH, FONT } from "../constants/theme";
import { describeDifferenceLines } from "../sync/differences";

// SYNC-SAFETY-002 §3.7 — shown when this device and the cloud copy BOTH changed since they last agreed.
// Nothing has been replaced when this opens. Each choice backs up the side it replaces (verified) before acting;
// there is no automatic merge, because a transaction also moves balances, bills and totals stored elsewhere.
export default function SyncConflictSheet({ T, diff, busy, error, onKeepLocal, onUseCloud, onLater, onDownloadLocal, onDownloadCloud }) {
  const only = (n, where) => `${n} transaction${n === 1 ? "" : "s"} only ${where}`;
  const btn = (primary) => ({ width: "100%", minHeight: TOUCH.min, borderRadius: RADIUS.md, border: primary ? "none" : `1px solid ${T.border}`, background: primary ? T.accent : T.pill, color: primary ? (T.accentInk || "#fff") : T.text, fontWeight: 800, fontSize: 14, cursor: busy ? "wait" : "pointer", fontFamily: FONT.sans, opacity: busy ? 0.7 : 1 });
  const c = diff?.counts || {};
  return (
    <BottomSheet onClose={onLater} T={T} maxHeight="90vh">
      <div data-testid="sync-conflict-sheet">
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900, marginBottom: 6 }}>This device and your cloud copy both changed</div>
        <div style={{ color: T.sub, fontSize: 13, marginBottom: 14 }}>Nothing has been replaced. Choose which copy to keep. The other copy is saved as a verified backup on this device first.</div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, padding: 14, marginBottom: 12 }}>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 800, marginBottom: 6 }}>📱 This device</div>
          <div data-testid="sync-conflict-local" style={{ color: T.text, fontSize: 13 }}>{c.txns?.local ?? 0} transactions · {only(diff?.onlyLocal?.length ?? 0, "here")}</div>
          <div style={{ color: T.text, fontSize: 13, fontWeight: 800, margin: "10px 0 6px" }}>☁️ Your cloud copy</div>
          <div data-testid="sync-conflict-cloud" style={{ color: T.text, fontSize: 13 }}>{c.txns?.cloud ?? 0} transactions · {only(diff?.onlyCloud?.length ?? 0, "in the cloud")}</div>
          {describeDifferenceLines(diff?.lists).length > 0 && (
            <div data-testid="sync-conflict-other" style={{ color: T.sub, fontSize: 12, marginTop: 10 }}>
              Also different:{describeDifferenceLines(diff?.lists).map(l => <div key={l}>• {l}</div>)}
            </div>
          )}
        </div>
        {error && <div role="alert" style={{ background: T.danger + "18", border: `1px solid ${T.danger}33`, borderRadius: 10, padding: "10px 12px", marginBottom: 12, color: T.danger, fontSize: 12, fontWeight: 700 }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button data-testid="sync-keep-local" disabled={busy} onClick={onKeepLocal} style={btn(true)}>Keep this device's data</button>
          <button data-testid="sync-use-cloud" disabled={busy} onClick={onUseCloud} style={btn(false)}>Use the cloud copy</button>
          <button data-testid="sync-later" disabled={busy} onClick={onLater} style={btn(false)}>Decide later (sync stays paused)</button>
          <div style={{ display: "flex", gap: 10 }}>
            <button disabled={busy} onClick={onDownloadLocal} style={{ ...btn(false), fontSize: 12 }}>Download this device's copy</button>
            <button disabled={busy} onClick={onDownloadCloud} style={{ ...btn(false), fontSize: 12 }}>Download the cloud copy</button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
