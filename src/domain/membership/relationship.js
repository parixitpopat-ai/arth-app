// domain/membership/relationship.js
//
// The persistent Membership relationship: Provider/Biller -> Person.
// This is a NEW, separate entity from the existing per-payment coverage
// records (still stored in memberships[], untouched by this file). The
// trace found the two are genuinely different things: a payment record
// describes what a specific payment bought; this entity describes the
// ongoing relationship that payments happen against, and carries the
// lifecycle (active/paused/ended) that relationship, not any one payment,
// owns.
//
// This module never touches memberships[], txns[], or getCommitments().
// It composes with lifecycle.js (unmodified) rather than duplicating its
// transition logic.

import { pauseMembership, resumeMembership, endMembership } from "./lifecycle.js";

/**
 * Create a new, active Membership relationship.
 * @param {object} params
 * @param {string} params.billerAccountId - the existing BillerAccount this relationship belongs to
 * @param {string} params.personId - "self" or a real person id
 * @param {string} params.startDate - date string, when the relationship began
 * @param {function} params.genId - id generator, injected (no internal fallback)
 * @throws {Error} if genId, billerAccountId, personId, or startDate is missing
 */
export function createMembershipRelationship({ billerAccountId, personId, startDate, genId }) {
  if (typeof genId !== "function") {
    throw new Error("createMembershipRelationship: genId is required");
  }
  if (!billerAccountId) throw new Error("createMembershipRelationship: billerAccountId is required");
  if (!personId) throw new Error("createMembershipRelationship: personId is required");
  if (!startDate) throw new Error("createMembershipRelationship: startDate is required");

  return {
    id: genId(),
    billerAccountId,
    personId,
    status: "active",
    statusHistory: [{ status: "active", effectiveDate: startDate, timestamp: Date.now() }],
    createdAt: Date.now(),
  };
}

export function pauseRelationship(relationship, reason, effectiveDate) {
  return pauseMembership(relationship, reason, effectiveDate);
}

export function resumeRelationship(relationship, effectiveDate) {
  return resumeMembership(relationship, effectiveDate);
}

export function endRelationship(relationship, reason, effectiveDate) {
  return endMembership(relationship, reason, effectiveDate);
}

/**
 * What was this relationship's status as of a given date? Walks
 * statusHistory and returns whichever entry's effectiveDate is the latest
 * one on or before `date`. If every entry is after `date` (asking about a
 * time before the relationship existed), returns null — not "active" by
 * default, since that would fabricate coverage that was never granted.
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
 */
export function isDateActiveMembershipCoverage(date, statusHistory) {
  return getRelationshipStatusAsOfDate(statusHistory, date) === "active";
}

/**
 * One-time, idempotent migration: existing memberships[] payment records
 * predate this entity and have no relationship to link to. For each
 * distinct (billerAccountId, personId) pair with at least one existing
 * payment record and no existing relationship, create exactly one new
 * relationship.
 *
 * The ONLY fact this fabricates nothing beyond: status is "active", and
 * effectiveDate is the EARLIEST known coverage-period start date across
 * that pair's payment records — the earliest genuinely known fact in the
 * data, not a guess. No pause/resume/end history is invented; a migrated
 * relationship's statusHistory has exactly one entry, the initial active
 * one, exactly as a real createMembershipRelationship() would produce for
 * a signup dated to that earliest known coverage start.
 *
 * Existing payment records are returned with a new membershipRelationshipId
 * field added, linking them to their (possibly newly-created) relationship.
 * Nothing else on a payment record is touched. Idempotent: a pair that
 * already has a relationship is left alone; running this twice on the same
 * input produces the same output.
 *
 * @param {Array} memberships - existing payment/coverage records
 * @param {Array} existingRelationships - relationships already created
 * @param {function} getMembershipPeriods - the existing, unmodified period-derivation function
 * @param {function} genId - id generator, injected
 * @returns {{ relationships: Array, updatedMemberships: Array }}
 */
export function migrateMembershipRelationships(memberships, existingRelationships, getMembershipPeriods, genId) {
  if (typeof genId !== "function") {
    throw new Error("migrateMembershipRelationships: genId is required");
  }
  const relationships = [...(existingRelationships || [])];
  const relationshipByPairKey = new Map(
    relationships.map(r => [`${r.billerAccountId}::${r.personId}`, r])
  );

  // First pass: for every pair with no existing relationship, find the
  // TRUE earliest known coverage start across ALL of that pair's payment
  // records — not just whichever record happens to appear first.
  const earliestByPairKey = new Map();
  for (const m of memberships) {
    const personId = m.personId || "self";
    const key = `${m.billerAccountId}::${personId}`;
    if (relationshipByPairKey.has(key)) continue;
    const periods = getMembershipPeriods(m) || [];
    const localEarliest = periods.map(p => p.from).filter(Boolean).sort()[0];
    if (!localEarliest) continue;
    const currentEarliest = earliestByPairKey.get(key);
    if (!currentEarliest || localEarliest < currentEarliest) {
      earliestByPairKey.set(key, localEarliest);
    }
  }

  for (const [key, earliestStart] of earliestByPairKey) {
    const [billerAccountId, personId] = key.split("::");
    const relationship = {
      id: genId(),
      billerAccountId,
      personId,
      status: "active",
      statusHistory: [{ status: "active", effectiveDate: earliestStart, timestamp: Date.now() }],
      createdAt: Date.now(),
    };
    relationships.push(relationship);
    relationshipByPairKey.set(key, relationship);
  }

  // Second pass: link every unlinked payment record to its (possibly
  // newly-created) relationship. Records with no derivable date at all
  // stay unlinked rather than getting a fabricated one.
  const updatedMemberships = memberships.map(m => {
    if (m.membershipRelationshipId) return m;
    const personId = m.personId || "self";
    const key = `${m.billerAccountId}::${personId}`;
    const relationship = relationshipByPairKey.get(key);
    if (!relationship) return m;
    return { ...m, membershipRelationshipId: relationship.id };
  });

  return { relationships, updatedMemberships };
}
