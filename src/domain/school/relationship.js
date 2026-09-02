// domain/school/relationship.js
//
// The persistent School relationship: Person -> School. Built per WP-C2
// (ARTH-003), directly on top of WP-C1 Step 1's finding: lifecycle.js is
// already fully generic, so School gets its own persisted shape and its
// own thin module here, sharing lifecycle.js's create/end machinery
// without touching or knowing anything about membershipRelationships[].
//
// PPL-006 (2026-09-02) — School identity revision: this module previously
// used a standalone, opaque `schoolId` field. Per PPL-006 Decision D/E/F,
// School has no separate School entity and never will — the identity of
// "which school" is the same `billerAccounts[].id` every other biller-based
// domain already uses. This module now takes `billerAccountId` in exactly
// the shape membershipRelationships already does
// (domain/membership/relationship.js's createMembershipRelationship), so
// School converges onto the same canonical pattern rather than remaining a
// one-off. `schoolId` is retired, not renamed-in-place-and-kept — a second
// parallel identity field would recreate the exact reconciliation problem
// this change exists to remove (see feeScheduleLink.js's own documented
// limitation, which this directly resolves).
//
// Still deliberately separate from feeSchedule.personId
// (domain/schoolFees/service.js) as its own storage — this module does not
// read, write, or migrate feeSchedules directly. feeScheduleLink.js is the
// join layer; PPL-006 WP-2 updates it to join on billerAccountId (now that
// one exists here) instead of personId alone.
//
// Only create + end are exposed — per RPP-002 §4/SFE-001 §2, School has no
// product need for pause/resume (a school relationship doesn't "pause,"
// it's either ongoing or it's ended because the child left). The
// underlying lifecycle.js still supports pause/resume if a future need
// ever arises; this module simply doesn't expose School-specific wrappers
// for them, keeping this WP's scope to exactly what's needed.

import { endMembership, getRelationshipStatusAsOfDate } from "../membership/lifecycle.js";

/**
 * Create a new, active School relationship for a Person.
 *
 * Same school across multiple academic years = ONE continuous
 * relationship — this function is called once, at enrollment. Nothing in
 * this module ties a relationship to a single year; Academic Year is a
 * separate, later concept (not built here) that will reference a
 * relationship's id, not the other way around.
 *
 * @param {object} params
 * @param {string} params.billerAccountId - the biller account (type
 *   "School Fees") that IS this school's identity — same role
 *   billerAccountId plays in createMembershipRelationship. Not a School
 *   entity id; there is no separate School entity.
 * @param {string} params.personId - the existing Person's id (PPL-000's
 *   real identity — "__me__" for self, or a real person id). This module
 *   never creates, edits, or archives a Person — it only references the
 *   id, exactly as Membership's relationship.js already does.
 * @param {string} params.startDate - date string, when the relationship began
 * @param {function} params.genId - id generator, injected (no internal fallback)
 * @throws {Error} if genId, billerAccountId, personId, or startDate is missing
 */
export function createSchoolRelationship({ billerAccountId, personId, startDate, genId }) {
  if (typeof genId !== "function") {
    throw new Error("createSchoolRelationship: genId is required");
  }
  if (!billerAccountId) throw new Error("createSchoolRelationship: billerAccountId is required");
  if (!personId) throw new Error("createSchoolRelationship: personId is required");
  if (!startDate) throw new Error("createSchoolRelationship: startDate is required");

  return {
    id: genId(),
    billerAccountId,
    personId,
    status: "active",
    statusHistory: [{ status: "active", effectiveDate: startDate, timestamp: Date.now() }],
    createdAt: Date.now(),
  };
}

/**
 * End a School relationship — used both when a child genuinely leaves a
 * school, and as the first half of a school change (end old, then
 * createSchoolRelationship a genuinely new one for the new school — never
 * edit schoolId on an existing relationship; RPP-002 §2/§17, SFE-001 §2).
 *
 * A thin pass-through to lifecycle.js's endMembership, exactly like
 * Membership's own endRelationship — no School-specific transition logic
 * exists or is needed.
 */
export function endSchoolRelationship(relationship, reason, effectiveDate) {
  return endMembership(relationship, reason, effectiveDate);
}

/**
 * Is this relationship the CURRENT school as of a given date? Reuses
 * lifecycle.js's getRelationshipStatusAsOfDate directly (no reimplementation)
 * — "current" means the relationship's status was "active" as of that date.
 *
 * @param {Array} statusHistory - a School relationship's statusHistory[]
 * @param {string} date - date string to check
 * @returns {boolean}
 */
export function isSchoolRelationshipCurrent(statusHistory, date) {
  return getRelationshipStatusAsOfDate(statusHistory, date) === "active";
}

/**
 * Among a Person's School relationships, find the one that's current as of
 * a given date — the read primitive "current vs. historical school"
 * (RPP-002 §5, SFE-001 §2) needs. Returns null if none is current (the
 * child has no active school relationship as of that date — a real,
 * legitimate state, not an error).
 *
 * Does not assume a person has only one relationship ever — correctly
 * distinguishes an ended relationship (a past school) from an active one
 * (the current school), even when both exist in the same collection.
 *
 * @param {Array} relationships - schoolRelationships[], any mix of people/schools
 * @param {string} personId
 * @param {string} date - date string, defaults to comparing against every
 *   relationship's own statusHistory as of this date
 * @returns {Object|null} the current relationship record, or null
 */
export function getCurrentSchoolRelationship(relationships, personId, date) {
  const mine = (relationships || []).filter(r => r.personId === personId);
  return mine.find(r => isSchoolRelationshipCurrent(r.statusHistory, date)) || null;
}

/**
 * Every relationship for a Person that is NOT current as of the given
 * date — i.e. ended (or, in principle, not-yet-started, though School
 * relationships are always created with an immediate startDate today).
 * This is "School History" (RPP-002 §1/§5) — past schools, still fully
 * resolvable, never deleted.
 *
 * @returns {Array} relationships, in no particular guaranteed order
 */
export function getHistoricalSchoolRelationships(relationships, personId, date) {
  const mine = (relationships || []).filter(r => r.personId === personId);
  return mine.filter(r => !isSchoolRelationshipCurrent(r.statusHistory, date));
}
