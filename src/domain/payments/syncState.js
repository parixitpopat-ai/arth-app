// domain/payments/syncState.js
//
// Payments v2 H3 — offline. Arth saves every payment on the device first; cloud sync (cloudSync.js) then
// copies the snapshot up. So "Will sync" is only ever true when sync is actually on for this account AND the
// change is newer than the last successful sync — never a promise the app can't keep.

/** @returns {boolean} true when a change made at `changedAtMs` has not reached the cloud yet */
export function isPendingSync(changedAtMs, lastSyncedAt, cloudActive) {
  if (!cloudActive) return false;
  const changed = Number(changedAtMs);
  const synced = Date.parse(lastSyncedAt || "");
  if (!Number.isFinite(changed) || changed <= 0) return false;
  if (!Number.isFinite(synced)) return false; // never synced on this device: no basis to say what is pending
  return changed > synced;
}

/** Text for the top strip. `stamp` is an already-formatted last-synced time, or "". */
export function offlineStripText(stamp, cloudActive) {
  if (cloudActive && stamp) return `Offline · showing what was last synced ${stamp}`;
  return "Offline · everything is saved on this phone";
}

/** Toast after recording a payment while offline. */
export function offlineSavedText(billName, cloudActive) {
  return cloudActive
    ? `Payment for ${billName} will sync when you’re back online.`
    : `Payment for ${billName} is saved on this phone.`;
}
