import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatReminderDate, addGroupReminder, updateGroupReminder, removeGroupReminder,
  getSortedGroupReminders, getGroupReminders, getGroupNotes,
} from "./reminders.js";

let n = 0;
const genId = () => `r${++n}`;
const group = { id: "g1", name: "Goa Household", members: ["p1"] };

test("dates show as day and month only", () => {
  assert.equal(formatReminderDate("2026-10-03", 2026), "3 Oct");
  assert.equal(formatReminderDate("2027-01-15", 2026), "15 Jan 2027");
  assert.equal(formatReminderDate("2026-02-30", 2026), "", "impossible date");
  assert.equal(formatReminderDate("", 2026), "");
});

test("add, edit and delete keep every other group field", () => {
  const a = addGroupReminder(group, { label: " Gas cylinder ", date: "2026-10-03" }, genId);
  assert.equal(a.name, "Goa Household");
  assert.deepEqual(a.members, ["p1"]);
  assert.deepEqual(getGroupReminders(a), [{ id: "r1", label: "Gas cylinder", date: "2026-10-03" }]);
  const b = updateGroupReminder(a, "r1", { label: "Gas refill", date: "2026-10-05" });
  assert.equal(b.reminders[0].label, "Gas refill");
  assert.equal(b.reminders[0].id, "r1");
  assert.deepEqual(removeGroupReminder(b, "r1").reminders, []);
  assert.equal(group.reminders, undefined, "input not mutated");
});

test("a reminder needs a label and a real date", () => {
  assert.throws(() => addGroupReminder(group, { label: "  ", date: "2026-10-03" }, genId), /label/);
  assert.throws(() => addGroupReminder(group, { label: "Gas", date: "3 Oct" }, genId), /date/);
  assert.throws(() => updateGroupReminder(group, "missing", { label: "Gas", date: "2026-10-03" }), /not found/);
});

test("sorted upcoming first, then past, each with its display text", () => {
  const g = { reminders: [
    { id: "a", label: "Water filter service", date: "2026-10-18" },
    { id: "b", label: "Gas cylinder", date: "2026-10-03" },
    { id: "c", label: "Pest control", date: "2026-09-01" },
    { id: "d", label: "Broken", date: "soon" },
  ] };
  const list = getSortedGroupReminders(g, "2026-09-26");
  assert.deepEqual(list.map(r => r.id), ["b", "a", "c"]);
  assert.equal(list[0].text, "Gas cylinder · 3 Oct");
  assert.equal(list[2].past, true);
});

test("notes are a plain optional string", () => {
  assert.deepEqual(getGroupNotes({ notes: "  Porvorim flat  " }), { hasValue: true, value: "Porvorim flat" });
  assert.deepEqual(getGroupNotes({}), { hasValue: false, value: "" });
});
