// domain/person/personType.js
//
// The mockup shows Contact/Family/Colleague/Vendor as the Type buttons.
// The real stored values are contact/dependant/vendor/employee/tenant/
// other — and personType==="dependant" is read directly by live
// settlement logic (App.jsx's owes/spent_on default-mode split). This
// module is a DISPLAY mapping only — it never rewrites a person's stored
// personType as a side effect of merely viewing them. A stored value only
// changes when the user explicitly taps a Type button in Edit.

// UI label -> real stored value, per your explicit instruction:
// "Family -> existing dependant value... retaining the existing
// underlying values for compatibility."
export const UI_LABEL_TO_PERSON_TYPE = {
  Contact: "contact",
  Family: "dependant",
  Colleague: "employee", // closest existing value for a workplace relationship
  Vendor: "vendor",
};

export const PERSON_TYPE_TO_UI_LABEL = {
  contact: "Contact",
  dependant: "Family",
  vendor: "Vendor",
  employee: "Colleague",
  // "tenant" and "other" deliberately have NO entry here — see
  // getPersonTypeUILabel below. Forcing them into one of the four buttons
  // would silently misrepresent what's actually stored.
};

/**
 * @param {string} personType - the real stored value
 * @returns {string|null} the matching UI label, or null if this person's
 *   stored value doesn't correspond to any of the four buttons (tenant,
 *   other, or an unrecognized legacy value) — the caller should show the
 *   raw stored value as plain text in that case, not force a button
 *   selection that would misrepresent the actual data.
 */
export function getPersonTypeUILabel(personType) {
  return PERSON_TYPE_TO_UI_LABEL[personType] || null;
}

/**
 * @param {string} uiLabel - one of "Contact"/"Family"/"Colleague"/"Vendor"
 * @returns {string|null} the real stored value to write, or null if the
 *   label isn't recognized (caller should not write anything in that case)
 */
export function getPersonTypeFromUILabel(uiLabel) {
  return UI_LABEL_TO_PERSON_TYPE[uiLabel] || null;
}
