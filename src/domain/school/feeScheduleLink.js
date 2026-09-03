// domain/school/feeScheduleLink.js
//
// WP-C3 (ARTH-003), revised by PPL-006 WP-2 (2026-09-02) — connects the
// School Relationship foundation (domain/school/relationship.js) to the
// EXISTING School Fees domain (domain/schoolFees/*).
//
// THE CONNECTION (revised): a feeSchedule "belongs to" a School
// Relationship when feeSchedule.billerAccountId === relationship.billerAccountId
// — per PPL-006 Decision D/E/F, billerAccounts[].id is now the sole
// canonical School identity (relationship.js no longer has a separate
// schoolId; see PPL-006 WP-1). This replaces the original personId-only
// join, which is what caused the limitation below. This module still
// changes NOTHING about feeSchedule's shape — feeSchedule.billerAccountId
// already existed (domain/schoolFees/service.js's createSchoolFeeSchedule
// has always accepted it), it simply wasn't the join key before now. No
// new field is introduced anywhere by this change.
//
// LIMITATION RESOLVED, not just documented: the original version of this
// module could not distinguish which of a person's multiple School
// Relationships (e.g. after a school change) a given fee schedule belonged
// to, because personId alone is shared across all of a person's
// relationships. billerAccountId is unique per school/biller account, so
// joining on it resolves this directly — proven by this file's own test
// suite (feeScheduleLink.test.js), which previously asserted the ambiguity
// as expected behavior and now asserts the correct, disambiguated result.
//
// getPersonFeeSchedules and isFeeScheduleLinkedToPerson are UNCHANGED and
// deliberately still personId-based — they answer a genuinely different
// question ("all of this person's schedules, regardless of which school")
// than getFeeSchedulesForRelationship's per-relationship precision, and
// were never the source of the ambiguity this WP resolves. Do not conflate
// the two query shapes.
//
// CURRENT PRODUCTION STATE, confirmed by direct re-trace before writing
// this file: App.jsx's one call site (AddSchoolYearModal) still hardcodes
// both billerAccountId={null} and personId={null}. Every real feeSchedule
// in production today has both fields null, so every function in this
// module still correctly finds ZERO connections for real data until WP-3/4
// wire a real Person/biller-account picker into that modal — unaffected by
// this WP.

/**
 * Which of a person's existing fee schedules connect to a given School
 * Relationship, via the shared billerAccountId — the canonical School
 * identity (PPL-006). Unlike the original personId-only join, this
 * correctly distinguishes between two different relationships for the
 * same person (e.g. before and after a school change): each relationship
 * only connects to fee schedules sharing its own billerAccountId.
 *
 * @param {Object} relationship - a School Relationship record (domain/school/relationship.js)
 * @param {Array} feeSchedules - the existing feeSchedules[] collection, untouched
 * @returns {Array} the subset of feeSchedules whose billerAccountId matches
 *   the relationship's billerAccountId — a NEW array; feeSchedules itself
 *   and every individual schedule object are returned by reference, never
 *   copied or altered.
 */
export function getFeeSchedulesForRelationship(relationship, feeSchedules) {
  if (!relationship || !relationship.billerAccountId) return [];
  return (feeSchedules || []).filter(fs => fs && fs.billerAccountId === relationship.billerAccountId);
}

/**
 * Which of a collection of fee schedules belong to a given Person, by the
 * personId join — deliberately broader than getFeeSchedulesForRelationship:
 * this answers "all of this person's schedules across every school they've
 * ever had a relationship with," not "which schedule belongs to this one
 * relationship." Useful when a caller has a personId directly rather than
 * a full relationship record (e.g. a Person Overview screen listing every
 * fee schedule for a person regardless of which specific school it came
 * from). Unchanged by PPL-006 WP-2 — this was never the source of the
 * ambiguity that WP resolves.
 *
 * @param {string} personId
 * @param {Array} feeSchedules
 * @returns {Array}
 */
export function getPersonFeeSchedules(personId, feeSchedules) {
  if (!personId) return [];
  return (feeSchedules || []).filter(fs => fs && fs.personId === personId);
}

/**
 * Does a specific fee schedule belong to a specific person? The smallest
 * possible version of the same broader personId join — a single boolean
 * check, unchanged by PPL-006 WP-2 for the same reason as
 * getPersonFeeSchedules above.
 *
 * @param {Object} feeSchedule
 * @param {string} personId
 * @returns {boolean}
 */
export function isFeeScheduleLinkedToPerson(feeSchedule, personId) {
  return Boolean(feeSchedule && personId && feeSchedule.personId === personId);
}
