import { test } from "node:test";
import assert from "node:assert/strict";
import { getPersonAboutFields, getAboutCompleteness, getPersonNotes, hasAboutContent } from "./about.js";

// --- getPersonAboutFields: ALWAYS 4 entries, per the mockup ------------

test("always returns exactly 4 entries, even for a person with zero fields set — this is the corrected, mockup-accurate behavior", () => {
  const person = { id: "p1", name: "Ishita" }; // no phone/email/dob/anniversary at all
  const fields = getPersonAboutFields(person);
  assert.equal(fields.length, 4);
  assert.deepEqual(fields.map(f => f.key), ["phone", "email", "dob", "anniversary"]);
});

test("a set field returns its real value with hasValue:true", () => {
  const person = { id: "p1", phone: "9999999999" };
  const fields = getPersonAboutFields(person);
  const phone = fields.find(f => f.key === "phone");
  assert.equal(phone.value, "9999999999");
  assert.equal(phone.hasValue, true);
});

test("an unset field returns hasValue:false and an empty value — never a fabricated placeholder string", () => {
  const person = { id: "p1" };
  const fields = getPersonAboutFields(person);
  const email = fields.find(f => f.key === "email");
  assert.equal(email.hasValue, false);
  assert.equal(email.value, "");
});

test("a whitespace-only value is treated as unset", () => {
  const person = { id: "p1", phone: "   " };
  const fields = getPersonAboutFields(person);
  assert.equal(fields.find(f => f.key === "phone").hasValue, false);
});

test("mixed: some set, some not — each field independently correct", () => {
  const person = { id: "p1", phone: "1", email: "", dob: "2020-01-01", anniversary: null };
  const fields = getPersonAboutFields(person);
  assert.equal(fields.find(f => f.key === "phone").hasValue, true);
  assert.equal(fields.find(f => f.key === "email").hasValue, false);
  assert.equal(fields.find(f => f.key === "dob").hasValue, true);
  assert.equal(fields.find(f => f.key === "anniversary").hasValue, false);
});

test("null/undefined person still returns 4 entries, all empty, never throws", () => {
  assert.equal(getPersonAboutFields(null).length, 4);
  assert.equal(getPersonAboutFields(undefined).length, 4);
  assert.equal(getPersonAboutFields(null).every(f => !f.hasValue), true);
});

// --- getAboutCompleteness: X/4, Notes excluded --------------------------

test("completeness counts only the 4 core fields — Notes is excluded from the fraction, matching the mockup's '4/4' badge", () => {
  const person = { id: "p1", phone: "1", email: "e", dob: "2020-01-01", anniversary: "2020-01-01", notes: "irrelevant to this count" };
  const result = getAboutCompleteness(person);
  assert.deepEqual(result, { filled: 4, total: 4 });
});

test("partial completeness — 1/4, matching Image 10's example exactly", () => {
  const person = { id: "p1", phone: "9099998884" };
  const result = getAboutCompleteness(person);
  assert.deepEqual(result, { filled: 1, total: 4 });
});

test("zero fields set is 0/4", () => {
  assert.deepEqual(getAboutCompleteness({ id: "p1" }), { filled: 0, total: 4 });
});

// --- getPersonNotes: separate from the 4-field count --------------------

test("notes with real content returns hasValue:true and the real text", () => {
  const person = { id: "p1", notes: "Splits the Goa house rent with me." };
  const result = getPersonNotes(person);
  assert.equal(result.hasValue, true);
  assert.equal(result.value, "Splits the Goa house rent with me.");
});

test("notes with no content returns hasValue:false, empty value — caller shows 'No notes yet.'", () => {
  const result = getPersonNotes({ id: "p1" });
  assert.equal(result.hasValue, false);
  assert.equal(result.value, "");
});

test("whitespace-only notes treated as empty", () => {
  assert.equal(getPersonNotes({ id: "p1", notes: "   " }).hasValue, false);
});

// --- hasAboutContent ------------------------------------------------------

test("hasAboutContent is true if any of the 4 fields OR notes has real content", () => {
  assert.equal(hasAboutContent({ id: "p1", phone: "1" }), true);
  assert.equal(hasAboutContent({ id: "p1", notes: "something" }), true);
});

test("hasAboutContent is false only when everything — all 4 fields and notes — is genuinely empty", () => {
  assert.equal(hasAboutContent({ id: "p1" }), false);
  assert.equal(hasAboutContent(null), false);
});
