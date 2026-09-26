import { test } from "node:test";
import assert from "node:assert/strict";
import { getGroupDefaultIntent } from "./defaultIntent.js";

test("a stored defaultIntent always wins, whatever the type", () => {
  assert.equal(getGroupDefaultIntent({ typeId: "family", defaultIntent: "split" }), "split");
  assert.equal(getGroupDefaultIntent({ typeId: "trip", defaultIntent: "attributed" }), "attributed");
  assert.equal(getGroupDefaultIntent({ typeId: "other", defaultIntent: "manual" }), "manual");
});

test("legacy groups without defaultIntent keep the historical typeId fallback", () => {
  assert.equal(getGroupDefaultIntent({ typeId: "family" }), "attributed");
  assert.equal(getGroupDefaultIntent({ typeId: "business" }), "attributed");
  assert.equal(getGroupDefaultIntent({ typeId: "friends" }), "split");
  assert.equal(getGroupDefaultIntent({}), "split");
  assert.equal(getGroupDefaultIntent(null), "split");
});

test("editing a legacy group's type cannot change its intent when the pre-edit value is frozen", () => {
  // Edit Group writes getGroupDefaultIntent(groupBeforeEdit) onto the updated group.
  const before = { typeId: "family" };                 // effective: attributed
  const after = { ...before, typeId: "trip", defaultIntent: getGroupDefaultIntent(before) };
  assert.equal(getGroupDefaultIntent(after), "attributed");
});
