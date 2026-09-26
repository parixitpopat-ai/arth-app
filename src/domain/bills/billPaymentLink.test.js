import { test } from "node:test";
import assert from "node:assert/strict";
import { nextBillMatchChoice, getBillChoicesToShow, getBillLinkAmountMismatch, mergePaymentIntoExistingBill } from "./billPaymentLink.js";

test("auto-selects the closest candidate only while nothing is chosen", () => {
  assert.equal(nextBillMatchChoice("", ["b1", "b2"], ["b1", "b2"]), "b1");
  assert.equal(nextBillMatchChoice("", [], ["b1"]), "");
});

test("a chosen bill survives amount/category/date edits that empty or change the candidates (the bug)", () => {
  assert.equal(nextBillMatchChoice("b1", [], ["b1", "b2"]), "b1");
  assert.equal(nextBillMatchChoice("b1", ["b2"], ["b1", "b2"]), "b1");
});

test("an explicit 'Not these — new bill' is never overridden", () => {
  assert.equal(nextBillMatchChoice("__new__", ["b1"], ["b1"]), "__new__");
});

test("a chosen bill that was deleted falls back to auto-selection", () => {
  assert.equal(nextBillMatchChoice("gone", ["b2"], ["b2"]), "b2");
  assert.equal(nextBillMatchChoice("gone", [], ["b2"]), "");
});

test("ids compare as strings", () => {
  assert.equal(nextBillMatchChoice(17, [], ["17"]), 17);
});

test("the chosen bill stays visible even when it is no longer a candidate", () => {
  const b1 = { id: "b1" }, b2 = { id: "b2" };
  assert.deepEqual(getBillChoicesToShow([b2], b1), [b1, b2]);
  assert.deepEqual(getBillChoicesToShow([b1, b2], b1), [b1, b2]);
  assert.deepEqual(getBillChoicesToShow([b2], null), [b2]);
});

test("amount mismatch is reported; equal amounts and no bill are not", () => {
  assert.deepEqual(getBillLinkAmountMismatch({ amount: 3800 }, 3500), { billAmount: 3800, paymentAmount: 3500 });
  assert.equal(getBillLinkAmountMismatch({ amount: 3800 }, 3800), null);
  assert.equal(getBillLinkAmountMismatch({ amount: 3800 }, "3800"), null);
  assert.equal(getBillLinkAmountMismatch(null, 10), null);
  assert.equal(getBillLinkAmountMismatch({ amount: 0 }, 10), null); // bill with no amount: nothing to compare
});

test("paying an existing bill never rewrites its amount or due date", () => {
  const existing = { id: "b1", amount: 699, dueDate: "2026-10-05", status: "unpaid", name: "Jio" };
  const payment = { id: "b1", amount: 699, dueDate: "2026-10-03", status: "paid", paidDate: "2026-10-03", paidByTxnId: 5 };
  const merged = mergePaymentIntoExistingBill(existing, payment);
  assert.equal(merged.dueDate, "2026-10-05");
  assert.equal(merged.amount, 699);
  assert.equal(merged.status, "paid");
  assert.equal(merged.paidByTxnId, 5);
});

test("an existing bill with no due date takes the payment's date, as before", () => {
  const merged = mergePaymentIntoExistingBill({ id: "b1", amount: 10 }, { id: "b1", dueDate: "2026-10-03" });
  assert.equal(merged.dueDate, "2026-10-03");
});
