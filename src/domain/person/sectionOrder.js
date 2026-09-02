// domain/person/sectionOrder.js
//
// Pure. Section order is stored per-person (person.sectionOrder, an array
// of section keys) — additive, absent-safe. A person with no stored order
// (every existing person, and any new one until they explicitly reorder)
// falls back to the exact default order matching the approved mockup.

export const DEFAULT_SECTION_ORDER = [
  "about",
  "financialPosition",
  "groups",
  "organisations",
  "activity",
  "capabilities",
  "reminders",
];

/**
 * @param {Object} person
 * @returns {Array<string>} the person's real stored order if present and
 *   valid, otherwise the default order — never throws, never returns a
 *   partial/corrupt list
 */
export function getSectionOrder(person) {
  const stored = person?.sectionOrder;
  if (!Array.isArray(stored) || stored.length === 0) return [...DEFAULT_SECTION_ORDER];

  // Defensive: a stored order missing a section (e.g. schema grew a new
  // section after the person last saved their order) still needs every
  // known section to appear — append anything missing, at the end, rather
  // than silently hiding a section the person never explicitly removed.
  const known = new Set(DEFAULT_SECTION_ORDER);
  const validStored = stored.filter(key => known.has(key));
  const missing = DEFAULT_SECTION_ORDER.filter(key => !validStored.includes(key));
  return [...validStored, ...missing];
}

/**
 * Move one section up or down in the order — returns a NEW order array,
 * never mutates the input. Out-of-range moves are no-ops (returns the
 * same order unchanged), never throws or wraps around.
 *
 * @param {Array<string>} order
 * @param {string} sectionKey
 * @param {"up"|"down"} direction
 * @returns {Array<string>}
 */
export function moveSection(order, sectionKey, direction) {
  const idx = order.indexOf(sectionKey);
  if (idx === -1) return order;
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= order.length) return order;

  const next = [...order];
  [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
  return next;
}
