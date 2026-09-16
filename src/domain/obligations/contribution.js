// domain/obligations/contribution.js
//
// WP-OBL-01 (OBL-002) — the canonical Contribution primitive. Pure functions
// only: no React, no Supabase, no persistence, no side effects. This module
// is the single technical home for "a real Transaction contributed a
// specific amount toward a specific Obligation" — nothing else in the app
// writes this fact.
//
// Scope boundary (WP-OBL-01, per OBL-002 Section 13): this file and its
// tests only. No App.jsx wiring, no persistence/cloud/localStorage
// integration, no Transaction edit/delete wiring, no School Fees/Bills/
// Insurance/Membership/EMI changes, no migration. Those are later WPs.
//
// ---------------------------------------------------------------------------
// THE OVERPAYMENT BOUNDARY (OBL-001 Section 17, Q1) — READ BEFORE EXTENDING
// ---------------------------------------------------------------------------
// OBL-001 found two live, conflicting, already-shipped policies in this
// codebase: School Fees rejects any allocation exceeding an obligation's
// outstanding balance outright ("does not cap"); Person/Group settlement
// explicitly allows overpayment and tracks the excess as an advance. OBL-001
// marked which of these (or a third option) the canonical model should use
// as OPEN — genuinely undecided, not deferred out of laziness.
//
// This module does NOT decide it. createContribution() below deliberately
// takes no obligation-amount context at all (no coreAmount, no
// alreadyContributed total) — it cannot check "does this overpay the
// obligation" because it is never handed the information that question
// depends on. That is not an oversight to fix later; it is the boundary.
//
// getTotalContributed() (below) is the primitive a future policy needs to
// answer that question — once OBL-001 Q1 is resolved, whichever caller
// enforces the chosen policy will compute
// getTotalContributed(contributions, obligationType, obligationId) + amount
// and compare it against the obligation's own coreAmount itself, using
// whatever accept/reject/cap rule Q1's resolution specifies. That policy
// does not belong in this file, and nothing here should be extended to add
// it without a corresponding update to OBL-001 first.
// ---------------------------------------------------------------------------

export class ContributionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContributionValidationError";
  }
}

/**
 * Constructs and validates a single Contribution record. Pure — does not
 * touch any array, stored or otherwise. See TxnsStateRepository/Account.js
 * for the equivalent idiom this mirrors (throws a dedicated ValidationError
 * on any invalid input, never guesses or silently coerces).
 *
 * Validates only what is structurally decidable from the inputs given:
 *   - all three references are non-empty strings
 *   - amount is a positive finite number
 *   - amount does not exceed txnAmount (a Contribution cannot be worth more
 *     than the transaction that supposedly made it — this is a structural
 *     fact about the transaction, NOT the OBL-001 Q1 overpayment-vs-
 *     obligation question above; it is not gated on Q1)
 *
 * Deliberately NOT validated here (see the module header):
 *   - whether `amount` overpays the obligation's own remaining balance
 *     (OBL-001 Q1 — this function is never given the obligation's amount,
 *     so it cannot check this even if it wanted to)
 *   - whether the SUM of this transaction's contributions, across multiple
 *     separate createContribution calls over time, exceeds txnAmount — this
 *     is a distinct, separate, un-specified gap (not Q1), left for a future
 *     WP's explicit decision rather than invented here
 *
 * @param {Object} input
 * @param {string} input.obligationType - which kind of obligation (e.g.
 *   "schoolFeePeriod", "bill", "loan") — obligations are not unified into
 *   one array by this module; this says which array to look in.
 * @param {string} input.obligationId - the specific obligation record's id
 *   within its own type's array.
 * @param {string} input.txnId - the transaction making this contribution.
 * @param {number} input.amount - this Contribution's own amount.
 * @param {number} input.txnAmount - the transaction's own total amount,
 *   passed in by the caller (this module has no Transaction access of its
 *   own) so the one structural invariant above can be enforced.
 * @param {Function} genId - id generator, injected (matches the app's own
 *   genId convention, not imported directly, keeping this module pure —
 *   see domain/schoolFees/creditNotes.js for the identical precedent).
 * @returns {Object} a new Contribution record: { id, obligationType,
 *   obligationId, txnId, amount, createdAt }
 * @throws {ContributionValidationError}
 */
