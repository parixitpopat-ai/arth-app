// domain/person/about.js
//
// WP-1 — pure adapter for the Person profile's About/Personal Details
// section. Reads only real, already-stored fields (phone/email/dob/
// anniversary/notes, added by WP-2) — never fabricates a value, never
// computes anything. A field with no real value is simply omitted from
// the output, not rendered as an empty row.

const FIELD_DEFS = [
  { key: "phone", icon: "📱", label: "Phone" },
  { key: "email", icon: "✉️", label: "Email" },
  { key: "dob", icon: "🎂", label: "Date of birth" },
  { key: "anniversary", icon: "💍", label: "Anniversary" },
  { key: "notes", icon: "📝", label: "Notes" },
];

/**
 * @param {Object} person - a people[] record
 * @returns {Array<{key, icon, label, value}>} only the fields that have a
 *   real, non-empty stored value — genuinely empty fields are omitted
 *   entirely, never shown as blank rows or fabricated placeholders.
 */
export function getPersonAboutFields(person) {
  if (!person) return [];
  return FIELD_DEFS
    .map(def => ({ ...def, value: person[def.key] }))
    .filter(f => typeof f.value === "string" && f.value.trim().length > 0);
}

/**
 * Whether the About section has anything at all to show — used to decide
 * whether the section itself should render (per RPP-002's "don't show
 * empty forms/cards" principle, already established for Contacts).
 *
 * @param {Object} person
 * @returns {boolean}
 */
export function hasAboutContent(person) {
  return getPersonAboutFields(person).length > 0;
}
