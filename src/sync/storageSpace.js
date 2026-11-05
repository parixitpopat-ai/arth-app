// src/sync/storageSpace.js
//
// Browser storage ("localStorage") is small (about 5 MB per site in most browsers; the exact limit varies, so Arth never assumes it).
// When it is full, writes fail. This module (1) recognises that, (2) says what is using the space, and (3) frees ONLY backup copies,
// never the data Arth is working with, and only after the person has saved those copies to a file.

export const SAFETY_KEY = "arth_sync_safety_backups";
export const AUTO_KEY = "arth_auto_backups";
export const PROBE_KEY = "arth_space_probe";
export const PROBE_CHARS = 32 * 1024;

export function isQuotaError(e) {
  if (!e) return false;
  const name = String(e.name || ""), msg = String(e.message || e);
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || e.code === 1014 || /exceeded the quota|quota.*exceeded|storage is full|QuotaExceeded/i.test(msg);
}

/** True when a short test write of about 32 KB still fits. */
export function hasRoom(storage, chars = PROBE_CHARS) {
  try {
    storage.setItem(PROBE_KEY, "x".repeat(chars));
    storage.removeItem(PROBE_KEY);
    return true;
  } catch {
    try { storage.removeItem(PROBE_KEY); } catch { /* nothing to remove */ }
    return false;
  }
}

function listKeys(storage) {
  if (typeof storage.length === "number" && typeof storage.key === "function") { const out = []; for (let i = 0; i < storage.length; i++) out.push(storage.key(i)); return out; }
  return Object.keys(storage);
}

/** Sizes in characters (browsers count characters, not bytes). Largest first. */
export function storageReport(storage) {
  const rows = listKeys(storage).map(key => ({ key, chars: (key || "").length + String(storage.getItem(key) ?? "").length }));
  rows.sort((a, b) => b.chars - a.chars);
  const total = rows.reduce((n, r) => n + r.chars, 0);
  const sum = keys => rows.filter(r => keys.includes(r.key)).reduce((n, r) => n + r.chars, 0);
  const backups = sum([SAFETY_KEY, AUTO_KEY]);
  return { rows, total, backups, working: total - backups };
}

function parseList(storage, key) {
  try { const v = JSON.parse(storage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** Every backup copy held in browser storage, as one file the person can keep. Restorable one by one. */
export function buildAllBackupsExport(storage, now = () => Date.now()) {
  const safety = parseList(storage, SAFETY_KEY), auto = parseList(storage, AUTO_KEY);
  return {
    app: "Arth", backupType: "all-device-backups", formatVersion: 1, exportedAt: new Date(now()).toISOString(),
    note: "Every backup copy that was kept in this browser. Each entry's `snapshot` can be restored with Arth's Restore backup.",
    safetyBackups: safety, autoBackups: auto,
    // The newest copy at the top level so Arth's existing Restore backup accepts the file as it is.
    snapshot: [...safety, ...auto].map(b => b && b.snapshot).filter(Boolean).sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")))[0] || null,
  };
}

/**
 * Frees space by removing backup copies only. Keeps the single newest safety copy. Never touches the live data keys.
 * Call it only after the person has saved buildAllBackupsExport() to a file.
 */
export function freeBackupSpace(storage) {
  const before = storageReport(storage).total;
  const safety = parseList(storage, SAFETY_KEY);
  const keep = safety.length ? [safety.reduce((n, b) => (String(b.at || "") >= String(n.at || "") ? b : n))] : [];
  if (safety.length > keep.length) storage.setItem(SAFETY_KEY, JSON.stringify(keep.map(b => ({ ...b, pinned: false, conflictIds: [] }))));
  storage.removeItem(AUTO_KEY);
  const after = storageReport(storage).total;
  return { freedChars: Math.max(0, before - after), keptSafety: keep.length };
}
