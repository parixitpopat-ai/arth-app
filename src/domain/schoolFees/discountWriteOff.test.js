import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDiscount, applyWriteOff } from "./discountWriteOff.js";
import { calculateOutstanding } from "./outstanding.js";

function makePeriod(overrides = {}) {
  return {
    id: "p1", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0,
    discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0,
    settlementLinks: [], ...overrides,
  };
}

test("rejects discounting/writing off a period that hasn't been declared yet (WP-3 gate)", () => {
  const period = makePeriod({ startingStateDeclared: false });
  assert.throws(() => applyDiscount(period, 500, "reason"), /has not been declared yet/);
  assert.throws(() => applyWriteOff(period, 500, "reason"), /has not been declared yet/);
});

test("locked example: outstanding 2,000 minus discount 500 leaves 1,500 outstanding", () => {
  const period = makePeriod({ obligationAmount: 2000 });
  const result = applyDiscount(period, 500, "School waived late fee");
  assert.equal(calculateOutstanding(result), 1500);
});

test("discount never touches paidAmount", () => {
  const period = makePeriod();
  const result = applyDiscount(period, 200, "Sibling discount");
  assert.equal(result.paidAmount, 0);
});

test("write-off never touches paidAmount", () => {
  const period = makePeriod();
  const result = applyWriteOff(period, 200, "Uncollectable");
  assert.equal(result.paidAmount, 0);
});

test("discount and write-off are independent — applying both is additive", () => {
  let period = makePeriod({ obligationAmount: 4500 });
  period = applyDiscount(period, 500, "Sibling discount");
  period = applyWriteOff(period, 300, "Partial waiver");
  assert.equal(period.discountAmount, 500);
  assert.equal(period.writeOffAmount, 300);
  assert.equal(calculateOutstanding(period), 3700);
});

test("records a reasoned audit entry, not just the aggregate number", () => {
  const period = makePeriod();
  const result = applyDiscount(period, 500, "School waived late fee");
  assert.equal(result.discountEntries.length, 1);
  assert.equal(result.discountEntries[0].amount, 500);
  assert.equal(result.discountEntries[0].reason, "School waived late fee");
});

test("rejects a discount/write-off with no reason", () => {
  const period = makePeriod();
  assert.throws(() => applyDiscount(period, 500, ""), /reason is required/);
  assert.throws(() => applyDiscount(period, 500, undefined), /reason is required/);
  assert.throws(() => applyWriteOff(period, 500, "   "), /reason is required/);
});

test("rejects an amount exceeding current outstanding — does not cap", () => {
  const period = makePeriod({ obligationAmount: 4500 });
  assert.throws(() => applyDiscount(period, 5000, "Too much"), /exceeds current outstanding/);
});

test("rejects exceeding outstanding cumulatively, not just against the original obligation", () => {
  let period = makePeriod({ obligationAmount: 4500 });
  period = applyDiscount(period, 4000, "Big discount"); // 500 left outstanding
  assert.throws(() => applyWriteOff(period, 1000, "Too much"), /exceeds current outstanding/);
});

test("rejects a zero or negative amount", () => {
  const period = makePeriod();
  assert.throws(() => applyDiscount(period, 0, "reason"), /positive number/);
  assert.throws(() => applyDiscount(period, -50, "reason"), /positive number/);
});

test("never mutates the input period", () => {
  const period = makePeriod();
  const snapshot = JSON.parse(JSON.stringify(period));
  applyDiscount(period, 500, "reason");
  assert.deepEqual(period, snapshot);
});
