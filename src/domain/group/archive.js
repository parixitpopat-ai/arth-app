// domain/group/archive.js
//
// Group archive lifecycle. Mirrors domain/person/archive.js exactly, for
// the same reason: a group is referenced from at least two independent
// live structures (transactions via t.groupId/t.groupAllocations[], bills
// via b.groupId) — hard delete has no safe, reference-free case here
// either. Archive is the correct lifecycle action for Group, matching
// Person.
//
// This module is deliberately trivial, same as Person's. Archiving a
// group touches nothing except the group's own `archived` flag — no
// transaction or bill record is read, written, or even inspected here.
// Any outstanding-balance check or write-off mutation required before a
// group can be archived is the caller's responsibility (PGRP-001 WP1),
// not this module's — keeping this module pure and reference-free is
// what makes it safe to call unconditionally once the caller has already
// decided archiving is appropriate.

/**
 * Archive a group — removes it from normal active-selection/listing
 * surfaces while preserving every reference to its id everywhere else in
 * the app (transactions, bills). id is never touched.
 *
 * @param {Object} group - a groups[] record
 * @returns {Object} a new object, `archived: true`, every other field
 *   byte-identical to the input
 */
export function archiveGroup(group) {
  if (!group) throw new Error("archiveGroup: a group record is required");
  return { ...group, archived: true };
}

/**
 * Restore an archived group to active status. Same invariant as
 * archiveGroup — touches nothing but the flag itself.
 *
 * @param {Object} group
 * @returns {Object}
 */
export function unarchiveGroup(group) {
  if (!group) throw new Error("unarchiveGroup: a group record is required");
  return { ...group, archived: false };
}

/**
 * Is this group currently archived? Absence of the field (every group
 * record created before this WP) reads as active, not archived — no
 * migration needed for existing data.
 *
 * @param {Object} group
 * @returns {boolean}
 */
export function isGroupArchived(group) {
  return Boolean(group?.archived);
}

/**
 * The subset of groups[] that should appear in normal active-selection
 * surfaces (the main Groups list, new-transaction/new-bill group pickers,
 * etc.) — per this WP's scope, wired into the main Groups list only. Full
 * coverage of every active-selection picker across the app (settlement
 * tagging, bill split, txn tagging, etc.) is not claimed as complete
 * here — same explicit boundary PPL-002 WP-6 drew for Person, not yet
 * re-run for Group.
 *
 * @param {Array} groups
 * @returns {Array}
 */
export function getActiveGroups(groups) {
  return (groups || []).filter(g => !isGroupArchived(g));
}

/**
 * The subset of groups[] that are archived — for a future "view archived"
 * surface, restoration UI, or historical-resolution context. Not itself
 * wired into any UI by this WP.
 *
 * @param {Array} groups
 * @returns {Array}
 */
export function getArchivedGroups(groups) {
  return (groups || []).filter(g => isGroupArchived(g));
}
