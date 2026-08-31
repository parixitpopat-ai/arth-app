// domain/school/relationship.js
//
// The persistent School relationship: Person -> School. Built per WP-C2
// (ARTH-003), directly on top of WP-C1 Step 1's finding: lifecycle.js is
// already fully generic, so School gets its own persisted shape and its
// own thin module here, sharing lifecycle.js's create/end machinery
// without touching or knowing anything about membershipRelationships[].
//
// Deliberately separate from feeSchedule.personId (domain/schoolFees/
// service.js) — that field already exists on fee-schedule records,
// currently always null in production (per the SFE-000 trace), and this
// module does not read, write, or migrate it. Whether/how a School
// relationship's id should eventually connect to a fee schedule is an
// open question for a later work package, not resolved here.
//
// Only create + end are exposed — per RPP-002 §4/SFE-001 §2, School has no
// product need for pause/resume (a school relationship doesn't "pause,"
// it's either ongoing or it's ended because the child left). The
// underlying lifecycle.js still supports pause/resume if a future need
// ever arises; this module simply doesn't expose School-specific wrappers
// for them, keeping this WP's scope to exactly what's needed.
//
// School identity (name, and whatever else a School record eventually
// carries) is intentionally NOT built here. `schoolId` is treated as an
// opaque reference — this WP is the relationship/lifecycle foundation
// only, per the explicit scope boundary: "implement only the relationship
// foundation specified by ARTH-003," not a School entity or School Fees
// redesign.

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
 * @param {string} params.schoolId - opaque reference to a School record
 *   (School entity storage itself is out of scope for this WP)
 * @param {string} params.personId - the existing Person's id (PPL-000's
 *   real identity — "__me__" for self, or a real person id). This module
 *   never creates, edits, or archives a Person — it only references the
 *   id, exactly as Membership's relationship.js already does.
 * @param {string} params.startDate - date string, when the relationship began
 * @param {function} params.genId - id generator, injected (no internal fallback)
 * @throws {Error} if genId, schoolId, personId, or startDate is missing
 */
export function createSchoolRelationship({ schoolId, personId, startDate, genId }) {
  if (typeof genId !== "function") {
    throw new Error("createSchoolRelationship: genId is required");
  }
  if (!schoolId) throw new Error("createSchoolRelationship: schoolId is required");
  if (!personId) throw new Error("createSchoolRelationship: personId is required");
  if (!startDate) throw new Error("createSchoolRelationship: startDate is required");

  return {
    id: genId(),
    schoolId,
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
