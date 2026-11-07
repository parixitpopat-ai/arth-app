import React, { useCallback, useEffect, useState } from "react";
import { hasRoom, storageReport, buildAllBackupsExport, freeBackupSpace, SAFETY_KEY, AUTO_KEY } from "../sync/storageSpace";

// Shown over everything (login, loading, the app) when this browser's storage for Arth is full. Without it a full storage looks like
// "can't reach your account", and new entries can silently fail to save. It frees BACKUP COPIES only, after they are saved to a file.
// (The event name "arth:storage-full" is fired by App.jsx's safeSetLocalStorage when a save is refused for lack of space.)

const kb = chars => `${Math.max(1, Math.round(chars / 1024)).toLocaleString("en-IN")} KB`;

function download(obj, name) {
  const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Everything Arth keeps on this phone except sign-in tokens, as one file for recovery. Not restorable in-app; it is a safety net. */
function rawCopy(storage) {
  const out = {};
  for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && !/^sb-/.test(k)) out[k] = storage.getItem(k); }
  return { app: "Arth", backupType: "raw-device-storage", formatVersion: 1, exportedAt: new Date().toISOString(), keys: out };
}

export default function StorageFullGuard({ storage = typeof window !== "undefined" ? window.localStorage : null, checkEveryMs = 20000 }) {
  const [full, setFull] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [report, setReport] = useState(null);
  const [result, setResult] = useState("");

  const check = useCallback(() => {
    if (!storage) return;
    const ok = hasRoom(storage);
    setFull(!ok);
    if (!ok) setReport(storageReport(storage));
  }, [storage]);

  useEffect(() => {
    // Ask the browser not to clear Arth's storage when the phone runs low on space. It may refuse; nothing depends on the answer.
    try { const r = navigator.storage && navigator.storage.persist && navigator.storage.persist(); if (r && r.catch) r.catch(() => {}); } catch { /* not available */ }
    check();
    const t = setInterval(check, checkEveryMs);
    const onFull = () => { setHidden(false); check(); };
    window.addEventListener("arth:storage-full", onFull);
    return () => { clearInterval(t); window.removeEventListener("arth:storage-full", onFull); };
  }, [check, checkEveryMs]);

  if (!full || hidden || !storage) return null;
  let dark = false; try { dark = JSON.parse(storage.getItem("arth_dark") || "false") === true; } catch { /* default light */ }
  const c = dark ? { bg: "#0b0d12", card: "#161a22", text: "#f2f4f8", sub: "#a8b0bf", line: "#2a3040", accent: "#22c55e", ink: "#04210f", danger: "#f87171" }
    : { bg: "#f4f2ee", card: "#ffffff", text: "#1a1a2e", sub: "#5b5b73", line: "#dcd8d0", accent: "#16813f", ink: "#ffffff", danger: "#c62828" };
  const btn = (primary, disabled) => ({ width: "100%", minHeight: 48, borderRadius: 14, border: primary ? "none" : `1px solid ${c.line}`, background: primary ? c.accent : c.card, color: primary ? c.ink : c.text, fontWeight: 800, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 });

  const saveFiles = () => {
    try {
      download(buildAllBackupsExport(storage), "arth-backup-copies");
      download(rawCopy(storage), "arth-everything-on-this-phone");
      setSaved(true); setResult("");
    } catch (e) { setResult(`Could not create the files: ${e.message}`); }
  };
  const free = () => {
    try {
      const r = freeBackupSpace(storage);
      const ok = hasRoom(storage);
      setReport(storageReport(storage));
      if (ok) { setResult(`Freed about ${kb(r.freedChars)}. Reloading Arth…`); setTimeout(() => window.location.reload(), 900); }
      else setResult("Freed some space, but it is still tight. Your saved files are safe; tell me and I will look further.");
    } catch (e) { setResult(`Could not free space: ${e.message}. Nothing was changed.`); }
  };

  const keyChars = k => (report?.rows.find(r => r.key === k)?.chars) || 0;
  return (
    <div data-testid="storage-full-guard" role="alertdialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 100000, background: c.bg, overflowY: "auto", padding: "24px 20px", color: c.text, fontFamily: "Nunito, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <div style={{ fontSize: 40, textAlign: "center" }}>🗄️</div>
        <div style={{ fontSize: 20, fontWeight: 900, textAlign: "center", margin: "6px 0 10px" }}>Phone storage for Arth is full</div>
        <div style={{ fontSize: 13, color: c.sub, marginBottom: 12 }}>
          Your browser has no room left for Arth. Until space is freed, new entries may not save on this phone and sign-in can get stuck. <strong>Your account and cloud data are not affected.</strong>
        </div>
        {report && (
          <div data-testid="storage-report" style={{ background: c.card, border: `1px solid ${c.line}`, borderRadius: 12, padding: "10px 12px", fontSize: 12, marginBottom: 14 }}>
            <div>Your data and settings: <strong>{kb(report.working)}</strong></div>
            <div>Backup copies kept on this phone: <strong>{kb(report.backups)}</strong> (safety copies {kb(keyChars(SAFETY_KEY))}, automatic {kb(keyChars(AUTO_KEY))})</div>
            <div style={{ color: c.sub, marginTop: 4 }}>Browsers usually allow about 5 MB per site, but the exact limit varies.</div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button data-testid="storage-save-files" style={btn(!saved, false)} onClick={saveFiles}>1. Save two backup files to my phone</button>
          <div style={{ fontSize: 12, color: c.sub }}>You get a copy of every backup kept here, and a raw copy of everything stored for Arth (sign-in tokens left out). Check that your browser downloaded both.</div>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, opacity: saved ? 1 : 0.5 }}>
            <input data-testid="storage-confirm" type="checkbox" disabled={!saved} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: 3 }} />
            <span>I have both files on my phone.</span>
          </label>
          <button data-testid="storage-free" disabled={!confirmed} style={btn(confirmed, !confirmed)} onClick={free}>2. Free up space (removes old backup copies only)</button>
          <div style={{ fontSize: 12, color: c.sub }}>This removes old backup copies from the browser and keeps the newest one. Your transactions, settings and sign-in are not touched.</div>
          {result && <div data-testid="storage-result" role="status" style={{ fontSize: 12, fontWeight: 700, color: result.startsWith("Freed about") ? c.accent : c.danger }}>{result}</div>}
          <button data-testid="storage-not-now" style={btn(false, false)} onClick={() => setHidden(true)}>Not now</button>
        </div>
      </div>
    </div>
  );
}
