// domain/membership/lifecycle.js
//
// Pure functions for Membership lifecycle status — Pause / Resume / End.
// No state, no side effects, no persistence, no interaction with Bills,
// School Fees, Insurance, Investments, Debt, or getCommitments().
//
// This module was built earlier and never wired to any UI. A trace of the
// real, live Membership implementation found it operates on per-payment
// coverage records, not a persistent relationship — so this module now
// operates on a NEW, separate entity (see relationship.js) representing
// the ongoing Provider -> Person relationship. Nothing here changes.
//
// statusHistory[] entries now carry a distinct effectiveDate (the date the
// change takes effect, which the person can set — e.g. "paused effective
// 15 Aug") separate from timestamp (when the action was actually recorded
// in Arth). This module was never shipped, so widening the entry shape now
// is safe — there is no real historical data whose shape would break.
//
// LOCKED DECISIONS:
// - Pause: status -> "paused". Valid only from "active". Requires a
//   reason. Temporary, resumable.
// - Resume: status -> "active". Valid only from "paused" — cannot resume
//   an "ended" relationship (a cancelled membership gets a new signup,
//   not an un-cancel). No reason required.
// - End: status -> "ended". Valid from "active" OR "paused". Requires a
//   reason. Terminal — cannot be paused, resumed, or ended again.
// - Every transition is appended to statusHistory[], never rewritten.
//
// ARTH-003 WP-C1 Step 1 (approved, option b): getRelationshipStatusAsOfDate
// and isDateActiveMembershipCoverage moved here from relationship.js. Both
// were already purely {status, statusHistory}-based with zero reference to
// billerAccountId or anything Membership-specific — this move is a pure
// relocation, not a behavior change. It makes this file the single generic
// lifecycle authority any managed relationship (Membership, and eventually
// School) can share, without School needing Membership's persisted shape
// or relationship.js needing to know School exists. relationship.js
// re-exports both functions so its one existing consumer (App.jsx's import)
// needs no change. No persisted membershipRelationships[] record is
// touched or migrated by this move.

function assertReason(reason, label) {
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    throw new Error(`${label}: a reason is required`);
  }
}

function assertEffectiveDate(effectiveDate, label) {
  if (!effectiveDate || typeof effectiveDate !== "string") {
    throw new Error(`${label}: an effectiveDate (date string) is required`);
  }
}

function appendHistory(entity, status, effectiveDate, reason) {
  const entry = { status, effectiveDate, timestamp: Date.now() };
  if (reason) entry.reason = reason;
  return [...(entity.statusHistory || []), entry];
}

/**
 * Pause an active relationship.
 * @param {object} entity - object with {status, statusHistory}
 * @param {string} reason - required
 * @param {string} effectiveDate - required, date string (e.g. "2026-08-15")
 * @throws {Error} if not currently active, reason or effectiveDate missing.
 */
export function pauseMembership(entity, reason, effectiveDate) {
  if (!entity || typeof entity !== "object") {
    throw new Error("pauseMembership: an entity object is required");
  }
  const currentStatus = entity.status || "active";
  if (currentStatus === "ended") {
    throw new Error("pauseMembership: cannot pause an ended membership");
  }
  if (currentStatus === "paused") {
    throw new Error("pauseMembership: membership is already paused");
  }
  assertReason(reason, "pauseMembership");
  assertEffectiveDate(effectiveDate, "pauseMembership");

  return {
    ...entity,
    status: "paused",
    statusHistory: appendHistory(entity, "paused", effectiveDate, reason),
  };
}

/**
 * Resume a paused relationship back to active.
 * @param {object} entity - object with {status, statusHistory}
 * @param {string} effectiveDate - required, date string
 * @throws {Error} if not currently paused (including if already ended).
 */
export function resumeMembership(entity, effectiveDate) {
  if (!entity || typeof entity !== "object") {
    throw new Error("resumeMembership: an entity object is required");
  }
  const currentStatus = entity.status || "active";
  if (currentStatus !== "paused") {
    throw new Error(`resumeMembership: can only resume a paused membership (current status: ${currentStatus})`);
  }
  assertEffectiveDate(effectiveDate, "resumeMembership");

  return {
    ...entity,
    status: "active",
    statusHistory: appendHistory(entity, "active", effectiveDate, null),
  };
}

/**
 * End a relationship permanently (from active or paused).
 * @param {object} entity - object with {status, statusHistory}
 * @param {string} reason - required
 * @param {string} effectiveDate - required, date string
 * @throws {Error} if already ended, reason or effectiveDate missing.
 */
export function endMembership(entity, reason, effectiveDate) {
  if (!entity || typeof entity !== "object") {
    throw new Error("endMembership: an entity object is required");
  }
  const currentStatus = entity.status || "active";
  if (currentStatus === "ended") {
    throw new Error("endMembership: membership is already ended");
  }
  assertReason(reason, "endMembership");
  assertEffectiveDate(effectiveDate, "endMembership");

  return {
    ...entity,
    status: "ended",
    statusHistory: appendHistory(entity, "ended", effectiveDate, reason),
  };
}

/**
 * What was this relationship's status as of a given date? Walks
 * statusHistory and returns whichever entry's effectiveDate is the latest
 * one on or before `date`. If every entry is after `date` (asking about a
 * time before the relationship existed), returns null — not "active" by
 * default, since that would fabricate coverage that was never granted.
 *
 * Moved here (WP-C1 Step 1) from relationship.js, unchanged — this
 * function only ever read {status, statusHistory}. It has no idea what
 * kind of relationship it's being asked about, by design.
 */
export function getRelationshipStatusAsOfDate(statusHistory, date) {
  if (!Array.isArray(statusHistory) || statusHistory.length === 0) return null;
  const applicable = statusHistory
    .filter(h => h.effectiveDate && h.effectiveDate <= date)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.timestamp - b.timestamp);
  if (applicable.length === 0) return null;
  return applicable[applicable.length - 1].status;
}

/**
 * Does a given date count as active membership coverage? This is the
 * compound question: a date must BOTH fall within a paid coverage period
 * (a fact getMembershipPeriods() already establishes, untouched here) AND
 * the relationship's lifecycle status must have been "active" as of that
 * date. Pausing a membership means dates after the pause no longer count
 * as active coverage, even if a payment record's period technically still
 * spans them — the historical payment record itself is never altered;
 * this only changes how a date within it is *interpreted*.
 *
 * Moved here (WP-C1 Step 1) from relationship.js, unchanged. The name is
 * Membership-flavored ("MembershipCoverage") because that's still its only
 * real caller today — School's own as-of-date question ("is this the
 * current school") is answered directly by getRelationshipStatusAsOfDate
 * above, which is the actually domain-neutral primitive. This function is
 * kept as-is, not renamed, so the existing Membership call site and its
 * tests are untouched by this move.
 */
export function isDateActiveMembershipCoverage(date, statusHistory) {
  return getRelationshipStatusAsOfDate(statusHistory, date) === "active";
}
