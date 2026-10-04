import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldDebitOnLoanGiven, buildLoanDisbursalTxn } from "./disbursal.js";

test("a new loan given from a chosen account debits it", () => {
  assert.equal(shouldDebitOnLoanGiven({ direction: "given", isEditing: false, lentFromAccId: "bank1", principal: "5000" }), true);
});

test("no account chosen, editing an existing loan, a loan taken, or a zero amount never debit", () => {
  const base = { direction: "given", isEditing: false, lentFromAccId: "bank1", principal: 5000 };
  assert.equal(shouldDebitOnLoanGiven({ ...base, lentFromAccId: "" }), false);
  assert.equal(shouldDebitOnLoanGiven({ ...base, isEditing: true }), false);
  assert.equal(shouldDebitOnLoanGiven({ ...base, direction: "taken" }), false);
  assert.equal(shouldDebitOnLoanGiven({ ...base, principal: 0 }), false);
  assert.equal(shouldDebitOnLoanGiven({ ...base, principal: "" }), false);
});

test("the entry is a transfer out of the source account with no destination, linked to the loan", () => {
  const t = buildLoanDisbursalTxn({ loanId: "L1", personName: "Raj", fromAccId: "bank1", amount: 5000, date: "2026-10-04", now: 1 });
  assert.equal(t.type, "transfer");
  assert.equal(t.fromAccId, "bank1");
  assert.equal(t.toAccId, null);
  assert.equal(t.amount, 5000);
  assert.equal(t.linkedLoanId, "L1");
  assert.equal(t.isLoanDisbursal, true);
  assert.equal(t.desc, "Loan given - Raj");
  assert.deepEqual(t.catIds, []);
});

test("the debit takes the amount off the source account only (same rule accountBalance applies to a transfer)", () => {
  const t = buildLoanDisbursalTxn({ loanId: "L1", personName: "", fromAccId: "bank1", amount: 5000.005, date: "2026-10-04" });
  const balance = (accId, opening) => opening - (t.fromAccId === accId ? t.amount : 0) + (t.toAccId === accId ? t.amount : 0);
  assert.equal(balance("bank1", 20000), 20000 - t.amount);
  assert.equal(balance("cash1", 700), 700);
  assert.equal(t.desc, "Loan given");
});
