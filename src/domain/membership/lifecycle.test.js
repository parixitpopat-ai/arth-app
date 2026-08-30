import { test } from "node:test";
import assert from "node:assert/strict";
import { pauseMembership, resumeMembership, endMembership } from "./lifecycle.js";

const active = () => ({ status: "active", statusHistory: [] });
const paused = () => ({ status: "paused", statusHistory: [{ status: "paused", effectiveDate: "2026-01-01", timestamp: 1 }] });
const ended = () => ({ status: "ended", statusHistory: [{ status: "ended", effectiveDate: "2026-01-01", timestamp: 1, reason: "cancelled" }] });

test("pauses an active membership, records reason and effective date", () => {
  const r = pauseMembership(active(), "Traveling abroad", "2026-08-15");
  assert.equal(r.status, "paused");
  assert.equal(r.statusHistory.length, 1);
  assert.equal(r.statusHistory[0].status, "paused");
  assert.equal(r.statusHistory[0].effectiveDate, "2026-08-15");
  assert.equal(r.statusHistory[0].reason, "Traveling abroad");
  assert.ok(typeof r.statusHistory[0].timestamp === "number");
});

test("treats a membership with no status field as active by default", () => {
  const r = pauseMembership({ statusHistory: [] }, "reason", "2026-08-15");
  assert.equal(r.status, "paused");
});

test("rejects pausing an already-paused membership", () => {
  assert.throws(() => pauseMembership(paused(), "reason", "2026-08-15"), /already paused/);
});

test("rejects pausing an ended membership", () => {
  assert.throws(() => pauseMembership(ended(), "reason", "2026-08-15"), /cannot pause an ended/);
});

test("rejects pausing with no reason", () => {
  assert.throws(() => pauseMembership(active(), "", "2026-08-15"), /reason is required/);
});

test("rejects pausing with no effective date", () => {
  assert.throws(() => pauseMembership(active(), "reason", ""), /effectiveDate/);
});

test("resumes a paused membership back to active", () => {
  const r = resumeMembership(paused(), "2026-09-01");
  assert.equal(r.status, "active");
  assert.equal(r.statusHistory.length, 2);
  assert.equal(r.statusHistory[1].status, "active");
  assert.equal(r.statusHistory[1].effectiveDate, "2026-09-01");
});

test("resume requires no reason", () => {
  const r = resumeMembership(paused(), "2026-09-01");
  assert.equal(r.statusHistory[1].reason, undefined);
});

test("resume requires an effective date", () => {
  assert.throws(() => resumeMembership(paused(), ""), /effectiveDate/);
});

test("rejects resuming a membership that isn't paused", () => {
  assert.throws(() => resumeMembership(active(), "2026-09-01"), /can only resume a paused/);
});

test("rejects resuming an ended membership — no un-cancel", () => {
  assert.throws(() => resumeMembership(ended(), "2026-09-01"), /can only resume a paused/);
});

test("ends an active membership", () => {
  const r = endMembership(active(), "Moved away", "2026-10-01");
  assert.equal(r.status, "ended");
  assert.equal(r.statusHistory[0].status, "ended");
  assert.equal(r.statusHistory[0].effectiveDate, "2026-10-01");
  assert.equal(r.statusHistory[0].reason, "Moved away");
});

test("ends a paused membership directly", () => {
  const r = endMembership(paused(), "No longer needed", "2026-10-01");
  assert.equal(r.status, "ended");
});

test("rejects ending an already-ended membership", () => {
  assert.throws(() => endMembership(ended(), "reason", "2026-10-01"), /already ended/);
});

test("rejects ending with no reason", () => {
  assert.throws(() => endMembership(active(), "", "2026-10-01"), /reason is required/);
});

test("rejects ending with no effective date", () => {
  assert.throws(() => endMembership(active(), "reason", ""), /effectiveDate/);
});

test("multiple transitions accumulate in statusHistory in order", () => {
  let m = active();
  m = pauseMembership(m, "r1", "2026-01-01");
  m = resumeMembership(m, "2026-02-01");
  m = pauseMembership(m, "r2", "2026-03-01");
  m = endMembership(m, "r3", "2026-04-01");
  assert.deepEqual(m.statusHistory.map(h => h.status), ["paused", "active", "paused", "ended"]);
  assert.equal(m.status, "ended");
});

test("never mutates the input entity object", () => {
  const m = active();
  const before = JSON.stringify(m);
  pauseMembership(m, "reason", "2026-08-15");
  assert.equal(JSON.stringify(m), before);
});

test("ended cannot pause", () => {
  assert.throws(() => pauseMembership(ended(), "reason", "2026-08-15"));
});

test("ended cannot resume", () => {
  assert.throws(() => resumeMembership(ended(), "2026-08-15"));
});

test("ended cannot end again", () => {
  assert.throws(() => endMembership(ended(), "reason", "2026-08-15"));
});
