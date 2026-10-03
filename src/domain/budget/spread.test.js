import { test } from "node:test";
import assert from "node:assert/strict";
import { spreadShares, createSpread, spreadInMonth, spreadMonths } from "./spread.js";

let n = 0; const genId = () => `s${++n}`;

test("PA14: ₹9,000 over 3 months is ₹3,000 a month", () => {
  assert.deepEqual(spreadShares(9000, 3), [3000, 3000, 3000]);
});

test("shares always add up exactly - the remainder goes to the last month", () => {
  const s = spreadShares(1000, 3);
  assert.deepEqual(s, [333.33, 333.33, 333.34]);
  assert.equal(Math.round(s.reduce((a, b) => a + b, 0) * 100) / 100, 1000);
  assert.deepEqual(spreadShares(24600, 12).reduce((a, b) => a + b, 0).toFixed(2), "24600.00");
});

test("a spread needs an amount, a sensible month count and a starting month", () => {
  assert.equal(createSpread({ amount: 0, startMonth: "2026-11", months: 3, genId }).ok, false);
  assert.equal(createSpread({ amount: 9000, startMonth: "2026-11", months: 0, genId }).ok, false);
  assert.equal(createSpread({ amount: 9000, startMonth: "2026-11", months: 61, genId }).ok, false);
  assert.equal(createSpread({ amount: 9000, startMonth: "", months: 3, genId }).ok, false);
  const r = createSpread({ key: "membership:m1", label: "Gym XYZ", amount: 9000, startMonth: "2026-11", months: 3, cashDate: "2026-11-15", genId });
  assert.equal(r.ok, true);
  assert.equal(r.spread.months, 3);
});

test("PA15: position of each month inside the spread, and nothing outside it", () => {
  const sp = createSpread({ amount: 9000, startMonth: "2026-11", months: 3, genId }).spread;
  assert.deepEqual(spreadInMonth(sp, "2026-11"), { index: 0, of: 3, share: 3000 });
  assert.deepEqual(spreadInMonth(sp, "2026-12"), { index: 1, of: 3, share: 3000 });
  assert.equal(spreadInMonth(sp, "2026-10"), null);
  assert.equal(spreadInMonth(sp, "2027-02"), null);
  // crosses a year boundary
  assert.equal(spreadInMonth(sp, "2027-01").index, 2);
  assert.deepEqual(spreadMonths(sp).map(m => m.monthKey), ["2026-11", "2026-12", "2027-01"]);
});
