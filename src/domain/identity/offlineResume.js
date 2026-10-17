// domain/identity/offlineResume.js
//
// Reopening Arth with no connection. A device that has signed in before, finished first-time setup and holds saved
// data may open and be used locally while the account check cannot reach the server. This never counts a saved
// session as proof of sign-in: while offline the person is treated as signed out of the cloud (nothing is sent), and
// the saved session only becomes usable again after the server has confirmed it.
//
// Pure functions only; App.jsx and cloudSync.js do the I/O.

/** How long the startup account check may take before a device that qualifies is let in locally. */
export const OFFLINE_CHECK_TIMEOUT_MS = 5000;

/** True for a failure to REACH the server (offline, DNS, timeout, 502/503/504), never for "the server said no". */
export function isNetworkAuthError(error) {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  if (error.name === "AuthUnknownError") return false;
  return error instanceof TypeError; // fetch() itself rejects with TypeError when offline
}

/**
 * @param {{user?:object|null, error?:object|null, timedOut?:boolean}} r result of the account check
 * @returns {"verified"|"unreachable"|"signed-out"}
 *   verified    the server returned the user
 *   unreachable the check could not reach the server (or did not finish in time): says nothing about the session
 *   signed-out  the server answered and there is no valid session (or the answer was an auth error)
 */
export function classifyAuthCheck({ user = null, error = null, timedOut = false } = {}) {
  if (user) return "verified";
  if (timedOut || isNetworkAuthError(error)) return "unreachable";
  return "signed-out";
}

/**
 * May this device be let in locally while the account cannot be checked?
 * All three must hold, so a first-time device, a signed-in device with nothing saved, or a device that never finished
 * setup stays blocked exactly as before.
 */
export function canResumeOffline({ sessionOnDevice = false, setupComplete = false, localMeaningful = false } = {}) {
  return Boolean(sessionOnDevice && setupComplete && localMeaningful);
}