export function createContribution({ obligationType, obligationId, txnId, amount, txnAmount } = {}, genId) {
  if (!obligationType || typeof obligationType !== "string" || !obligationType.trim()) {
    throw new ContributionValidationError("createContribution: obligationType is required");
  }
  if (!obligationId || typeof obligationId !== "string" || !obligationId.trim()) {
    throw new ContributionValidationError("createContribution: obligationId is required");
  }
  if (!txnId || typeof txnId !== "string" || !txnId.trim()) {
    throw new ContributionValidationError("createContribution: txnId is required");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ContributionValidationError("createContribution: amount must be a positive number");
  }
  if (!Number.isFinite(txnAmount) || txnAmount <= 0) {
    throw new ContributionValidationError("createContribution: txnAmount must be a positive number");
  }
  if (amount > txnAmount) {
    throw new ContributionValidationError(
      "createContribution: amount cannot exceed the transaction's own amount (txnAmount)"
    );
  }
  if (typeof genId !== "function") {
    throw new ContributionValidationError("createContribution: genId function is required");
  }

  return {
    id: genId(),
    obligationType,
    obligationId,
    txnId,
    amount,
    createdAt: Date.now(),
  };
}

/**
 * Pure collection transformation — appends a newly-constructed Contribution
 * to a (possibly empty/missing) prior collection. Matches the setState-
 * updater shape already used for every other top-level array in this
 * codebase (setTxns(prev => ...), setBills(prev => ...)): the caller is
 * expected to invoke this as `setContributions(prev =>
 * withNewContribution(prev, input, genId))` — never with a directly-
 * computed array from anywhere else. See OBL-002 Section 4.
 *
 * This function itself does not write to React state, localStorage, or any
 * cloud snapshot — it returns the next array value; committing that value
 * is the caller's responsibility (WP-OBL-03, not this module).
 *
 * @param {Array} prevContributions
 * @param {Object} input - see createContribution's input shape
 * @param {Function} genId - injected id generator, see createContribution
 * @returns {Array} the next contributions array
 * @throws {ContributionValidationError} propagated from createContribution
 */
export function withNewContribution(prevContributions, input, genId) {
  const contribution = createContribution(input, genId);
  return [...(prevContributions || []), contribution];
}

/**
 * Pure collection transformation — removes one Contribution by id. Does not
 * decide WHEN this should be called (OBL-001 Q3, transaction-delete policy,
 * remains OPEN) — only provides the mechanism a future caller uses once
 * that policy is decided.
 *
 * @param {Array} prevContributions
 * @param {string} contributionId
 * @returns {Array} the next contributions array, with that id removed if
 *   present (silently returns the array unchanged if the id doesn't exist —
 *   matches this codebase's own convention elsewhere of tolerant removal,
 *   e.g. archiveGroup-adjacent filter helpers, rather than throwing on a
 *   not-found id).
 */
export function withoutContribution(prevContributions, contributionId) {
  return (prevContributions || []).filter(c => c.id !== contributionId);
}

/**
 * Query direction 1: obligation -> its contributions.
 * @returns {Array} every Contribution for this specific obligation, in the
 *   order they appear in the source array (insertion order is preserved,
 *   matching School's own "cross-call accumulation is order-preserving"
 *   tested precedent for the equivalent concept).
 */
export function getContributionsForObligation(contributions, obligationType, obligationId) {
  return (contributions || []).filter(
    c => c.obligationType === obligationType && c.obligationId === obligationId
  );
}

/**
 * Query direction 2: transaction -> the obligation(s) it contributes to.
 * Confirmed by OBL-001 Section 5 evidence (School's own multi-period
 * settlement flow) that one real transaction can legitimately appear here
 * against more than one obligation at once — this function makes no
 * assumption limiting the result to a single entry.
 * @returns {Array} every Contribution this transaction is part of.
 */
export function getContributionsForTransaction(contributions, txnId) {
  return (contributions || []).filter(c => c.txnId === txnId);
}

/**
 * @returns {number} the sum of every real Contribution's amount for this
 *   obligation. This is transaction-backed settlement evidence ONLY — it
 *   does not include any Historical/Asserted amount (OBL-001 Section 8;
 *   OBL-002 Section 7), which is not a Contribution and is not tracked by
 *   this module at all. This is the exact primitive a future OBL-001 Q1
 *   resolution needs to build whichever overpayment policy is chosen — see
 *   the module header.
 */
export function getTotalContributed(contributions, obligationType, obligationId) {
  return getContributionsForObligation(contributions, obligationType, obligationId)
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);
}

/**
 * The financial-protection detection primitive (OBL-001 Section 9; OBL-002
 * Section 9). True whenever this obligation has at least one real
 * Contribution. Does NOT decide what a caller must do in response (School's
 * discount/write-off/credit-note correction mechanism vs. an equivalent for
 * other modules is explicitly OPEN per OBL-001 Section 9) — detection only.
 * @returns {boolean}
 */
export function hasProtectedContributions(contributions, obligationType, obligationId) {
  return getContributionsForObligation(contributions, obligationType, obligationId).length > 0;
}
