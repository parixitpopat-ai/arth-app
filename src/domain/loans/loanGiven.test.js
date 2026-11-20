import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLoanGiven } from "./loanGiven.js";

let n = 0; const genId = () => `id${++n}`;
const base = { personId: "p1", personName: "Raj Adhiya", amount: "15000", date: "2026-11-04", fromAccId: "bank1", genId, now: 1700000000000 };

test("a loan to a friend from one of my accounts makes a receivable loan and a money-out entry with no destination", () => {
  const r = buildLoanGiven(base);
  assert.equal(r.ok, true);
  assert.equal(r.loan.direction, "given"); assert.equal(r.loan.sourceType, "person"); assert.equal(r.loan.personId, "p1");
  assert.equal(r.loan.principal, 15000); assert.equal(r.loan.outstanding, 15000); assert.equal(r.loan.status, "active"); assert.equal(r.loan.startDate, "2026-11-04");
  assert.equal(r.txn.fromAccId, "bank1"); assert.equal(r.txn.toAccId, null); assert.equal(r.txn.accId, null);
  assert.equal(r.txn.amount, 15000); assert.equal(r.txn.linkedLoanId, r.loan.id); assert.equal(r.txn.isLoanDisbursal, true);
  assert.equal(r.txn.desc, "Loan given - Raj Adhiya"); assert.deepEqual(r.txn.catIds, []);
});
test("not from one of my accounts (cash, or already recorded): the loan is made and nothing is debited", () => {
  const r = buildLoanGiven({ ...base, fromAccId: "" });
  assert.equal(r.ok, true); assert.equal(r.txn, null); assert.equal(r.loan.paymentAccId, "");
});
test("a destination account is refused", () => {
  const r = buildLoanGiven({ ...base, toAccId: "cc1" }); assert.equal(r.ok, false); assert.match(r.error, /no destination/);
});
test("missing person, amount or date is refused with a plain message and builds nothing", () => {
  assert.match(buildLoanGiven({ ...base, personName: "  " }).error, /who you lent/);
  for (const amount of ["", "0", "-5", "abc", undefined]) assert.match(buildLoanGiven({ ...base, amount }).error, /amount/);
  assert.match(buildLoanGiven({ ...base, date: "" }).error, /date/);
});
test("money is rounded to paise and the note is kept on both records", () => {
  const r = buildLoanGiven({ ...base, amount: 100.456, note: " for rent " });
  assert.equal(r.loan.principal, 100.46); assert.equal(r.txn.amount, 100.46); assert.equal(r.loan.note, "for rent"); assert.equal(r.txn.note, "Money lent · for rent");
});
test("the loan and its money-out entry carry different ids and are linked", () => {
  const r = buildLoanGiven(base); assert.notEqual(r.loan.id, r.txn.id); assert.equal(r.txn.linkedLoanId, r.loan.id);
});
test("an expected return date and a yearly interest rate are kept; interest is only a stored rate, not added to the amount", () => {
  const r = buildLoanGiven({ ...base, dueDate: "2027-02-01", interestRate: "12" });
  assert.equal(r.ok, true); assert.equal(r.loan.dueDate, "2027-02-01"); assert.equal(r.loan.hasInterest, true); assert.equal(r.loan.interestRate, 12);
  assert.equal(r.loan.principal, 15000); assert.equal(r.loan.outstanding, 15000); assert.equal(r.txn.amount, 15000);
});
test("no return date and no interest leave them empty, as before", () => {
  const r = buildLoanGiven(base); assert.equal(r.loan.dueDate, ""); assert.equal(r.loan.hasInterest, false); assert.equal(r.loan.interestRate, 0);
});
test("a return date before the lending date, or a nonsense interest rate, is refused", () => {
  assert.match(buildLoanGiven({ ...base, dueDate: "2026-11-03" }).error, /before the date/);
  for (const interestRate of ["-1", "101", "abc"]) assert.match(buildLoanGiven({ ...base, interestRate }).error, /Interest/);
  assert.equal(buildLoanGiven({ ...base, dueDate: "2026-11-04" }).ok, true);
});
