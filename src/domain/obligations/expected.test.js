import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasCompleteSchedule,
  setRelationshipSchedule,
  getExpectedForRelationship,
  getExpectedItems,
  buildBillFieldsFromExpected,
} from "./expected.js";

const active = (from = "2026-01-01") => [{ status: "active", effectiveDate: from, timestamp: 1 }];
const rel = (over = {}) => ({
  id: "r1", billerAccountId: "ba1", targetType: "person", targetId: "p1", personId: "p1",
  status: "active", statusHistory: active(), ...over,
});

// --- hasCompleteSchedule / setRelationshipSchedule --------------------------

test("setRelationshipSchedule rejects a missing amount, an unknown frequency, and an out-of-range dueDay", () => {
  const r = rel();
  assert.throws(() => setRelationshipSchedule(r, { frequency: "monthly", dueDay: 5 }));
  assert.throws(() => setRelationshipSchedule(r, { amount: 1500, frequency: "biweekly", dueDay: 5 }));
  assert.throws(() => setRelationshipSchedule(r, { amount: 1500, frequency: "monthly", dueDay: 32 }));
  assert.throws(() => setRelationshipSchedule(r, { amount: 1500, frequency: "monthly", dueDay: 5, billingMode: "sometimes" }));
});

test("setRelationshipSchedule defaults billDay to dueDay when not given separately, both fields end up set", () => {
  const r = setRelationshipSchedule(rel(), { amount: 1500, frequency: "monthly", dueDay: 5 });
  assert.equal(r.schedule.billDay, 5);
  assert.equal(r.schedule.dueDay, 5);
  assert.equal(r.billingMode, "regular");
  assert.equal(hasCompleteSchedule(r), true);
});

test("setRelationshipSchedule keeps a separately-given billDay", () => {
  const r = setRelationshipSchedule(rel(), { amount: 800, frequency: "monthly", dueDay: 20, billDay: 1 });
  assert.equal(r.schedule.billDay, 1);
  assert.equal(r.schedule.dueDay, 20);
});

test("hasCompleteSchedule is false for no schedule, and for a partial one — nothing is guessed", () => {
  assert.equal(hasCompleteSchedule(rel()), false);
  assert.equal(hasCompleteSchedule(rel({ schedule: { amount: 1500 } })), false);
  assert.equal(hasCompleteSchedule(rel({ schedule: { amount: 1500, frequency: "monthly" } })), false);
});

test("setRelationshipSchedule never mutates the input relationship", () => {
  const r = rel();
  const snapshot = JSON.parse(JSON.stringify(r));
  setRelationshipSchedule(r, { amount: 1500, frequency: "monthly", dueDay: 5 });
  assert.deepEqual(r, snapshot);
});

// --- getExpectedForRelationship: qualifying conditions (ADR-039 §3) ---------

test("no Expected without a schedule at all", () => {
  assert.equal(getExpectedForRelationship(rel(), [], new Date(2026, 8, 26)), null);
});

test("no Expected when billingMode is not \"regular\", even with a complete schedule", () => {
  const r = setRelationshipSchedule(rel(), { amount: 1500, frequency: "monthly", dueDay: 5 });
  r.billingMode = "none";
  assert.equal(getExpectedForRelationship(r, [], new Date(2026, 8, 26)), null);
});

test("no Expected when the relationship was not active as of refDate (paused/ended)", () => {
  const paused = setRelationshipSchedule(rel({
    statusHistory: [{ status: "active", effectiveDate: "2026-01-01", timestamp: 1 }, { status: "paused", effectiveDate: "2026-06-01", timestamp: 2 }],
  }), { amount: 1500, frequency: "monthly", dueDay: 5 });
  assert.equal(getExpectedForRelationship(paused, [], new Date(2026, 8, 26)), null);
});

test("no Expected before the relationship existed at all", () => {
  const r = setRelationshipSchedule(rel({ statusHistory: active("2026-06-01") }), { amount: 1500, frequency: "monthly", dueDay: 5 });
  assert.equal(getExpectedForRelationship(r, [], new Date(2026, 0, 1)), null);
});

// --- getExpectedForRelationship: the derived item ---------------------------

test("one Expected for a relationship with no Bills yet — the first upcoming dueDay", () => {
  const r = setRelationshipSchedule(rel(), { amount: 1500, frequency: "monthly", dueDay: 5 });
  const e = getExpectedForRelationship(r, [], new Date(2026, 8, 3)); // 3 Sep 2026, before the 5th
  assert.equal(e.dueDate, "2026-09-05");
  assert.equal(e.amount, 1500);
  assert.equal(e.billerAccountId, "ba1");
  assert.equal(e.targetType, "person");
  assert.equal(e.targetId, "p1");
});

test("if today is past this month's dueDay with no Bill yet, Expected rolls to next month", () => {
  const r = setRelationshipSchedule(rel(), { amount: 1500, frequency: "monthly", dueDay: 5 });
  const e = getExpectedForRelationship(r, [], new Date(2026, 8, 10)); // 10 Sep, past the 5th
  assert.equal(e.dueDate, "2026-10-05");
});

