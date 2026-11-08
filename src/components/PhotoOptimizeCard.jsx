import React, { useMemo, useReducer } from "react";
import { listPhotos, shrinkAllPhotos, applyReplacements } from "../domain/images/shrinkImage";
import { createSafetyBackup } from "../sync/safetyBackup";

// Settings → Backup & Restore. Photos attached to bills and transactions are the biggest part of Arth's data and travel with every sync.
// Nothing changes until the person taps the second button, and a verified backup copy is taken first (if it cannot be, nothing is changed).
// The settings screen is re-created whenever the app re-renders (shrinking photos, or downloading a file, each cause one), which would reset
// this card's own state mid-way. All of its state therefore lives here, outside the component, and the component only redraws from it.
const store = { stage: "idle", preview: null, msg: "", needFile: false, fileSaved: false, fileOk: false };   // stage: idle | checking | preview | applying | done
const listeners = new Set();
const set = patch => { Object.assign(store, patch); listeners.forEach(f => f()); };
const mb = chars => `${(chars / 1048576).toFixed(chars < 1048576 ? 2 : 1)} MB`;

export default function PhotoOptimizeCard({ T, txns, bills, billerAccounts, setTxns, setBills, setBillerAccounts, snapshotRef, genId, card, onDownloadBackup }) {
  const photos = useMemo(() => listPhotos({ txns, bills, billerAccounts }), [txns, bills, billerAccounts]);
  const total = photos.reduce((n, p) => n + p.chars, 0);
  const [, redraw] = useReducer(x => x + 1, 0);
  React.useEffect(() => { listeners.add(redraw); return () => { listeners.delete(redraw); }; }, []);
  const { stage, preview, msg, needFile, fileSaved, fileOk } = store;
  const setStage = v => set({ stage: v }), setPreview = v => set({ preview: v }), setMsg = v => set({ msg: v });
  const setNeedFile = v => set({ needFile: v }), setFileSaved = v => set({ fileSaved: v }), setFileOk = v => set({ fileOk: v });
  const btn = (primary, disabled) => ({ background: primary ? T.accent : T.input, color: primary ? (T.accentInk || "#fff") : T.text, border: primary ? "none" : `1px solid ${T.border}`, borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, fontFamily: "Nunito,sans-serif" });

  const check = async () => {
    setStage("checking"); setMsg("");
    try { const r = await shrinkAllPhotos({ txns, bills, billerAccounts }); setPreview(r); setStage("preview"); }
    catch (e) { setMsg(`Could not check the photos: ${e.message}. Nothing was changed.`); setStage("idle"); }
  };
  const swap = () => {
    setTxns(prev => applyReplacements({ txns: prev }, preview.replacements).txns);
    setBills(prev => applyReplacements({ bills: prev }, preview.replacements).bills);
    setBillerAccounts(prev => applyReplacements({ billerAccounts: prev }, preview.replacements).billerAccounts);
  };
  const apply = async () => {
    if (!preview || !preview.replacements.size) return;
    setStage("applying"); setMsg("");
    const snapshot = snapshotRef.current;
    const bk = snapshot ? await createSafetyBackup(window.localStorage, { reason: "before-photo-optimize", snapshot, genId: () => genId(), now: () => Date.now() }) : { ok: false, error: "no data to back up" };
    if (!bk.ok) {
      setNeedFile(true);
      setMsg(`This phone has no room for a backup copy (${bk.error}), so nothing was changed. Download a backup file instead, tick the box, then shrink.`);
      setStage("preview"); return;
    }
    swap();
    setMsg(`Done. ${preview.changed} photo${preview.changed === 1 ? "" : "s"} shrunk, about ${mb(preview.before - preview.after)} saved. A backup copy with the original photos is kept on this phone for now; download a backup file if you want to keep the originals.`);
    setStage("done");
  };
  const applyWithFile = () => {
    if (!preview || !fileOk) return;
    swap(); setNeedFile(false);
    setMsg(`Done. ${preview.changed} photo${preview.changed === 1 ? "" : "s"} shrunk, about ${mb(preview.before - preview.after)} saved. Your downloaded backup file holds the original photos.`);
    setStage("done");
  };

  if (!photos.length) return null;
  const saves = preview ? preview.before - preview.after : 0;
  return (
    <div data-testid="photo-optimize-card" style={{ ...card, marginBottom: 12 }}>
      <div style={{ color: T.text, fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Photos on bills and transactions</div>
      <div style={{ color: T.sub, fontSize: 11, marginBottom: 10 }}>
        {photos.length} photo{photos.length === 1 ? "" : "s"} · about {mb(total)}. Photos are the biggest part of your data: they use this phone's limited storage and are re-sent on every sync.
        Shrinking scales each one to a size that is still easy to read, so a receipt stays legible.
      </div>
      {stage === "idle" && <button data-testid="photo-check" onClick={check} style={btn(true, false)}>Check how much can be saved</button>}
      {stage === "checking" && <div style={{ color: T.sub, fontSize: 12 }}>Checking… nothing is being changed.</div>}
      {stage === "preview" && preview && (
        <div>
          <div data-testid="photo-preview" style={{ color: T.text, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            {preview.changed === 0 ? "Your photos are already small; nothing to shrink."
              : `${preview.changed} of ${preview.photos} photos can be shrunk: ${mb(preview.before)} → ${mb(preview.after)} (saves about ${mb(saves)}).`}
          </div>
          {preview.changed > 0 && <div style={{ color: T.sub, fontSize: 11, marginBottom: 10 }}>Photos are replaced by the smaller version, which cannot be turned back into the original. Arth saves a verified backup copy first; if that cannot be saved, nothing is changed.</div>}
          {needFile && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: T.text, fontSize: 12, margin: "0 0 10px", opacity: fileSaved ? 1 : 0.55 }}>
              <input data-testid="photo-file-ok" type="checkbox" disabled={!fileSaved} checked={fileOk} onChange={e => setFileOk(e.target.checked)} style={{ marginTop: 2 }} />
              <span>I have the backup file on my phone.</span>
            </label>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {preview.changed > 0 && needFile && <button data-testid="photo-apply-file" disabled={!fileOk} onClick={applyWithFile} style={btn(fileOk, !fileOk)}>Shrink {preview.changed} photo{preview.changed === 1 ? "" : "s"} now</button>}
            {preview.changed > 0 && !needFile && <button data-testid="photo-apply" onClick={apply} style={btn(true, false)}>Back up, then shrink {preview.changed} photo{preview.changed === 1 ? "" : "s"}</button>}
            {needFile && <button data-testid="photo-download" onClick={() => { try { onDownloadBackup && onDownloadBackup(); setFileSaved(true); } catch { /* the message below stays */ } }} style={btn(!fileSaved, false)}>⬇ Download backup file</button>}
            <button data-testid="photo-cancel" onClick={() => { setStage("idle"); setPreview(null); setMsg(""); setNeedFile(false); setFileSaved(false); setFileOk(false); }} style={btn(false, false)}>Not now</button>
          </div>
        </div>
      )}
      {stage === "applying" && <div style={{ color: T.sub, fontSize: 12 }}>Saving a backup, then shrinking…</div>}
      {stage === "done" && <button data-testid="photo-ok" onClick={() => set({ stage: "idle", preview: null, msg: "", needFile: false, fileSaved: false, fileOk: false })} style={{ ...btn(false, false), marginTop: 10 }}>OK</button>}
      {msg && <div data-testid="photo-msg" role="status" style={{ marginTop: 10, background: T.input, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontSize: 12, fontWeight: 700 }}>{msg}</div>}
    </div>
  );
}
