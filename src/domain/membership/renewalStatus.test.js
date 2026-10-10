import { test } from "node:test";
import assert from "node:assert/strict";
import { getMembershipRenewalStatus } from "./renewalStatus.js";

test("null when there's nothing with a derivable period", () => {
  assert.equal(getMembershipRenewalStatus([], "2026-09-27"), null);
  assert.equal(getMembershipRenewalStatus([{ m: { id: "m1" }, period: null }], "2026-09-27"), null);
});

test("null when the latest period is covered well beyond the forward window", () => {
  const status = getMembershipRenewalStatus([{ m: { id: "m1" }, period: { from: "2026-09-01", to: "2026-12-31" } }], "2026-09-27");
  assert.equal(status, null);
});

test("renewing: period ends within the forward window (not yet lapsed)", () => {
  const status = getMembershipRenewalStatus([{ m: { id: "m1" }, period: { from: "2026-07-01", to: "2026-09-30" } }], "2026-09-27");
  assert.equal(status.kind, "renewing");
  assert.equal(status.days, 3);
  assert.equal(status.m.id, "m1");
});

test("overdue: period already lapsed with no newer payment recorded (the previously-missing state)", () => {
  const status = getMembershipRenewalStatus([{ m: { id: "m1" }, period: { from: "2026-06-01", to: "2026-08-31" } }], "2026-09-27");
  assert.equal(status.kind, "overdue");
  assert.equal(status.days, 27);
});

test("grace days extend the effective end before it counts as overdue", () => {
  const status = getMembershipRenewalStatus([{ m: { id: "m1" }, period: { from: "2026-06-01", to: "2026-09-20", graceDays: 10 } }], "2026-09-27");
  assert.equal(status.kind, "renewing", "effective end (30 Sep) is still within the forward window, not lapsed");
});

test("only the latest-ending period across several payments decides the status", () => {
  const memberships = [
    { m: { id: "old" }, period: { from: "2026-01-01", to: "2026-03-31" } }, // long lapsed, superseded
    { m: { id: "current" }, period: { from: "2026-07-01", to: "2026-09-30" } },
  ];
  const status = getMembershipRenewalStatus(memberships, "2026-09-27");
  assert.equal(status.kind, "renewing");
  assert.equal(status.m.id, "current");
});

test("boundary: on the last covered day the membership is renewing with 0 days left, not overdue; overdue starts the next day", () => {
  const rows = [{ m: { id: "m1" }, period: { from: "2026-09-16", to: "2026-12-15", graceDays: 0 } }];
  assert.deepEqual(getMembershipRenewalStatus(rows, "2026-12-15", 7), { kind: "renewing", m: rows[0].m, days: 0 });
  assert.deepEqual(getMembershipRenewalStatus(rows, "2026-12-16", 7), { kind: "overdue", m: rows[0].m, days: 1 });
  assert.equal(getMembershipRenewalStatus(rows, "2026-12-07", 7), null);   // 8 days out: not yet
  assert.equal(getMembershipRenewalStatus(rows, "2026-12-08", 7).days, 7); // 7 days out
});

test("boundary: grace days move the last covered day, and the Outlook/reminder date together", () => {
  const rows = [{ m: { id: "m1" }, period: { from: "2026-06-01", to: "2026-08-31", graceDays: 15 } }];
  assert.equal(getMembershipRenewalStatus(rows, "2026-09-15", 7).kind, "renewing");
  assert.equal(getMembershipRenewalStatus(rows, "2026-09-16", 7).kind, "overdue");
});
