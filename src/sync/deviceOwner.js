// src/sync/deviceOwner.js
//
// Account-isolation guard (SYNC-SAFETY-008). The data on this device belongs to ONE account. Without a record of which, the sync
// rules could not tell "my own data, never synced" from "the previous person's data", and signing in as a second account would
// upload the first account's transactions into it (when the second cloud is empty) or ask the wrong question (when it is not).
//
// The record is device-level (`arth_data_owner`), separate from the per-account sync history (`arth_sync_state`):
//   { userId, email, at, source }  source: "clean-device" | "session" | "agreed" | "transfer" | "start-fresh" | "sign-out" | "sync-history"
// It is written ONLY when ownership is known to be true:
//   - the device holds no user data (nothing to protect; the signing-in account becomes the owner),
//   - an already-verified session continues (restored on boot, or resumed from offline and then confirmed by the server),
//   - this device and the account's cloud copy were agreed (the sync engine established a common point),
//   - on sign-out (the account that is leaving owns what is on the device),
//   - the person explicitly chose (transfer / start fresh).
// Unreadable or malformed records count as "no record".

export const OWNER_KEY = "arth_data_owner";
export const SYNC_STATE_KEY_FOR_OWNER = "arth_sync_state";

export function readOwner(storage) {
  try {
    const o = JSON.parse(storage.getItem(OWNER_KEY) || "null");
    if (o && typeof o === "object" && typeof o.userId === "string" && o.userId) return o;
  } catch { /* unreadable: no record */ }
  return null;
}

export function writeOwner(storage, { userId, email = "", source, now = () => Date.now(), transferredFrom = null }) {
  const rec = { userId, email: email || "", at: new Date(now()).toISOString(), source, ...(transferredFrom ? { transferredFrom } : {}) };
  storage.setItem(OWNER_KEY, JSON.stringify(rec));
  return rec;
}

/** Devices that synced under an engine build before this record existed still say whose history they hold. */
export function ownerFromSyncHistory(storage) {
  try {
    const s = JSON.parse(storage.getItem(SYNC_STATE_KEY_FOR_OWNER) || "null");
    if (s && typeof s === "object" && typeof s.userId === "string" && s.userId) return { userId: s.userId, email: "", source: "sync-history", state: s };
  } catch { /* none */ }
  return null;
}

/**
 * @param {{ owner: {userId:string,email?:string}|null, historyOwner: {userId:string}|null, userId: string, localMeaningful: boolean, continuedSession: boolean }} p
 * @returns {{ kind: "own"|"claim"|"other-account"|"unowned-with-data", ownerUserId: string|null, ownerEmail: string, reason: string }}
 *   own               data belongs to this account: sync as usual
 *   claim             nothing to protect, or an already-verified session continues: record this account as the owner and sync
 *   other-account     the data belongs to a DIFFERENT account: send nothing, ask
 *   unowned-with-data data with no known owner, and this is a fresh sign-in (not a continued session): send nothing, ask
 */
export function classifyOwnership({ owner, historyOwner, userId, localMeaningful, continuedSession }) {
  const known = owner || historyOwner || null;
  const ownerUserId = known ? known.userId : null, ownerEmail = known ? (known.email || "") : "";
  if (known && known.userId === userId) return { kind: "own", ownerUserId, ownerEmail, reason: "recorded-owner-is-this-account" };
  if (!localMeaningful) return { kind: "claim", ownerUserId, ownerEmail, reason: "device-holds-no-user-data" };
  if (known) return { kind: "other-account", ownerUserId, ownerEmail, reason: "device-data-belongs-to-another-account" };
  if (continuedSession) return { kind: "claim", ownerUserId, ownerEmail, reason: "verified-session-continues" };
  return { kind: "unowned-with-data", ownerUserId, ownerEmail, reason: "device-data-has-no-recorded-owner" };
}

/**
 * The snapshot a device is given when the person chooses "start fresh as this account".
 * applyCloudSnapshot deliberately KEEPS the device's current list when the incoming snapshot lacks that key (so a snapshot saved
 * before a feature existed does not wipe it). Applying a new account's cloud copy, or nothing, would therefore leave the previous
 * account's lists in place and sync them into the new account later. This builds a snapshot in which every data key present on
 * this device is explicitly empty, then lays the new account's own data over it. Keys the app normalises to its fresh-install
 * defaults (`defaultKeys`) are left out so the defaults apply.
 * @param {object} local        this device's current snapshot (names the keys that must be emptied)
 * @param {object|null} cloudSnapshot  the new account's cloud copy, if it has one
 * @param {string[]} defaultKeys  keys that fall back to fresh-install defaults when absent
 * @param {string} nowIso
 */
export function startFreshSnapshot(local, cloudSnapshot, defaultKeys, nowIso) {
  const KEEP_SCALARS = new Set(["version", "dark", "autoDetectExpenseCategory", "workTripMode", "autoBackupEnabled", "autoBackupFrequency"]);
  const empty = { version: (local && local.version) || 1, savedAt: nowIso, masterUserSetupComplete: false };
  for (const [k, v] of Object.entries(local || {})) {
    if (k === "savedAt" || k === "syncMeta" || k === "masterUserSetupComplete" || defaultKeys.includes(k)) continue;
    if (KEEP_SCALARS.has(k)) { empty[k] = v; continue; }
    if (Array.isArray(v)) empty[k] = [];
    else if (v && typeof v === "object") empty[k] = {};
    // other scalars are dropped: they take the app's defaults
  }
  if (!cloudSnapshot) return empty;
  const { syncMeta, ...rest } = cloudSnapshot;
  return { ...empty, ...rest };
}
