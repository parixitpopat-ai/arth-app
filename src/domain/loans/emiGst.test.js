import test from "node:test";
import assert from "node:assert/strict";
import { splitGstAcrossInstalments } from "./emiGst.js";
import { reconcileAutoEmiLoan } from "./autoEmiProgress.js";

test("648 over 9 instalments is 72 each", () => {
  assert.deepEqual(splitGstAcrossInstalments(648, 9), Array(9).fill(72));
});

test("a share that does not divide evenly adds back exactly: 100 over 3 is 33.33, 33.33, 33.34", () => {
  const s = splitGstAcrossInstalments(100, 3);
  assert.deepEqual(s, [33.33, 33.33, 33.34]);
  assert.equal(Math.round(s.reduce((a, b) => a + b, 0) * 100), 10000);
});

test("no GST or no tenure gives zeros", () => {
  assert.deepEqual(splitGstAcrossInstalments(0, 3), [0, 0, 0]);
  assert.deepEqual(splitGstAcrossInstalments(500, 0), []);
});

test("the GST part of an instalment does not reduce the loan: only the EMI (principal) part does", () => {
  const loan = { id: "L", autoScheduled: true, status: "active", principal: 18000, outstanding: 18000, scheduledInstallmentIds: ["a", "b", "c"] };
  const txns = ["a", "b", "c"].map((id, i) => ({ id, date: `2026-1${i}-15`, amount: 6072, emiPrincipalPart: 6000, emiGstPart: 72 }));
  const r = reconcileAutoEmiLoan(loan, txns.slice(0, 2).concat({ ...txns[2], date: "2099-01-01" }), "2026-12-20");
  assert.equal(r.loan.outstanding, 6000);
});
