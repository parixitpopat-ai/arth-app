// src/sync/safetyBackup.js
//
// Backup-before-replacement guarantee (SYNC-SAFETY-002 §3.6). Separate from the rolling auto-backups:
// no throttle, no 3-entry trim, newest MAX_KEPT retained. A backup only counts once it has been READ BACK
// and its digest and transaction count match what was meant to be saved. If it cannot be written
// (for example browser storage is full) the caller must NOT replace anything.

import { digestSnapshot, txnIdsOf } from "./digest.js";

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
export async function createSafetyBackup(storage, { reason, snapshot, now = () => Date.now(), genId }) {
  try {
    const digest = await digestSnapshot(snapshot);
    const txnCount = txnIdsOf(snapshot).length;
    const at = new Date(now()).toISOString();
    const id = `sb_${now()}_${genId()}`;
    const entry = { id, reason, at, digest, txnCount, snapshot };
    const next = [...readList(storage), entry].slice(-MAX_KEPT);
    storage.setItem(SAFETY_BACKUPS_KEY, JSON.stringify(next));
    // Read back from storage and compare: what we will rely on is what is actually stored.
    const back = readList(storage).find(b => b.id === id);
    if (!back) return { ok: false, error: "backup not found after writing" };
    const backDigest = await digestSnapshot(back.snapshot);
    if (backDigest !== digest || txnIdsOf(back.snapshot).length !== txnCount) return { ok: false, error: "backup read-back did not match" };
    return { ok: true, id, digest, txnCount, at };
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
