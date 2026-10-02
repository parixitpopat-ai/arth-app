import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLine, describeLine, reconcileLines, rateUnitsFor, defaultRateUnit } from "./itemLineMath.js";

const fmt = n => String(n);

test("total basis: the price typed is the line amount; unitPrice is amount/qty", () => {
  const l = computeLine({ basis: "total", qty: 500, unit: "g", price: 200 });
  assert.equal(l.amount, 200);
  assert.equal(l.unitPrice * 500, 200);
  assert.equal(describeLine({ basis: "total", qty: 500, unit: "g", price: 200 }, "₹", fmt), "500 g · ₹200 total = ₹200");
});

test("per-unit basis converts g<->kg: 500 g at ₹400/kg = ₹200", () => {
  const p = { basis: "unit", qty: 500, unit: "g", price: 400, rateUnit: "kg" };
  assert.equal(computeLine(p).amount, 200);
  assert.equal(describeLine(p, "₹", fmt), "500 g × ₹400/kg = ₹200");
  assert.ok(Math.abs(computeLine(p).unitPrice * 500 - 200) < 1e-9, "qty * stored unitPrice is still the amount");
});

test("per-unit basis converts ml<->ltr and same-unit quantities", () => {
  assert.equal(computeLine({ basis: "unit", qty: 250, unit: "ml", price: 80, rateUnit: "ltr" }).amount, 20);
  assert.equal(computeLine({ basis: "unit", qty: 2, unit: "kg", price: 400, rateUnit: "kg" }).amount, 800);
  assert.equal(computeLine({ basis: "unit", qty: 3, unit: "nos", price: 50 }).amount, 150);
  assert.equal(computeLine({ basis: "unit", qty: 2, unit: "kg", price: 0.4, rateUnit: "g" }).amount, 800);
});

test("unit families and defaults", () => {
  assert.deepEqual(rateUnitsFor("g").sort(), ["g", "kg"]);
  assert.deepEqual(rateUnitsFor("nos"), ["nos"]);
  assert.equal(defaultRateUnit("g"), "kg");
  assert.equal(defaultRateUnit("ml"), "ltr");
  assert.equal(defaultRateUnit("pkt"), "pkt");
});

test("no plausibility check: 500 pcs x ₹200 is simply calculated", () => {
  assert.equal(computeLine({ basis: "unit", qty: 500, unit: "nos", price: 200 }).amount, 100000);
});

test("reconcile: Save only when lines equal the transaction total; difference is signed", () => {
  assert.deepEqual(reconcileLines([200, 800], 1000), { matches: true, difference: 0, linesTotal: 1000 });
  const r = reconcileLines([200, 800], 1100);
  assert.equal(r.matches, false);
  assert.equal(r.difference, 100);
  assert.equal(reconcileLines([700, 800], 1000).difference, -500);
  assert.equal(reconcileLines([0.1, 0.2], 0.3).matches, true, "floating point noise is not a mismatch");
});
