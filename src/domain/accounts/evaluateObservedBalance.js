// WP-07 — Balance-observation comparison boundary.
//
// Pure, comparison-only, zero write authority. This function decides
// nothing about what should be written anywhere — it only answers "given
// an externally observed balance and this account's current reconciliation
// state, what's the honest diff and what category of situation is this."
//
// Deliberately does NOT:
//   - touch React state, App.jsx, or any UI concern
//   - write to accounts[] or balanceCheckpoints
//   - know anything about Balance Check's flow (that screen never calls this)
//   - become a general "reconciliation service" — it has exactly one job
//
// Callers (SMS sync) decide what to DO with the outcome; this function only
// tells them what's true.

export const OBSERVATION_OUTCOME = {
  NO_CHECKPOINT: "NO_CHECKPOINT",
  MATCHES: "MATCHES",
  RECONCILED_DISCREPANCY: "RECONCILED_DISCREPANCY",
};

/**
 * @param {object} params
 * @param {number} params.effectiveBalance - the account's current
 *   effectiveAccountBalance() value — the comparison baseline, always,
 *   regardless of whether a checkpoint exists. For an account with no
 *   checkpoint, effectiveAccountBalance === accountBalance, so this
 *   parameter alone is sufficient; the caller does not need to pass both.
 * @param {object|null} params.existingCheckpoint - balanceCheckpoints[accId]
 *   or null/undefined if none exists. Only its presence is inspected here
 *   (to select MATCHES/RECONCILED_DISCREPANCY vs NO_CHECKPOINT) — its
 *   contents are never read or interpreted; that's effectiveBalance's job
 *   to have already accounted for.
 * @param {number} params.observedBalance - the externally observed value
 *   (from SMS today; the parameter name is deliberately not SMS-specific).
 * @param {number} [params.threshold=0.01] - matches the existing
 *   Math.abs(balanceDiff) > 0.01 threshold this replaces.
 * @returns {{outcome: string, diff: number, baseline: number}}
 */
export function evaluateObservedBalance({ effectiveBalance, existingCheckpoint, observedBalance, threshold = 0.01 }) {
  const diff = Number(observedBalance) - Number(effectiveBalance);
  const hasCheckpoint = Boolean(existingCheckpoint && existingCheckpoint.date);

  if (Math.abs(diff) <= threshold) {
    return { outcome: OBSERVATION_OUTCOME.MATCHES, diff, baseline: effectiveBalance };
  }

  if (hasCheckpoint) {
    return { outcome: OBSERVATION_OUTCOME.RECONCILED_DISCREPANCY, diff, baseline: effectiveBalance };
  }

  return { outcome: OBSERVATION_OUTCOME.NO_CHECKPOINT, diff, baseline: effectiveBalance };
}
