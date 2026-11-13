// Shown INSTEAD of the app when a saved list is unreadable and no backup holds it (src/storage/repairStored.js). Nothing has been changed yet.
// Also exports RecoveryNotice: a small dismissible bar shown over the app after a list WAS restored from a backup.
import { useState } from "react";
import { labelFor, readNotice, clearNotice } from "../storage/repairStored.js";

const shell = { minHeight: "100vh", background: "#08080f", color: "#e8e4dc", fontFamily: "Nunito, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box" };
const card = { maxWidth: 420, width: "100%", boxSizing: "border-box" };
const btn = primary => ({ width: "100%", minHeight: 48, borderRadius: 14, border: primary ? "none" : "1px solid #2b2b45", background: primary ? "#22c55e" : "none", color: primary ? "#062e13" : "#e8e4dc", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", marginTop: 10 });

export default function StoredDataRecovery({ keys, onStartEmpty }) {
  const names = keys.map(k => labelFor(k.key));
  return (
    <div style={shell} data-testid="stored-recovery">
      <div style={card}>
        <div style={{ fontSize: 34 }}>🛟</div>
        <div style={{ fontSize: 22, fontWeight: 900, margin: "10px 0 8px" }}>Some saved data can't be read</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, color: "#b9b9cf" }}>
          Arth found damaged data on this phone for: <b data-testid="recovery-names" style={{ color: "#e8e4dc" }}>{names.join(", ")}</b>. There was no backup copy of {names.length === 1 ? "it" : "them"} to restore from.
          <br /><br />Nothing has been changed or deleted. A copy of the damaged text is kept on this phone.
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "#8b8bab", marginTop: 12 }}>
          If you use cloud sync or have a backup file, you can start {names.length === 1 ? "this part" : "these parts"} empty and then bring your data back from there (Settings → Backup &amp; Restore, or sign in). I can't promise how cloud sync will treat an empty list, so check your cloud copy before you save new entries.
        </div>
        <button type="button" data-testid="recovery-start-empty" style={btn(true)} onClick={onStartEmpty}>Start {names.length === 1 ? "this part" : "these parts"} empty</button>
        <button type="button" data-testid="recovery-retry" style={btn(false)} onClick={() => window.location.reload()}>Try again</button>
      </div>
    </div>
  );
}

export function RecoveryNotice() {
  const [items, setItems] = useState(() => readNotice(typeof window !== "undefined" ? window.localStorage : null));
  if (!items.length) return null;
  const when = at => { try { return new Date(at).toLocaleString(); } catch { return at; } };
  return (
    <div data-testid="recovery-notice" role="status" style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 9999, background: "#0f0f1a", color: "#e8e4dc", border: "1px solid #22c55e", borderRadius: 14, padding: "12px 14px", fontFamily: "Nunito, system-ui, sans-serif", fontSize: 13, lineHeight: 1.45, boxShadow: "0 6px 24px rgba(0,0,0,0.5)" }}>
      <b>Damaged data was repaired.</b> {items.map(i => `${labelFor(i.key)} (from your ${i.from} of ${when(i.at)})`).join("; ")}. Entries made after that backup may be missing. The damaged copy is kept on this phone.
      <div style={{ marginTop: 8 }}><button type="button" data-testid="recovery-notice-ok" onClick={() => { clearNotice(window.localStorage); setItems([]); }} style={{ minHeight: 40, padding: "0 18px", borderRadius: 12, border: "none", background: "#22c55e", color: "#062e13", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>OK</button></div>
    </div>
  );
}
