// domain/school/feeScheduleLink.js
//
// WP-C3 (ARTH-003) — connects the School Relationship foundation (WP-C2,
// domain/school/relationship.js) to the EXISTING School Fees domain
// (domain/schoolFees/*), using the existing feeSchedule.personId field as
// the join point, per the explicit scope: "establish exactly how Person ->
// School Relationship -> existing School Fees should connect using the
// existing feeSchedule.personId hook."
//
// This module changes NOTHING about feeSchedule's shape. It does not add
// a field, does not touch domain/schoolFees/*.js, does not create a
// transaction, and does not read or write App.jsx's feeSchedules[] state
// directly — it's a pure function operating on whatever collections a
// caller passes in, same discipline as every other domain module in this
// codebase.
//
// THE CONNECTION: a feeSchedule "belongs to" a School Relationship when
// feeSchedule.personId === relationship.personId — the shared Person is
// the join key. This is the ONLY connection this WP establishes. School
// identity is NOT duplicated: feeSchedule keeps its existing schoolName
// string field exactly as-is; this module does not attempt to reconcile
// schoolName against relationship.schoolId, and does not add a schoolId
// (or schoolRelationshipId) field to feeSchedule. That reconciliation is
// explicitly out of scope here — see the REAL LIMITATION note below.
//
// REAL LIMITATION, discovered by this trace, not assumed away: feeSchedule
// has no field referencing WHICH school (or which specific relationship)
// it belongs to — only personId. If a Person has more than one School
// Relationship over time (a school change, WP-C2's own core scenario),
// filtering fee schedules by personId alone cannot distinguish which
// relationship/school a given schedule belongs to — every schedule for
// that person matches every one of their relationships equally. This is
// not a bug in this module; it's an honest structural gap between what
// exists today (feeSchedule.personId, feeSchedule.schoolName as a plain
// string) and what the full target chain (Person -> School Relationship ->
// Academic Year -> Fee Structure) eventually needs. Resolving it — most
// likely by giving a future Fee Structure record a real reference to its
// owning School Relationship, per RPP-002 §5/§10.1's Academic-Year-owns-
// the-year decision — is explicitly a LATER work package, not this one.
//
// CURRENT PRODUCTION STATE, confirmed by direct re-trace before writing
// this file: App.jsx's one call site (AddSchoolYearModal) still hardcodes
// personId={null}. This means, in production TODAY, every existing real
// feeSchedule has personId===null, and every function in this module will
// correctly find ZERO connections for real data until that changes — a
// separate, later WP (wiring a real Person picker into AddSchoolYearModal,
// per ARTH-003's own Phase E scoping), not this one.

/**
 * Which of a person's existing fee schedules connect to a given School
 * Relationship, via the shared personId join. Per the REAL LIMITATION
 * above, this cannot yet distinguish between two different relationships
 * for the same person — it returns every fee schedule for that person,
 * regardless of which school it was actually for.
 *
 * @param {Object} relationship - a School Relationship record (domain/school/relationship.js)
 * @param {Array} feeSchedules - the existing feeSchedules[] collection, untouched
 * @returns {Array} the subset of feeSchedules whose personId matches the
 *   relationship's personId — a NEW array; feeSchedules itself and every
 *   individual schedule object are returned by reference, never copied or
 *   altered.
 */
export function getFeeSchedulesForRelationship(relationship, feeSchedules) {
  if (!relationship || !relationship.personId) return [];
  return (feeSchedules || []).filter(fs => fs && fs.personId === relationship.personId);
}

/**
 * Which of a collection of fee schedules belong to a given Person, by the
 * same personId join — the more primitive version of the function above,
 * useful when a caller has a personId directly rather than a full
 * relationship record (e.g. a Person Overview screen listing all of a
 * person's fee schedules regardless of which specific school relationship
 * they came from).
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
 * possible version of the same join — a single boolean check.
 *
 * @param {Object} feeSchedule
 * @param {string} personId
 * @returns {boolean}
 */
export function isFeeScheduleLinkedToPerson(feeSchedule, personId) {
  return Boolean(feeSchedule && personId && feeSchedule.personId === personId);
}
