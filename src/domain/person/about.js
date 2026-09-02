// domain/person/about.js
//
// WP-1 (CORRECTED per the approved mockup — reverses the original WP-1
// behavior, per explicit instruction: "Empty values should follow the
// approved mockup, even if that requires correcting the previously
// shipped About behavior.")
//
// Original WP-1 omitted empty fields entirely. The approved mockup always
// shows all four core fields (phone/email/dob/anniversary), each either
// with its real value or an explicit "Not added" state — plus a X/4
// completeness badge that counts only those four (Notes is NOT part of
// the fraction, shown separately with its own "No notes yet." empty
// state). This file now matches the mockup exactly, not the original
// design.

const CORE_FIELD_DEFS = [
  { key: "phone", icon: "📱", label: "Phone" },
  { key: "email", icon: "✉️", label: "Email" },
  { key: "dob", icon: "🎂", label: "Date of birth" },
  { key: "anniversary", icon: "💍", label: "Anniversary" },
];

/**
 * @param {Object} person - a people[] record
 * @returns {Array<{key, icon, label, value, hasValue}>} always exactly 4
 *   entries, one per core field, in the mockup's fixed order. hasValue is
 *   false (and value is "") for any genuinely empty field — the caller
 *   renders "Not added" for those, never a fabricated value.
 */
export function getPersonAboutFields(person) {
  return CORE_FIELD_DEFS.map(def => {
    const raw = person?.[def.key];
    const hasValue = typeof raw === "string" && raw.trim().length > 0;
    return { ...def, value: hasValue ? raw : "", hasValue };
  });
}

/**
 * @param {Object} person
 * @returns {{filled:number, total:number}} the completeness count shown
 *   as "X/4" in the mockup — Notes is deliberately excluded from this
 *   count, per the mockup's own distinction between the 4 core fields and
 *   the separate Notes block.
 */
export function getAboutCompleteness(person) {
  const fields = getPersonAboutFields(person);
  return { filled: fields.filter(f => f.hasValue).length, total: fields.length };
}

/**
 * Notes is shown separately from the 4-field completeness count, with its
 * own real-value-or-empty-state, per the mockup.
 *
 * @param {Object} person
 * @returns {{value:string, hasValue:boolean}}
 */
export function getPersonNotes(person) {
  const raw = person?.notes;
  const hasValue = typeof raw === "string" && raw.trim().length > 0;
  return { value: hasValue ? raw : "", hasValue };
}

/**
 * Whether the About section has ANYTHING at all — used only to decide
 * whether to show the section header/badge at all for a brand-new person
 * with zero fields and zero notes. Per the mockup (Image 10), the section
 * still renders even when everything is empty (showing "Not added"/"No
 * notes yet." throughout) — so this is provided for completeness but is
 * not required to gate the section's visibility the way the original
 * WP-1 used it.
 *
 * @param {Object} person
 * @returns {boolean}
 */
export function hasAboutContent(person) {
  const { filled } = getAboutCompleteness(person);
  return filled > 0 || getPersonNotes(person).hasValue;
}

