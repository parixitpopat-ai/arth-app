import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileAutoEmiLoan, reconcileAutoEmiLoans } from "./autoEmiProgress.js";

const inst = (n, date) => ({ id: `i${n}`, type: "expense", amount: 10000, date, accId: "cc1", isAutoEmiInstallment: true });
const txns = [inst(1, "2026-08-15"), inst(2, "2026-09-15"), inst(3, "2026-10-15"), inst(4, "2026-11-15"), inst(5, "2026-12-15"), inst(6, "2027-01-15")];
const loan = (extra = {}) => ({ id: "L1", direction: "taken", autoScheduled: true, status: "active", principal: 60000, outstanding: 60000, emiAmount: 10000,
  dueDate: "2026-07-20", scheduledInstallmentIds: ["i1", "i2", "i3", "i4", "i5", "i6"], repayments: [], ...extra });

test("instalments already billed reduce outstanding and the due date moves to the next one ahead", () => {
  const { loan: l, changed } = reconcileAutoEmiLoan(loan(), txns, "2026-10-10");
  assert.equal(changed, true);
  assert.equal(l.outstanding, 40000); // Aug + Sep billed
  assert.equal(l.dueDate, "2026-10-15");
  assert.equal(l.status, "active");
  assert.equal(l.repayments.length, 1);
  assert.equal(l.repayments[0].amount, 20000);
});

test("an instalment is billed on its own date, not before", () => {
  assert.equal(reconcileAutoEmiLoan(loan(), txns, "2026-10-14").loan.outstanding, 40000);
  assert.equal(reconcileAutoEmiLoan(loan(), txns, "2026-10-15").loan.outstanding, 30000);
});

test("when the last instalment is billed the loan closes on that date", () => {
  const { loan: l } = reconcileAutoEmiLoan(loan(), txns, "2027-02-01");
  assert.equal(l.outstanding, 0);
  assert.equal(l.status, "closed");
  assert.equal(l.closedDate, "2027-01-15");
  assert.equal(l.dueDate, "2027-01-15");
});

test("repayments already recorded by hand are not counted twice, and a prepayment is not undone", () => {
  const paidByHand = loan({ outstanding: 40000, repayments: [{ id: "r", amount: 20000 }] });
  assert.equal(reconcileAutoEmiLoan(paidByHand, txns, "2026-10-10").loan.outstanding, 40000);
  const prepaid = loan({ outstanding: 25000 });
  assert.equal(reconcileAutoEmiLoan(prepaid, txns, "2026-10-10").loan.outstanding, 25000);
});

test("idempotent: running again changes nothing and returns the same array", () => {
  const once = reconcileAutoEmiLoans([loan()], txns, "2026-10-10");
  const twice = reconcileAutoEmiLoans(once, txns, "2026-10-10");
  assert.equal(twice, once);
});

test("loans that are not auto-scheduled, already closed, or whose instalments are missing are left alone", () => {
  const plain = loan({ autoScheduled: false });
  const closed = loan({ status: "closed" });
  const orphan = loan({ scheduledInstallmentIds: ["gone"] });
  const arr = [plain, closed, orphan];
  assert.equal(reconcileAutoEmiLoans(arr, txns, "2027-06-01"), arr);
});
