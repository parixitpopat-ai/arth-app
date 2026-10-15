// src/sync/syncState.js
//
// What each device remembers about its last point of agreement with the cloud (SYNC-SAFETY-002 §3.1).
// Anything unreadable or belonging to another account is treated as "no history", which is the safe
// reading: with no history the engine never replaces data on a guess (see decideSync).

export const SYNC_STATE_KEY = "arth_sync_state";

export const EMPTY_STATE = Object.freeze({
  userId: null,
  baseToken: null,
  baseDigest: null,
  pendingWrite: null,   // { writeId, digest } persisted BEFORE a write is sent, to recognise a lost reply
  conflict: null,       // { type, detectedAt, cloudToken, diff }
  paused: null,         // null | "token-unreliable" | "reconcile-mismatch"
  lastVerifiedAt: null, // ISO time of the last sync whose result was verified
  lastReconcile: null,  // { at, ok, localCount, cloudCount, detail }
  lastBackup: null,     // { id, at, txnCount, reason }: the most recent VERIFIED safety backup (what the UI may mention)
});

export function loadSyncState(storage, userId) {
  try {
    const parsed = JSON.parse(storage.getItem(SYNC_STATE_KEY) || "null");
    if (parsed && typeof parsed === "object" && parsed.userId === userId) return { ...EMPTY_STATE, ...parsed };
  } catch { /* fall through: unreadable state means no history */ }
  return { ...EMPTY_STATE, userId };
}

export function saveSyncState(storage, state) {
  storage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
  return state;
}
