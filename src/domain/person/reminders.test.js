import { test } from "node:test";
import assert from "node:assert/strict";
import { getNextOccurrence, getPersonReminders } from "./reminders.js";

test("returns null when no date is stored — never fabricates a reminder", () => {
  assert.equal(getNextOccurrence(null, "2026-09-01"), null);
  assert.equal(getNextOccurrence(undefined, "2026-09-01"), null);
  assert.equal(getNextOccurrence("", "2026-09-01"), null);
});

test("returns null for an invalid date string rather than throwing or guessing", () => {
  assert.equal(getNextOccurrence("not-a-date", "2026-09-01"), null);
});

test("if the birthday hasn't happened yet this year, next occurrence is this year", () => {
  const result = getNextOccurrence("1991-03-14", "2026-01-10");
  assert.equal(result.nextDate, "2026-03-14");
  assert.equal(result.label, "14 Mar");
});

test("if the birthday already passed this year, next occurrence rolls to next year", () => {
  const result = getNextOccurrence("1991-03-14", "2026-09-01");
  assert.equal(result.nextDate, "2027-03-14");
});

test("if the birthday is today, next occurrence is today (daysAway 0), not pushed to next year", () => {
  const result = getNextOccurrence("1991-03-14", "2026-03-14");
  assert.equal(result.nextDate, "2026-03-14");
  assert.equal(result.daysAway, 0);
});

test("daysAway is computed correctly", () => {
  const result = getNextOccurrence("1991-01-10", "2026-01-01");
  assert.equal(result.daysAway, 9);
});

// --- getPersonReminders --------------------------------------------------

test("a person with both dob and anniversary gets both reminders", () => {
  const person = { dob: "1991-03-14", anniversary: "2019-12-02" };
  const reminders = getPersonReminders(person, "2026-09-01");
  assert.equal(reminders.length, 2);
  assert.deepEqual(reminders.map(r => r.type).sort(), ["anniversary", "birthday"]);
});

test("a person with only dob gets only a birthday reminder — never fabricates the missing one", () => {
  const person = { dob: "1991-03-14" };
  const reminders = getPersonReminders(person, "2026-09-01");
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].type, "birthday");
});

test("a person with neither date gets no reminders at all — not an error, a real empty state", () => {
  const person = { name: "Parth" };
  assert.deepEqual(getPersonReminders(person, "2026-09-01"), []);
});

test("null/undefined person handled gracefully", () => {
  assert.deepEqual(getPersonReminders(null, "2026-09-01"), []);
  assert.deepEqual(getPersonReminders(undefined, "2026-09-01"), []);
});
