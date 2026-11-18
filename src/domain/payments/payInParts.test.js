import test from "node:test";
import assert from "node:assert/strict";
import { startParts, partsFromTxn, payPartsStatus, toPaymentLines } from "./payInParts.js";
import { expandPaymentLines } from "./paymentLineSlices.js";

test("₹500 paid as ₹100 + ₹400 is accepted, and the stored lines are read by the existing slice rule", () => {
  const lines = [{ accId: "cash", amount: "100" }, { accId: "bank", amount: "400" }];
  assert.equal(payPartsStatus(lines, 500).ok, true);
  const t = { id: 1, type: "expense", amount: 500, accId: "cash", paymentLines: toPaymentLines(lines) };
  assert.deepEqual(expandPaymentLines([t]).map(x => [x.accId, x.amount]), [["cash", 100], ["bank", 400]]);
});
test("it must add up exactly, and says how far off", () => {
  const s = payPartsStatus([{ accId: "a", amount: "100" }, { accId: "b", amount: "300" }], 500);
  assert.equal(s.ok, false); assert.equal(s.left, 100);
  assert.equal(payPartsStatus([{ accId: "a", amount: "300" }, { accId: "b", amount: "300" }], 500).left, -100);
});
test("every line needs an account and an amount, and there must be two", () => {
  assert.equal(payPartsStatus([{ accId: "a", amount: "500" }], 500).ok, false);
  assert.equal(payPartsStatus([{ accId: "a", amount: "500" }, { accId: "", amount: "0" }], 500).ok, false);
  assert.equal(payPartsStatus([{ accId: "a", amount: "250" }, { accId: "", amount: "250" }], 500).message, "Choose an account for every payment.");
  assert.equal(payPartsStatus(startParts("a"), 0).message, "Enter the amount first.");
});
test("decimals do not drift, and the same account may appear twice", () => {
  assert.equal(payPartsStatus([{ accId: "a", amount: "0.1" }, { accId: "a", amount: "0.2" }], 0.3).ok, true);
  assert.equal(payPartsStatus([{ accId: "a", amount: "1,000" }, { accId: "b", amount: "500.50" }], 1500.5).ok, true);
});
test("an existing transaction's lines come back as form lines; a plain one does not", () => {
  assert.deepEqual(partsFromTxn({ type: "expense", amount: 500, paymentLines: [{ accId: "a", amount: 100 }, { accId: "b", amount: 400 }] }), [{ accId: "a", amount: "100" }, { accId: "b", amount: "400" }]);
  assert.equal(partsFromTxn({ type: "expense", amount: 500, accId: "a" }), null);
  assert.equal(partsFromTxn({ type: "income", paymentLines: [{ accId: "a", amount: 1 }, { accId: "b", amount: 1 }] }), null);
});