test("with an existing Bill, Expected is one cycle after it, not from today", () => {
  const r = setRelationshipSchedule(rel(), { amount: 1500, frequency: "monthly", dueDay: 5 });
  const bills = [{ billerAccountId: "ba1", forType: "person", forId: "p1", dueDate: "2026-08-05", status: "paid" }];
  const e = getExpectedForRelationship(r, bills, new Date(2026, 8, 6));
  assert.equal(e.dueDate, "2026-09-05");
});

test("dedup uses the LATEST Bill regardless of status, including cancelled (ADR-039 §5)", () => {
  const r = setRelationshipSchedule(rel(), { amount: 1500, frequency: "monthly", dueDay: 5 });
  const bills = [
    { billerAccountId: "ba1", forType: "person", forId: "p1", dueDate: "2026-07-05", status: "paid" },
    { billerAccountId: "ba1", forType: "person", forId: "p1", dueDate: "2026-08-05", status: "cancelled" },
  ];
  const e = getExpectedForRelationship(r, bills, new Date(2026, 8, 6));
  assert.equal(e.dueDate, "2026-09-05", "next cycle after the cancelled Bill, not the paid one before it");
});

test("a Bill belonging to a DIFFERENT relationship on the same Provider never counts — each relationship gets its own Expected", () => {
  const r = setRelationshipSchedule(rel({ id: "r1", targetType: "group", targetId: "g1" }), { amount: 2000, frequency: "monthly", dueDay: 10 });
  const billsForSomeoneElse = [{ billerAccountId: "ba1", forType: "person", forId: "p1", dueDate: "2026-09-10", status: "unpaid" }];
  const e = getExpectedForRelationship(r, billsForSomeoneElse, new Date(2026, 8, 1));
  assert.equal(e.dueDate, "2026-09-10", "unaffected by the other relationship's Bill");
});

test("quarterly/halfyearly/yearly frequencies step correctly", () => {
  const base = { amount: 1000, dueDay: 1 };
  assert.equal(getExpectedForRelationship(setRelationshipSchedule(rel(), { ...base, frequency: "quarterly" }), [{ billerAccountId: "ba1", forType: "person", forId: "p1", dueDate: "2026-01-01" }], new Date(2026, 0, 2)).dueDate, "2026-04-01");
  assert.equal(getExpectedForRelationship(setRelationshipSchedule(rel(), { ...base, frequency: "halfyearly" }), [{ billerAccountId: "ba1", forType: "person", forId: "p1", dueDate: "2026-01-01" }], new Date(2026, 0, 2)).dueDate, "2026-07-01");
  assert.equal(getExpectedForRelationship(setRelationshipSchedule(rel(), { ...base, frequency: "yearly" }), [{ billerAccountId: "ba1", forType: "person", forId: "p1", dueDate: "2026-01-01" }], new Date(2026, 0, 2)).dueDate, "2027-01-01");
});

test("a dueDay past the end of a short month clamps to that month's last day (e.g. 31 in February)", () => {
  const r = setRelationshipSchedule(rel(), { amount: 500, frequency: "monthly", dueDay: 31 });
  const bills = [{ billerAccountId: "ba1", forType: "person", forId: "p1", dueDate: "2026-01-31" }];
  const e = getExpectedForRelationship(r, bills, new Date(2026, 1, 1));
  assert.equal(e.dueDate, "2026-02-28");
});

// --- getExpectedItems --------------------------------------------------------

test("getExpectedItems returns one item per qualifying relationship, skipping the rest", () => {
  const withSchedule = setRelationshipSchedule(rel({ id: "r1" }), { amount: 1500, frequency: "monthly", dueDay: 5 });
  const noSchedule = rel({ id: "r2", billerAccountId: "ba2" });
  const items = getExpectedItems([withSchedule, noSchedule], [], new Date(2026, 8, 1));
  assert.deepEqual(items.map(i => i.relationshipId), ["r1"]);
});

// --- buildBillFieldsFromExpected: bill.fromSchedule -------------------------

test("buildBillFieldsFromExpected uses the schedule's amount by default, is unpaid and recurring", () => {
  const expected = { relationshipId: "r1", billerAccountId: "ba1", targetType: "person", targetId: "p1", amount: 1500, dueDate: "2026-10-05" };
  const fields = buildBillFieldsFromExpected(expected);
  assert.equal(fields.billerAccountId, "ba1");
  assert.equal(fields.amount, 1500);
  assert.equal(fields.dueDate, "2026-10-05");
  assert.equal(fields.status, "unpaid");
  assert.equal(fields.recurring, true);
});

test("buildBillFieldsFromExpected honours a different confirmed amount (\"Pay early\"/actual-differs-from-usual)", () => {
  const expected = { billerAccountId: "ba1", amount: 1500, dueDate: "2026-10-05" };
  const fields = buildBillFieldsFromExpected(expected, 1620);
  assert.equal(fields.amount, 1620);
});

test("buildBillFieldsFromExpected rejects a zero or missing expected item", () => {
  assert.throws(() => buildBillFieldsFromExpected(null));
  assert.throws(() => buildBillFieldsFromExpected({ billerAccountId: "ba1", amount: 0, dueDate: "2026-10-05" }));
});
