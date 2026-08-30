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
