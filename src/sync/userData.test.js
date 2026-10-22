import { test } from "node:test";
import assert from "node:assert/strict";
import { hasUserData } from "./userData.js";

test("defaults alone are not user data; anything a person created is", () => {
  assert.equal(hasUserData(null), false);
  assert.equal(hasUserData({ txns: [], accounts: [{ id: "a" }], cats: [{ id: "c" }], people: [{ id: "__me__", isMe: true }], planNudges: {} }), false);
  for (const snap of [{ txns: [{ id: 1 }] }, { people: [{ id: "__me__" }, { id: "p1" }] }, { groups: [{ id: "g" }] },
    { planNudges: { "2026-11": { dismissedAtUsed: 1 } } }, { monthOverrides: { "2026-11": 60000 } }, { bills: [{ id: "b" }] }, { contributions: [{ id: "c" }] }, { vehicles: [{ id: "v" }] }]) {
    assert.equal(hasUserData(snap), true, JSON.stringify(snap));
  }
});

test("what a fresh install creates by itself is NOT user data (so a new device adopts the cloud instead of raising a conflict)", () => {
  // Observed on a real fresh install in the browser harness.
  const fresh = { accounts: [1, 2, 3, 4].map(i => ({ id: `a${i}` })), cats: [{ id: "c" }], people: [{ id: "__me__", isMe: true }], accountTypes: [{ id: "t" }], measureUnits: [{ id: "u" }], incomeTypes: ["salary"],
    billerAccounts: [{ id: "cc1" }, { id: "cc2" }], billers: [{ id: "b1" }], wealthSnapshots: [{ id: "w1" }], cardOrder: ["x"], planNudges: {}, monthOverrides: {} };
  assert.equal(hasUserData(fresh), false);
});
