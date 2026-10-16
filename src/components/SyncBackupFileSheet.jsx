import React, { useState } from "react";
import BottomSheet from "./BottomSheet";
import { RADIUS, TOUCH, FONT } from "../constants/theme";
import { buildRecoverableExport, verifyRecoverableExport } from "../sync/recoverableExport";

// SYNC-SAFETY-004 §file fallback — browser storage cannot hold a backup, so before anything is replaced the person saves a file
// and then selects it again; only a file that checks out against the exact data about to be replaced counts as a backup.
export default function SyncBackupFileSheet({ T, request, onDone, downloadPayload }) {
  const [step, setStep] = useState("start");   // start -> saved
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const btn = (primary) => ({ width: "100%", minHeight: TOUCH.min, borderRadius: RADIUS.md, border: primary ? "none" : `1px solid ${T.border}`, background: primary ? T.accent : T.pill, color: primary ? (T.accentInk || "#fff") : T.text, fontWeight: 800, fontSize: 14, cursor: busy ? "wait" : "pointer", fontFamily: FONT.sans });
  const save = async () => {
    setBusy(true); setError("");
    try { const env = await buildRecoverableExport(request.snapshot, { reason: request.reason }); downloadPayload(env, "arth-sync-backup"); setStep("saved"); }
    catch (e) { setError(`Couldn't create the file: ${e.message}`); }
    finally { setBusy(false); }
  };
  const confirm = async e => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    setBusy(true); setError("");
    try {
      const parsed = JSON.parse(await file.text());
      const res = await verifyRecoverableExport(parsed, request.snapshot);
      if (res.ok) onDone({ ok: true, digest: res.digest, txnCount: res.txnCount }); else setError(`That file can't be used: ${res.error}. Nothing has been replaced.`);
    } catch (err) { setError(`That file can't be read (${err.message}). Nothing has been replaced.`); }
    finally { setBusy(false); e.target.value = ""; }
  };
  return (
    <BottomSheet onClose={() => onDone({ ok: false, error: "cancelled" })} T={T} maxHeight="90vh">
      <div data-testid="sync-backup-file-sheet">
        <div style={{ color: T.text, fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Save a backup file first</div>
        <div style={{ color: T.sub, fontSize: 13, marginBottom: 14 }}>This device's storage is full, so Arth cannot keep a safety copy of the data it is about to replace. Nothing is replaced until you save a backup file and select it again so Arth can check it.</div>
        {error && <div role="alert" data-testid="sync-backup-file-error" style={{ background: T.danger + "18", border: `1px solid ${T.danger}33`, borderRadius: 10, padding: "10px 12px", marginBottom: 12, color: T.danger, fontSize: 12, fontWeight: 700 }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button data-testid="sync-backup-file-download" disabled={busy} onClick={save} style={btn(step === "start")}>1. Download backup file</button>
          <label style={{ ...btn(step === "saved"), display: "flex", alignItems: "center", justifyContent: "center", opacity: step === "saved" ? 1 : 0.6 }}>
            2. I saved it: select the file to check it
            <input data-testid="sync-backup-file-input" type="file" accept="application/json,.json" disabled={busy || step !== "saved"} onChange={confirm} style={{ display: "none" }} />
          </label>
          <button data-testid="sync-backup-file-cancel" disabled={busy} onClick={() => onDone({ ok: false, error: "cancelled" })} style={btn(false)}>Cancel (nothing is replaced)</button>
        </div>
      </div>
    </BottomSheet>
  );
}
