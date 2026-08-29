// domain/futureMoney/compose.js
//
// The smallest possible Future Money composition function — I-1's
// read-side projection layer, made real for the first time. Combines
// already-canonical projection sources into one unified result. Adds no
// new projection logic of its own: every event it outputs was already
// produced, unmodified, by the source that owns it.
//
// getCommitments() (src/domain/bills/commitments.js) is not imported,
// referenced, or modified by this file. This function takes its OUTPUT as
// a plain argument — the caller runs getCommitments() and passes the
// result in. That keeps this file fully decoupled from Bills' internals
// and easy to test without needing accounts/txns/groups/getCardSummary to
// even exist.
//
// School Fees remains the owner of its own projection — this file never
// recomputes anything getSchoolFeeCommitments() already decided; it only
// merges the array that function returns.
//
// No Debt/EMI event is fabricated anywhere in this file. `debtService` is
// present in the output shape for I-1 completeness (Debt Service is one of
// the three locked commitment classes) but stays empty until a real Debt/
// EMI adapter exists to populate it — an empty array is an honest "nothing
// to report," never a placeholder event.
//
// Deduplication: per the already-locked I-1 rule ("one economic obligation
// → one Future Money event"), if the same (sourceType, sourceId) pair ever
// appears in more than one input source — which should never happen by
// construction today, since Bills/CC/SIP and School Fees use entirely
// disjoint sourceType values, but could happen if a future source were
// wired in incorrectly — this function keeps the first occurrence and
// drops the rest, rather than silently duplicating an obligation. This is
// enforcement of an existing rule, not new business logic.

/**
 * Compose Future Money commitments from already-canonical sources.
 *
 * @param {{committedSpending?:Array, committedSaving?:Array}} commitmentsResult
 *   - the exact, unmodified return value of getCommitments(). Optional —
 *   pass null/undefined if not available, composition still works.
 * @param {Array<Array>} additionalSources - zero or more flat event arrays
 *   from other canonical projections (e.g. School Fees' getSchoolFeeCommitments()
 *   today; a future Debt/EMI adapter later). Each array's events must
 *   already be in the I-1 event shape.
 * @returns {{committedSpending:Array, committedSaving:Array, debtService:Array}}
 *   the composed result, grouped by category, in the exact I-1 event shape,
 *   with fields entirely untouched from their source.
 */
export function composeFutureMoneyCommitments(commitmentsResult, additionalSources = []) {
  const merged = {
    committedSpending: [],
    committedSaving: [],
    debtService: [],
  };
  const seen = new Set(); // dedup key: `${sourceType}:${sourceId}`

  const addEvent = (event) => {
    if (!event || !event.category || !event.sourceType || event.sourceId == null) return; // defensive skip of malformed input, never throws
    const key = `${event.sourceType}:${event.sourceId}`;
    if (seen.has(key)) return; // first occurrence wins — see file header
    seen.add(key);
    if (!merged[event.category]) merged[event.category] = [];
    merged[event.category].push(event);
  };

  for (const event of (commitmentsResult && commitmentsResult.committedSpending) || []) addEvent(event);
  for (const event of (commitmentsResult && commitmentsResult.committedSaving) || []) addEvent(event);

  for (const source of additionalSources || []) {
    for (const event of source || []) addEvent(event);
  }

  return merged;
}
