// src/sync/decideSync.js
//
// The one place that decides what a sync must do (SYNC-SAFETY-002 §3.2). Pure: no I/O, no clock.
// "Newer" is never guessed from timestamps; it is decided from recorded sync history:
//   baseToken  = the cloud row's token when this device and the cloud were last known identical
//   baseDigest = digest of the synced content at that moment
// dirty = this device's content differs from baseDigest (derived from data, so it survives reloads).

export const SYNC_ACTIONS = Object.freeze({
  NOOP: "noop",
  PUSH: "push",                 // conditional write; expectedToken says which cloud version it replaces
  INSERT: "insert",             // first write of the row
  FAST_FORWARD: "fast-forward", // this device is clean and the cloud moved on: adopt the cloud copy (after a verified backup)
  ADOPT_BASE: "adopt-base",     // both sides already hold identical content: just record the new common point
  CONFLICT: "conflict",         // both sides changed: replace nothing, ask
  RETRY_LATER: "retry-later",   // the cloud could not be reached: change nothing
});

/**
 * @param {{
 *   networkOk: boolean,
 *   hasBase: boolean, baseToken?: string, baseDigest?: string,
 *   localDigest: string, localMeaningful: boolean,
 *   cloud: null | { token: string, digest: string, meaningful: boolean },
 * }} input
 * @returns {{ action: string, reason: string, expectedToken?: string, dirty: boolean }}
 */
export function decideSync(input) {
  const { networkOk, hasBase, baseToken, baseDigest, localDigest, localMeaningful, cloud } = input;
  const dirty = hasBase ? localDigest !== baseDigest : localMeaningful;
  const out = (action, reason, expectedToken) => ({ action, reason, dirty, ...(expectedToken !== undefined ? { expectedToken } : {}) });

  if (!networkOk) return out(SYNC_ACTIONS.RETRY_LATER, "cloud-unreachable");

  if (!cloud) {
    // No cloud row yet (new account, or the row was removed): create it from this device, even when it only holds a profile and
    // settings, so every later edit is tracked against a known version and reaches the cloud.
    return out(SYNC_ACTIONS.INSERT, "no-cloud-row");
  }

  if (hasBase) {
    if (cloud.token === baseToken) {
      return dirty ? out(SYNC_ACTIONS.PUSH, "local-changed", baseToken) : out(SYNC_ACTIONS.NOOP, "in-sync");
    }
    if (localDigest === cloud.digest) return out(SYNC_ACTIONS.ADOPT_BASE, "cloud-moved-but-identical");
    return dirty ? out(SYNC_ACTIONS.CONFLICT, "both-changed") : out(SYNC_ACTIONS.FAST_FORWARD, "cloud-changed-local-clean");
  }

  // No history on this device (existing install, new device, or account switch).
  if (localDigest === cloud.digest) return out(SYNC_ACTIONS.ADOPT_BASE, "identical-no-history");
  if (!localMeaningful) return out(SYNC_ACTIONS.FAST_FORWARD, "device-without-data-takes-cloud");      // a verified backup of the device is taken first
  if (!cloud.meaningful) return out(SYNC_ACTIONS.PUSH, "cloud-row-has-no-user-data", cloud.token);
  return out(SYNC_ACTIONS.CONFLICT, "both-have-data-no-history");
}
