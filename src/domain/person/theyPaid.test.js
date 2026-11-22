import test from "node:test";
import assert from "node:assert/strict";
import { planTheyPaid } from "./theyPaid.js";

test("they paid part: my account covers the rest (they paid 400 of 1000 -> 600 mine)", () => {
  assert.deepEqual(planTheyPaid({ amount: 1000, rows: [{ personId: "r", amount: "400" }] }), { ok: true, myPart: 600, payers: [{ personId: "r", amount: 400 }] });
});

test("one row with no amount means they paid it all; my part is 0", () => {
  assert.deepEqual(planTheyPaid({ amount: 1000, rows: [{ personId: "r", amount: "" }] }), { ok: true, myPart: 0, payers: [{ personId: "r", amount: 1000 }] });
});

test("two payers add up; a blank amount with two rows is refused", () => {
  assert.deepEqual(planTheyPaid({ amount: 1000, rows: [{ personId: "r", amount: 300 }, { personId: "s", amount: 200 }] }).myPart, 500);
  assert.equal(planTheyPaid({ amount: 1000, rows: [{ personId: "r", amount: 300 }, { personId: "s" }] }).ok, false);
});

test("they cannot have paid more than the expense, and there must be an amount and a payer", () => {
  assert.equal(planTheyPaid({ amount: 1000, rows: [{ personId: "r", amount: 1200 }] }).ok, false);
  assert.equal(planTheyPaid({ amount: 0, rows: [{ personId: "r", amount: 5 }] }).ok, false);
  assert.equal(planTheyPaid({ amount: 1000, rows: [] }).ok, false);
});

test("pennies are rounded, not lost: 100.10 with 33.33 paid leaves 66.77", () => {
  assert.equal(planTheyPaid({ amount: 100.1, rows: [{ personId: "r", amount: 33.33 }] }).myPart, 66.77);
});
