import test from "node:test";
import assert from "node:assert/strict";
import { matchesQuickFilter } from "./quickFilters.js";

const plain = { id: 1, type: "expense", amount: 100, accId: "b1" };

test("a plain expense is only in Everything", () => {
  for (const f of ["people", "work", "loans"]) assert.equal(matchesQuickFilter(plain, f), false);
  assert.equal(matchesQuickFilter(plain, "all"), true);
});

test("With people: a split with someone, a paid-by expense, a repayment from a person, a guest", () => {
  assert.equal(matchesQuickFilter({ ...plain, people: { r: { mode: "owes" } } }, "people"), true);
  assert.equal(matchesQuickFilter({ ...plain, people: { __me__: {} } }, "people"), false);
  assert.equal(matchesQuickFilter({ ...plain, paidByPersonId: "r", accId: null }, "people"), true);
  assert.equal(matchesQuickFilter({ type: "settlement_in", fromPersonId: "r" }, "people"), true);
  assert.equal(matchesQuickFilter({ ...plain, guestPerson: "Dev" }, "people"), true);
});

test("Work: reimbursable, claim only, or already reimbursed", () => {
  assert.equal(matchesQuickFilter({ ...plain, reimbursable: true }, "work"), true);
  assert.equal(matchesQuickFilter({ ...plain, claimOnly: true }, "work"), true);
  assert.equal(matchesQuickFilter({ ...plain, reimbursedByTxnId: "x" }, "work"), true);
});

test("Loans: money lent out, loan receipts, an entry turned into a loan", () => {
  assert.equal(matchesQuickFilter({ type: "transfer", isLoanDisbursal: true }, "loans"), true);
  assert.equal(matchesQuickFilter({ type: "settlement_in", linkedLoanId: "L1" }, "loans"), true);
  assert.equal(matchesQuickFilter({ ...plain, madeFromTxnId: "9" }, "loans"), true);
});
