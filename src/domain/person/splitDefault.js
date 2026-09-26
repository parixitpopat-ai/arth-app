// domain/person/splitDefault.js
//
// UI-2C D-4 / P-3 Option A — a person's default expense split.
//
// Stored as the optional `defaultSplit` field on a person:
//   "i_pay"    → I pay for them (split mode "spent_on", nothing to collect)
//   "they_owe" → they owe me their share (split mode "owes")
//   (absent)   → no explicit default
//
// With no explicit default, what happens depends on whether the person is a
// legacy record. People created before this field existed always carry a
// stored `personType` (contact/dependant/…); the one-screen Add Person no
// longer writes one. So:
//   explicit default      → use it
//   has a personType      → exactly today's behaviour (legacy fallback)
//   neither               → "ask": the form asks each time
//
// Skipping the P-3 question stores nothing, so a new person is "ask".

export const SPLIT_DEFAULT_I_PAY = "i_pay";
export const SPLIT_DEFAULT_THEY_OWE = "they_owe";
export const SPLIT_DEFAULT_ASK = "ask";

export const SPLIT_DEFAULT_OPTIONS = [
  { id: SPLIT_DEFAULT_I_PAY, label: "I pay" },
  { id: SPLIT_DEFAULT_THEY_OWE, label: "They owe" },
  { id: SPLIT_DEFAULT_ASK, label: "Ask each time" },
];

const EXPLICIT = new Set([SPLIT_DEFAULT_I_PAY, SPLIT_DEFAULT_THEY_OWE]);

export function isLegacySplitPerson(person) {
  return Boolean(person && !EXPLICIT.has(person.defaultSplit) && person.personType);
}

/** "i_pay" | "they_owe" | "ask" | "legacy" — what the person record says. */
export function getPersonSplitDefault(person) {
  if (person && EXPLICIT.has(person.defaultSplit)) return person.defaultSplit;
  if (isLegacySplitPerson(person)) return "legacy";
  return SPLIT_DEFAULT_ASK;
}

/**
 * The value to store when the user picks an option. "Ask each time" is
 * stored as no field at all (Option A), so it returns undefined.
 */
export function toStoredSplitDefault(choice) {
  return EXPLICIT.has(choice) ? choice : undefined;
}

/** Returns a copy of the person with defaultSplit set, or removed for "ask". */
export function withSplitDefault(person, choice) {
  const next = { ...person };
  const stored = toStoredSplitDefault(choice);
  if (stored) next.defaultSplit = stored;
  else delete next.defaultSplit;
  return next;
}

/**
 * Mode for a share that the form gives no per-person choice for (Split
 * with a group, Bill split). Legacy people keep today's rule:
 * Family ("dependant") → spent_on, everyone else → owes.
 * An "ask" person has no question to answer here, so the share is
 * collected ("owes"), the same as today's default for a non-Family person.
 */
export function getSplitShareMode(person) {
  const d = getPersonSplitDefault(person);
  if (d === SPLIT_DEFAULT_I_PAY) return "spent_on";
  if (d === SPLIT_DEFAULT_THEY_OWE) return "owes";
  if (d === "legacy") return person.personType !== "dependant" ? "owes" : "spent_on";
  return "owes";
}

/**
 * Starting mode for a person row added to the expense form, where the
 * row has its own A / O / C choice. Legacy people start on "owes", exactly
 * as today. An "ask" person starts with nothing selected (null) and the
 * form asks before saving.
 */
export function getNewSplitRowMode(person) {
  const d = getPersonSplitDefault(person);
  if (d === SPLIT_DEFAULT_I_PAY) return "spent_on";
  if (d === SPLIT_DEFAULT_THEY_OWE) return "owes";
  if (d === "legacy") return "owes";
  return null;
}

/** Person rows in the expense form that still need a split choice. */
export function getRowsNeedingSplitChoice(rows) {
  return (rows || []).filter(r => r && r.targetType === "person" && r.targetId && !r.mode);
}

/**
 * Option id to highlight for the current setting. A legacy person has not
 * chosen one, so nothing is highlighted: viewing or saving Edit must not
 * turn today's type-based behaviour into a stored choice.
 */
export function getSplitDefaultChoice(person) {
  const d = getPersonSplitDefault(person);
  return d === "legacy" ? null : d;
}

/** Short summary for tiles and settings rows. */
export function getSplitDefaultLabel(person) {
  const d = getPersonSplitDefault(person);
  if (d === "legacy") return "From their type";
  return SPLIT_DEFAULT_OPTIONS.find(o => o.id === d)?.label || "Ask each time";
}
