import { test } from "node:test";
import assert from "node:assert/strict";
import { groupFeePeriodsForDisplay } from "./periodGrouping.js";

const base = (over = {}) => ({
  id: over.id || "p1",
  label: "Oct – Dec 2026",
  periodStart: "2026-10-01",
  periodEnd: "2026-12-31",
  dueDate: "2026-10-10",
  obligationAmount: 18000,
  kind: "tuition",
  startingStateDeclared: true,
  paidAmount: 0,
  discountAmount: 0,
  writeOffAmount: 0,
  appliedCreditAmount: 0,
  settlementLinks: [],
  ...over,
});

test("groups periods sharing the same periodStart into one card", () => {
  const periods = [
    base({ id: "tuition", kind: "tuition", obligationAmount: 18000 }),
    base({ id: "transport", kind: "transport", obligationAmount: 12000, label: "Transport" }),
    base({ id: "uniform", kind: "uniform", obligationAmount: 3300, label: "Uniform" }),
  ];
  const { current } = groupFeePeriodsForDisplay(periods);
  assert.equal(current.length, 1);
  assert.equal(current[0].lines.length, 3);
  assert.equal(current[0].totalObligation, 33300);
});

test("a one-time fee with a different periodStart gets its own group", () => {
  const periods = [
    base({ id: "tuition", kind: "tuition" }),
    base({ id: "registration", kind: "registration", periodStart: "2026-04-01", periodEnd: "2027-03-31", label: "2026–27", obligationAmount: 8500 }),
  ];
  const { current } = groupFeePeriodsForDisplay(periods);
  assert.equal(current.length, 2);
});

test("tuition-kind line is always sorted first within a group", () => {
  const periods = [
    base({ id: "uniform", kind: "uniform", label: "Uniform" }),
    base({ id: "tuition", kind: "tuition", label: "Tuition" }),
  ];
  const { current } = groupFeePeriodsForDisplay(periods);
  assert.equal(current[0].lines[0].kind, "tuition");
});

test("never produces a Q# label — group label is always the real buildManualFeePeriods label", () => {
  const periods = [base({ label: "Oct – Dec 2026" })];
  const { current } = groupFeePeriodsForDisplay(periods);
  assert.equal(current[0].label, "Oct – Dec 2026");
  assert.ok(!/^Q\d/.test(current[0].label));
});

test("a fully-settled group (every line paid in full) moves to earlier, most recent first", () => {
  const periods = [
    base({ id: "paid-group", periodStart: "2026-04-01", paidAmount: 18000 }),
    base({ id: "unpaid-group", periodStart: "2026-10-01", paidAmount: 0 }),
    base({ id: "older-paid-group", periodStart: "2026-01-01", paidAmount: 18000 }),
  ];
  const { current, earlier } = groupFeePeriodsForDisplay(periods);
  assert.equal(current.length, 1);
  assert.equal(current[0].key, "2026-10-01");
  assert.equal(earlier.length, 2);
  assert.equal(earlier[0].key, "2026-04-01"); // most recently finished first
  assert.equal(earlier[1].key, "2026-01-01");
});

test("a group containing any undeclared line is never treated as settled, even if it has no outstanding", () => {
  const periods = [base({ startingStateDeclared: false, paidAmount: 0 })];
  const { current, earlier } = groupFeePeriodsForDisplay(periods);
  assert.equal(earlier.length, 0);
  assert.equal(current.length, 1);
  assert.equal(current[0].anyUndeclared, true);
});

test("totalOutstanding sums only declared lines, ignoring undeclared ones", () => {
  const periods = [
    base({ id: "declared", obligationAmount: 10000, paidAmount: 4000 }),
    base({ id: "undeclared", startingStateDeclared: false, obligationAmount: 5000 }),
  ];
  const { current } = groupFeePeriodsForDisplay(periods);
  assert.equal(current[0].totalOutstanding, 6000);
});

test("empty input returns empty current/earlier", () => {
  const { current, earlier } = groupFeePeriodsForDisplay([]);
  assert.deepEqual(current, []);
  assert.deepEqual(earlier, []);
});
