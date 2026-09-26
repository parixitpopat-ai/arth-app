import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getPersonSplitDefault, getSplitShareMode, getNewSplitRowMode, getRowsNeedingSplitChoice,
  withSplitDefault, toStoredSplitDefault, getSplitDefaultChoice, getSplitDefaultLabel, isLegacySplitPerson,
} from "./splitDefault.js";

const legacyContact = { id: "p1", name: "Rohan", personType: "contact" };
const legacyFamily = { id: "p2", name: "Vyom", personType: "dependant" };
const newSkipped = { id: "p3", name: "Nidhi" };
const newIPay = { id: "p4", name: "Kokila", defaultSplit: "i_pay" };
const newTheyOwe = { id: "p5", name: "Sunita", defaultSplit: "they_owe" };

test("explicit default wins, even over a stored personType", () => {
  assert.equal(getPersonSplitDefault({ ...legacyFamily, defaultSplit: "they_owe" }), "they_owe");
  assert.equal(getSplitShareMode({ ...legacyFamily, defaultSplit: "they_owe" }), "owes");
  assert.equal(getNewSplitRowMode({ ...legacyContact, defaultSplit: "i_pay" }), "spent_on");
});

test("legacy people keep today's behaviour exactly", () => {
  assert.equal(getPersonSplitDefault(legacyContact), "legacy");
  assert.equal(getSplitShareMode(legacyContact), "owes");
  assert.equal(getSplitShareMode(legacyFamily), "spent_on");
  // Today a person row added to the form always starts on Collect.
  assert.equal(getNewSplitRowMode(legacyContact), "owes");
  assert.equal(getNewSplitRowMode(legacyFamily), "owes");
  assert.equal(isLegacySplitPerson(legacyFamily), true);
});

test("a new person who skipped is Ask each time", () => {
  assert.equal(getPersonSplitDefault(newSkipped), "ask");
  assert.equal(getNewSplitRowMode(newSkipped), null);
  // No per-person question exists in a group split, so the share is collected.
  assert.equal(getSplitShareMode(newSkipped), "owes");
  assert.equal(isLegacySplitPerson(newSkipped), false);
});

test("explicit new-person defaults map to split modes", () => {
  assert.equal(getNewSplitRowMode(newIPay), "spent_on");
  assert.equal(getSplitShareMode(newIPay), "spent_on");
  assert.equal(getNewSplitRowMode(newTheyOwe), "owes");
  assert.equal(getSplitShareMode(newTheyOwe), "owes");
});

test("an unknown stored value is ignored, never trusted", () => {
  assert.equal(getPersonSplitDefault({ name: "X", defaultSplit: "maybe" }), "ask");
  assert.equal(getPersonSplitDefault({ name: "X", defaultSplit: "maybe", personType: "contact" }), "legacy");
});

test("Ask each time is stored as no field (Option A)", () => {
  assert.equal(toStoredSplitDefault("ask"), undefined);
  const cleared = withSplitDefault(newIPay, "ask");
  assert.equal("defaultSplit" in cleared, false);
  assert.equal(withSplitDefault(newSkipped, "they_owe").defaultSplit, "they_owe");
  assert.equal(newSkipped.defaultSplit, undefined, "input not mutated");
});

test("a legacy person shows no highlighted choice, so saving Edit can't invent one", () => {
  assert.equal(getSplitDefaultChoice(legacyFamily), null);
  assert.equal(getSplitDefaultLabel(legacyFamily), "From their type");
  assert.equal(getSplitDefaultChoice(newSkipped), "ask");
  assert.equal(getSplitDefaultLabel(newTheyOwe), "They owe");
});

test("rows without a mode are the ones that still need a choice", () => {
  const rows = [
    { id: "r1", targetType: "person", targetId: "p3", mode: null },
    { id: "r2", targetType: "person", targetId: "p1", mode: "owes" },
    { id: "r3", targetType: "group", targetId: "g1", mode: null },
    { id: "r4", targetType: "person", targetId: "", mode: null },
  ];
  assert.deepEqual(getRowsNeedingSplitChoice(rows).map(r => r.id), ["r1"]);
  assert.deepEqual(getRowsNeedingSplitChoice(undefined), []);
});

test("an existing person can choose Ask each time; it is stored so their type stops deciding", () => {
  const asked = withSplitDefault(legacyFamily, "ask");
  assert.equal(asked.defaultSplit, "ask");
  assert.equal(getPersonSplitDefault(asked), "ask");
  assert.equal(getNewSplitRowMode(asked), null);
  assert.equal(getSplitDefaultChoice(asked), "ask");
  // New people still store nothing for Ask each time.
  assert.equal("defaultSplit" in withSplitDefault(newSkipped, "ask"), false);
});
