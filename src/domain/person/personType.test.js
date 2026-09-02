import { test } from "node:test";
import assert from "node:assert/strict";
import { getPersonTypeUILabel, getPersonTypeFromUILabel } from "./personType.js";

test("Family maps to the existing stored 'dependant' value, exactly per instruction", () => {
  assert.equal(getPersonTypeFromUILabel("Family"), "dependant");
  assert.equal(getPersonTypeUILabel("dependant"), "Family");
});

test("Contact and Vendor map straightforwardly", () => {
  assert.equal(getPersonTypeFromUILabel("Contact"), "contact");
  assert.equal(getPersonTypeUILabel("contact"), "Contact");
  assert.equal(getPersonTypeFromUILabel("Vendor"), "vendor");
  assert.equal(getPersonTypeUILabel("vendor"), "Vendor");
});

test("Colleague maps to 'employee' — the closest existing legacy value", () => {
  assert.equal(getPersonTypeFromUILabel("Colleague"), "employee");
  assert.equal(getPersonTypeUILabel("employee"), "Colleague");
});

test("'tenant' and 'other' — legacy values with NO UI-button equivalent — return null, never silently forced into a button", () => {
  assert.equal(getPersonTypeUILabel("tenant"), null);
  assert.equal(getPersonTypeUILabel("other"), null);
});

test("an unrecognized UI label returns null, never guesses a stored value", () => {
  assert.equal(getPersonTypeFromUILabel("SomethingNotAButton"), null);
});

test("round-trip: every UI-facing label maps to a stored value and back to the same label", () => {
  for (const label of ["Contact", "Family", "Colleague", "Vendor"]) {
    const stored = getPersonTypeFromUILabel(label);
    assert.equal(getPersonTypeUILabel(stored), label);
  }
});

test("this module never has any function that writes to a person record — display mapping only, no side effects", () => {
  const source = [getPersonTypeUILabel, getPersonTypeFromUILabel].map(fn => fn.toString()).join("\n");
  assert.equal(/setPeople|personType\s*=/.test(source), false);
});
