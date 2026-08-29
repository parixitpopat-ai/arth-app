import { test } from "node:test";
import assert from "node:assert/strict";
import { pauseMembership, resumeMembership, endMembership } from "./lifecycle.js";

function makeMembership(overrides = {}) {
  return { id: "m1", billerAccountId: "ba1", amount: 1000, status: "active", ...overrides };
}

// --- pause ------------------------------------------------------------

test("pauses an active membership, records reason and history", () => {
  const m = makeMembership();
  const result = pauseMembership(m, "Traveling for 2 months");
  assert.equal(result.status, "paused");
  assert.equal(result.statusHistory.length, 1);
  assert.equal(result.statusHistory[0].action, "paused");
  assert.equal(result.statusHistory[0].reason, "Traveling for 2 months");
});

test("treats a membership with no status field as active by default", () => {
  const m = { id: "m1" }; // no status field at all
  const result = pauseMembership(m, "reason");
  assert.equal(result.status, "paused");
});

test("rejects pausing an already-paused membership", () => {
  const m = makeMembership({ status: "paused" });
  assert.throws(() => pauseMembership(m, "reason"), /already paused/);
});

test("rejects pausing an ended membership", () => {
  const m = makeMembership({ status: "ended" });
  assert.throws(() => pauseMembership(m, "reason"), /cannot pause an ended membership/);
});

test("rejects pausing with no reason", () => {
  const m = makeMembership();
  assert.throws(() => pauseMembership(m, ""), /reason is required/);
  assert.throws(() => pauseMembership(m, undefined), /reason is required/);
});

// --- resume -------------------------------------------------------------

test("resumes a paused membership back to active", () => {
  const m = makeMembership({ status: "paused" });
  const result = resumeMembership(m);
  assert.equal(result.status, "active");
  assert.equal(result.statusHistory[0].action, "resumed");
});

test("resume requires no reason", () => {
  const m = makeMembership({ status: "paused" });
  assert.doesNotThrow(() => resumeMembership(m));
});

test("rejects resuming a membership that isn't paused", () => {
  const active = makeMembership({ status: "active" });
  assert.throws(() => resumeMembership(active), /can only resume a paused membership/);
});

test("rejects resuming an ended membership — no un-cancel", () => {
  const ended = makeMembership({ status: "ended" });
  assert.throws(() => resumeMembership(ended), /can only resume a paused membership/);
});

// --- end ------------------------------------------------------------------

test("ends an active membership", () => {
  const m = makeMembership({ status: "active" });
  const result = endMembership(m, "Cancelled by user");
  assert.equal(result.status, "ended");
  assert.equal(result.statusHistory[0].reason, "Cancelled by user");
});

test("ends a paused membership directly", () => {
  const m = makeMembership({ status: "paused" });
  const result = endMembership(m, "No longer needed");
  assert.equal(result.status, "ended");
});

test("rejects ending an already-ended membership", () => {
  const m = makeMembership({ status: "ended" });
  assert.throws(() => endMembership(m, "reason"), /already ended/);
});

test("rejects ending with no reason", () => {
  const m = makeMembership();
  assert.throws(() => endMembership(m, ""), /reason is required/);
});

// --- history / immutability -----------------------------------------------

test("multiple transitions accumulate in statusHistory in order", () => {
  let m = makeMembership();
  m = pauseMembership(m, "vacation");
  m = resumeMembership(m);
  m = pauseMembership(m, "vacation again");
  m = endMembership(m, "moved away");
  assert.equal(m.statusHistory.length, 4);
  assert.deepEqual(m.statusHistory.map(h => h.action), ["paused", "resumed", "paused", "ended"]);
});

test("never mutates the input membership object", () => {
  const m = makeMembership();
  const snapshot = JSON.parse(JSON.stringify(m));
  pauseMembership(m, "reason");
  assert.deepEqual(m, snapshot);
});
