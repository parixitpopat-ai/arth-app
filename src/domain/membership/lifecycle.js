// domain/membership/lifecycle.js
//
// Pure functions for Membership lifecycle status — Pause / Resume / End.
// No state, no side effects, no persistence, no interaction with Bills,
// School Fees, Insurance, Investments, Debt, or getCommitments().
//
// SCOPE NOTE: Membership currently has NO forward Future Money capability
// (confirmed in the earlier domain audit — every membership record is
// retrospective, created atomically with the transaction that paid for
// it; `status` exists on the record but is hardcoded to "active" and never
// set to anything else anywhere in the live app). Pause/Resume/End
// therefore has nothing to interact with on the Future Money side today —
// this module only manages the record's own lifecycle status. If/when
// Membership later gains a forward capability, Pause's effect on any
// future obligation is a separate, later decision, not addressed here.
//
// PROPOSED DEFAULT DECISIONS — documented here because this was
// fast-tracked rather than separately locked first, per the time-
// constrained execution mode. Flag any of these for correction:
// - Pause: status -> "paused". Valid only from "active". Requires a
//   reason. Temporary, resumable.
// - Resume: status -> "active". Valid only from "paused" — cannot resume
//   an "ended" membership (the assumption: a cancelled membership gets a
//   new signup, not an un-cancel, mirroring how most real subscriptions
//   work). No reason required — resuming isn't a decision that needs
//   justifying the way pausing or ending does.
// - End: status -> "ended". Valid from "active" OR "paused". Requires a
//   reason. Terminal — cannot be paused, resumed, or ended again.
// - Every transition is appended to statusHistory[] — an audit trail,
//   same pattern as School Fees' discountEntries/writeOffEntries — so
//   "why was this paused/ended" is never lost.

function assertReason(reason, label) {
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    throw new Error(`${label}: a reason is required`);
  }
}

function appendHistory(membership, action, reason) {
  const entry = { action, at: Date.now() };
  if (reason) entry.reason = reason;
  return [...(membership.statusHistory || []), entry];
}

/**
 * Pause an active membership.
 * @throws {Error} if not currently active, or reason is missing.
 */
export function pauseMembership(membership, reason) {
  if (!membership || typeof membership !== "object") {
    throw new Error("pauseMembership: a membership object is required");
  }
  const currentStatus = membership.status || "active";
  if (currentStatus === "ended") {
    throw new Error("pauseMembership: cannot pause an ended membership");
  }
  if (currentStatus === "paused") {
    throw new Error("pauseMembership: membership is already paused");
  }
  assertReason(reason, "pauseMembership");

  return {
    ...membership,
    status: "paused",
    statusHistory: appendHistory(membership, "paused", reason),
  };
}

/**
 * Resume a paused membership back to active.
 * @throws {Error} if not currently paused (including if already ended).
 */
export function resumeMembership(membership) {
  if (!membership || typeof membership !== "object") {
    throw new Error("resumeMembership: a membership object is required");
  }
  const currentStatus = membership.status || "active";
  if (currentStatus !== "paused") {
    throw new Error(`resumeMembership: can only resume a paused membership (current status: ${currentStatus})`);
  }

  return {
    ...membership,
    status: "active",
    statusHistory: appendHistory(membership, "resumed", null),
  };
}

/**
 * End a membership permanently (from active or paused).
 * @throws {Error} if already ended, or reason is missing.
 */
export function endMembership(membership, reason) {
  if (!membership || typeof membership !== "object") {
    throw new Error("endMembership: a membership object is required");
  }
  const currentStatus = membership.status || "active";
  if (currentStatus === "ended") {
    throw new Error("endMembership: membership is already ended");
  }
  assertReason(reason, "endMembership");

  return {
    ...membership,
    status: "ended",
    statusHistory: appendHistory(membership, "ended", reason),
  };
}
