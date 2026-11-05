// src/sync/safetyBackup.js
//
// Backup-before-replacement guarantee (SYNC-SAFETY-002 §3.6). Separate from the rolling auto-backups:
// no throttle, no 3-entry trim, newest MAX_KEPT retained. A backup only counts once it has been READ BACK
// and its digest and transaction count match what was meant to be saved. If it cannot be written
// (for example browser storage is full) the caller must NOT replace anything.

import { digestSnapshot, txnIdsOf } from "./digest.js";
import { sameRecords, rehearsalNoWorse, restoreRehearsal, describeMissing, listSummary } from "./snapshotIntegrity.js";

export const SAFETY_BACKUPS_KEY = "arth_sync_safety_backups";
export const MAX_KEPT = 10;

function readList(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(SAFETY_BACKUPS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @returns {Promise<{ok:true,id:string,digest:string,txnCount:number,at:string}|{ok:false,error:string}>} */
export async function createSafetyBackup(storage, { reason, snapshot, now = () => Date.now(), genId, normalizers, pinned = false, conflictId = null }) {
  try {
    const digest = await digestSnapshot(snapshot);
    const txnCount = txnIdsOf(snapshot).length;
    const at = new Date(now()).toISOString();
    const id = `sb_${now()}_${genId()}`;
    const counts = Object.fromEntries(Object.entries(listSummary(snapshot)).map(([k, v]) => [k, v.count]));
    // Recoverability: what would the restore path itself drop from this data (e.g. duplicate settlements removed by normalisation)?
    const restoreDrops = normalizers ? restoreRehearsal(snapshot, normalizers).dropped.map(d => ({ key: d.key, count: d.ids ? d.ids.length : d.sourceCount - d.resultCount })) : [];
    const entry = { id, reason, at, digest, txnCount, counts, restoreDrops, snapshot, ...(pinned ? { pinned: true, conflictId, conflictIds: conflictId ? [conflictId] : [] } : {}) };
    // The same data taken for the same reason is stored ONCE. A repeat of an identical copy (for example a sign-out with no new changes) reuses the existing entry;
    // a pinned request pins it and records one more reason to keep it. This stops identical full copies filling browser storage.
    const current = readList(storage);
    const dup = current.find(b => b.digest === digest && b.reason === reason);
    let all;
    if (dup) {
      entry.id = dup.id;
      const ids = [...new Set([...(dup.conflictIds || (dup.conflictId ? [dup.conflictId] : [])), ...(pinned && conflictId ? [conflictId] : [])])];
      const merged = { ...dup, ...(dup.pinned || pinned ? { pinned: true, conflictId: dup.conflictId || conflictId, conflictIds: ids } : {}) };
      all = current.map(b => (b.id === dup.id ? merged : b));
    } else {
      all = [...current, entry];
    }
    // Newest MAX_KEPT ordinary backups are kept; PINNED backups (a recorded conflict's two copies) are never pruned until released.
    const others = all.filter(b => !b.pinned).slice(-MAX_KEPT);
    let next = all.filter(b => b.pinned || others.includes(b));
    // Browser storage full: drop the OLDEST ordinary copies (never pinned ones, never this one) until it fits. Ordinary copies are
    // rotation copies of data that also lives on the device, so this never removes the only copy of anything.
    for (;;) {
      try { storage.setItem(SAFETY_BACKUPS_KEY, JSON.stringify(next)); break; }
      catch (e) {
        const victim = next.find(b => !b.pinned && b.id !== entry.id);
        if (!victim) throw e;
        next = next.filter(b => b.id !== victim.id);
      }
    }
    // Read back from storage and verify what we will rely on: same digest, same records in every list (not just transactions),
    // and that restoring it would drop nothing the original restore would not also drop.
    const back = readList(storage).find(b => b.id === entry.id);
    if (!back) return { ok: false, error: "backup not found after writing" };
    const backDigest = await digestSnapshot(back.snapshot);
    if (backDigest !== digest || txnIdsOf(back.snapshot).length !== txnCount) return { ok: false, error: "backup read-back did not match" };
    const same = sameRecords(back.snapshot, snapshot);
    if (!same.ok) return { ok: false, error: `backup records differ (${describeMissing([...same.missingInA, ...same.missingInB])})` };
    if (normalizers) {
      const rehearsal = rehearsalNoWorse(back.snapshot, snapshot, normalizers);
      if (!rehearsal.ok) return { ok: false, error: `restoring this backup would lose records (${describeMissing(rehearsal.dropped)})` };
    }
    return { ok: true, id: entry.id, digest, txnCount, at, counts, restoreDrops };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

export function listSafetyBackups(storage) {
  return readList(storage).map(({ id, reason, at, digest, txnCount }) => ({ id, reason, at, digest, txnCount }));
}

/** Ids of transactions that are recoverable from any safety backup on this device. */
export function backedUpTxnIds(storage) {
  const ids = new Set();
  for (const b of readList(storage)) for (const id of txnIdsOf(b.snapshot)) ids.add(id);
  return ids;
}

export function getSafetyBackup(storage, id) {
  return readList(storage).find(b => b.id === id) || null;
}

/** A recorded conflict is resolved (or abandoned): its pinned backups return to the ordinary rotation. */
export function releasePinned(storage, conflictId) {
  const list = readList(storage).map(b => {
    if (!b.pinned) return b;
    const held = b.conflictIds && b.conflictIds.length ? b.conflictIds : [b.conflictId ?? null];
    if (!held.includes(conflictId)) return b;     // held for a different conflict: stays pinned
    const rest = held.filter(c => c !== conflictId);
    return rest.length ? { ...b, conflictIds: rest, conflictId: rest[0] } : { ...b, pinned: false, conflictIds: [] };
  });
  storage.setItem(SAFETY_BACKUPS_KEY, JSON.stringify(list));
}

export function listPinned(storage) {
  return readList(storage).filter(b => b.pinned).map(({ id, reason, at, digest, txnCount, conflictId }) => ({ id, reason, at, digest, txnCount, conflictId }));
}

/** Full entries (with snapshots) for the Backup & Restore screen, oldest first. */
export function readSafetyBackups(storage) { return readList(storage); }

export const REASON_LABELS = {
  "before-fast-forward": "Before adopting the cloud copy",
  "before-use-cloud": "Before replacing this device with the cloud copy",
  "before-keep-local": "Cloud copy, before replacing it with this device's data",
  "conflict-cloud-copy": "Cloud copy held while you decide",
  "conflict-device-copy": "This device's copy held while you decide",
  "before-restore": "This device, before restoring a backup",
  "cloud-before-restore": "Cloud copy, before a restore replaces it",
};
