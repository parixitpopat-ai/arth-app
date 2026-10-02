import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultLineAmount,
  validatePayFeesLineAmount,
  sumPayFeesTotal,
  toSettlementAllocations,
  validateExtraLine,
} from "./payFeesSelection.js";

const period = (over = {}) => ({
  id: "p1", obligationAmount: 12000, paidAmount: 6000, discountAmount: 0, writeOffAmount: 0,
  appliedCreditAmount: 0, startingStateDeclared: true, ...over,
});

test("defaultLineAmount is the full remaining balance", () => {
  assert.equal(defaultLineAmount(period()), 6000);
});

test("defaultLineAmount is 0 for an undeclared period", () => {
  assert.equal(defaultLineAmount(period({ startingStateDeclared: false })), 0);
});

test("validatePayFeesLineAmount accepts ₹1 up to the remaining balance", () => {
  assert.equal(validatePayFeesLineAmount(period(), 1), null);
  assert.equal(validatePayFeesLineAmount(period(), 6000), null);
});

test("validatePayFeesLineAmount rejects 0, negative, and over-the-remaining amounts", () => {
  assert.ok(validatePayFeesLineAmount(period(), 0));
  assert.ok(validatePayFeesLineAmount(period(), -5));
  assert.ok(validatePayFeesLineAmount(period(), 6001));
});

test("sumPayFeesTotal adds ticked lines and extra 'not listed' lines together", () => {
  const total = sumPayFeesTotal([{ amount: 18000 }, { amount: 6000 }], [{ amount: 1200 }]);
  assert.equal(total, 25200);
});

test("toSettlementAllocations drops zero/omitted lines, keeping only periodId+amount", () => {
  const out = toSettlementAllocations([{ periodId: "a", amount: 18000 }, { periodId: "b", amount: 0 }]);
  assert.deepEqual(out, [{ periodId: "a", amount: 18000 }]);
});

test("validateExtraLine requires both a name and a positive amount", () => {
  assert.ok(validateExtraLine("", 1200));
  assert.ok(validateExtraLine("Books", 0));
  assert.equal(validateExtraLine("Books", 1200), null);
});
