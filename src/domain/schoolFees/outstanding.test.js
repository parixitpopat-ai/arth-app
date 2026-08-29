import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateOutstanding } from "./outstanding.js";

test("outstanding is the obligation minus every reduction, all four independently", () => {
  const period = { obligationAmount: 4500, paidAmount: 1000, discountAmount: 200, writeOffAmount: 100, appliedCreditAmount: 300 };
  assert.equal(calculateOutstanding(period), 2900);
});

test("outstanding is floored at 0, never negative", () => {
  const period = { obligationAmount: 4500, paidAmount: 4500, discountAmount: 100, writeOffAmount: 0, appliedCreditAmount: 0 };
  assert.equal(calculateOutstanding(period), 0);
});

test("missing fields default to 0 rather than throwing", () => {
  assert.equal(calculateOutstanding({ obligationAmount: 4500 }), 4500);
});
