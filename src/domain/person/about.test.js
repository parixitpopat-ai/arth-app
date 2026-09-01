import { test } from "node:test";
import assert from "node:assert/strict";
import { getPersonAboutFields, hasAboutContent } from "./about.js";

test("returns only fields with real, non-empty values", () => {
  const person = { id: "p1", name: "Vyom", phone: "9999999999", email: "", dob: "2016-05-12", anniversary: null, notes: undefined };
  const fields = getPersonAboutFields(person);
  assert.deepEqual(fields.map(f => f.key), ["phone", "dob"]);
});

test("a whitespace-only value is treated as empty, not shown", () => {
  const person = { id: "p1", notes: "   " };
  assert.deepEqual(getPersonAboutFields(person), []);
});

test("a person with none of the five fields set returns an empty array, not fabricated rows", () => {
  const person = { id: "p1", name: "Parth" }; // pre-existing record, no WP-2 fields at all
  assert.deepEqual(getPersonAboutFields(person), []);
});

test("every returned field carries the real stored value verbatim, plus its icon/label — never a placeholder", () => {
  const person = { id: "p1", email: "vyom@example.com" };
  const [field] = getPersonAboutFields(person);
  assert.equal(field.key, "email");
  assert.equal(field.value, "vyom@example.com");
  assert.equal(field.icon, "✉️");
  assert.equal(field.label, "Email");
});

test("all five fields present, all returned, in a stable order", () => {
  const person = { id: "p1", phone: "1", email: "e", dob: "2020-01-01", anniversary: "2020-02-02", notes: "n" };
  const fields = getPersonAboutFields(person);
  assert.deepEqual(fields.map(f => f.key), ["phone", "email", "dob", "anniversary", "notes"]);
});

test("null/undefined person handled gracefully, never throws", () => {
  assert.deepEqual(getPersonAboutFields(null), []);
  assert.deepEqual(getPersonAboutFields(undefined), []);
});

// --- hasAboutContent ---------------------------------------------------

test("hasAboutContent is true when at least one field is set", () => {
  assert.equal(hasAboutContent({ id: "p1", phone: "1" }), true);
});

test("hasAboutContent is false for a person with no About fields at all", () => {
  assert.equal(hasAboutContent({ id: "p1", name: "Parth" }), false);
});

test("hasAboutContent is false for null/undefined", () => {
  assert.equal(hasAboutContent(null), false);
  assert.equal(hasAboutContent(undefined), false);
});
