// domain/person/archive.js
//
// Person archive lifecycle. Per PPL-000's original decision (never
// implemented until now) and this session's own reference-type trace: a
// person can be referenced from at least eight independent live
// structures (transactions, bills, groups, membership x2, gifts, loans,
// biller attribution, plus the dormant school-relationship module) — hard
// delete has no safe, reference-free case in this codebase. Archive is
// the only correct lifecycle action.
//
// This module is deliberately trivial. Archiving a person touches nothing
// except the person's own `archived` flag — no transaction, bill, group,
// membership, gift, or loan record is read, written, or even inspected
// here. That's the entire point: preserving every reference means not
// touching them, not reconciling them.

/**
 * Archive a person — removes them from normal active-selection/listing
 * surfaces while preserving every reference to their id everywhere else
 * in the app. id is never touched.
 *
 * @param {Object} person - a people[] record
 * @returns {Object} a new object, `archived: true`, every other field
 *   byte-identical to the input
 */
export function archivePerson(person) {
  if (!person) throw new Error("archivePerson: a person record is required");
  return { ...person, archived: true };
}

/**
 * Restore an archived person to active status. Same invariant as
 * archivePerson — touches nothing but the flag itself.
 *
 * @param {Object} person
 * @returns {Object}
 */
export function unarchivePerson(person) {
  if (!person) throw new Error("unarchivePerson: a person record is required");
  return { ...person, archived: false };
}

/**
 * Is this person currently archived? Absence of the field (every person
 * record created before this WP) reads as active, not archived — no
 * migration needed for existing data.
 *
 * @param {Object} person
 * @returns {boolean}
 */
export function isPersonArchived(person) {
  return Boolean(person?.archived);
}

/**
 * The subset of people[] that should appear in normal active-selection
 * surfaces (add-to-group, transaction attribution pickers, etc.) — per
 * this WP's scope, wired into the main People list only. Full coverage
 * of every active-selection picker across the app is PPL-002 WP-6's own,
 * separately-scoped, hard-gated audit — not claimed as complete here.
 *
 * @param {Array} people
 * @returns {Array}
 */
export function getActivePeople(people) {
  return (people || []).filter(p => !isPersonArchived(p));
}

/**
 * The subset of people[] that are archived — for a future "view archived"
 * surface, restoration UI, or historical-resolution context. Not itself
 * wired into any UI by this WP.
 *
 * @param {Array} people
 * @returns {Array}
 */
export function getArchivedPeople(people) {
  return (people || []).filter(p => isPersonArchived(p));
}
