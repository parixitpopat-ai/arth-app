// domain/schoolFees/creditNotes.js
//
// Pure functions for I-5 WP-7 (credit note create + apply). No state, no
// side effects, no persistence, no Transaction creation. Credit notes are
// explicitly a SEPARATE domain fact from payment (decision #8) — this
// module never creates a transaction, never touches a period's paidAmount,
// and never applies a credit without an explicit caller action naming both
// the note and the target period.

/**
 * Create a new school credit note. Standalone — no period dependency.
 *
 * @param {string} scheduleId
 * @param {number} amount
 * @param {string} reason
 * @param {Function} genId - id generator, injected (matches the app's own
 *   genId convention, not imported directly, keeping this module pure)
 * @returns {Object} a new schoolCreditNotes[] record
 */
export function createSchoolCreditNote(scheduleId, amount, reason, genId) {
  if (!scheduleId) throw new Error("createSchoolCreditNote: scheduleId is required");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("createSchoolCreditNote: amount must be a positive number");
  if (!reason || typeof reason !== "string" || !reason.trim()) throw new Error("createSchoolCreditNote: a reason is required");
  if (typeof genId !== "function") throw new Error("createSchoolCreditNote: genId function is required");

  return {
    id: genId(),
    scheduleId,
    amount,
    reason,
    createdAt: Date.now(),
    applications: [],
  };
}

/**
 * Available (unapplied) balance on a credit note.
 * @returns {number} amount minus the sum of everything already applied
 */
export function calculateAvailableCredit(note) {
  const applied = (note.applications || []).reduce((s, a) => s + a.amount, 0);
  return Math.max(0, (note.amount || 0) - applied);
}

/**
 * Apply (part of) a credit note's available balance to a fee period.
 * Never automatic — always an explicit call naming both the note and the
 * target period. Never creates a transaction. Never touches paidAmount —
 * the reduction is tracked in its own field, appliedCreditAmount, kept
 * distinguishable from a real payment.
 *
 * @param {Object} note - a schoolCreditNotes[] record
 * @param {Object} period - a feePeriods[] record
 * @param {number} amount - how much of the note's available balance to apply
 * @param {Function} calculateOutstanding - injected from outstanding.js,
 *   passed in rather than imported to keep this module's dependency graph
 *   explicit at the call site (both this module and outstanding.js are
 *   already small; this keeps testing simple without a real import cycle)
 * @returns {{updatedNote:Object, updatedPeriod:Object}} both updated,
 *   neither input mutated.
 * @throws {Error} if amount exceeds the note's available balance, or the
 *   period's current outstanding — never caps, never silently consumes.
 */
export function applyCreditToPeriod(note, period, amount, calculateOutstanding) {
  if (!note || !period) throw new Error("applyCreditToPeriod: note and period are both required");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("applyCreditToPeriod: amount must be a positive number");
  if (!period.startingStateDeclared) {
    throw new Error("applyCreditToPeriod: this period has not been declared yet (WP-3) — its status is unknown, credit cannot be applied until declared");
  }

  const available = calculateAvailableCredit(note);
  const EPS = 1e-9;
  if (amount - available > EPS) {
    throw new Error(`applyCreditToPeriod: amount (${amount}) exceeds the credit note's available balance (${available}) — refusing to over-apply`);
  }
  const outstanding = calculateOutstanding(period);
  if (amount - outstanding > EPS) {
    throw new Error(`applyCreditToPeriod: amount (${amount}) exceeds the period's outstanding balance (${outstanding}) — refusing to over-apply`);
  }

  const updatedNote = {
    ...note,
    applications: [...(note.applications || []), { periodId: period.id, amount, appliedAt: Date.now() }],
  };
  const updatedPeriod = {
    ...period,
    appliedCreditAmount: (period.appliedCreditAmount || 0) + amount,
    // deliberately NOT touching paidAmount or settlementLinks — this is a
    // credit application, not a payment, and must stay distinguishable.
  };

  return { updatedNote, updatedPeriod };
}
