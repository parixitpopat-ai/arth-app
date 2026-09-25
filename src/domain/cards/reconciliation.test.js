import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmMatchedWithBank, undoMatch, recordBankAmount, getMismatchDirection, getRecordsNowTotal, applyRecalculatedUpdate, getReviewCandidates } from "./reconciliation.js";

const toDateOnly = value => {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};
const card = { id: "cc1" };
const accounts = [card];
const baseBill = { id: "b1", periodFrom: "2026-08-15", periodTo: "2026-09-15", arthAmount: 35000, amount: 35000, bankAmount: null, verification: "needs_verification", verifiedAt: null, adjustments: [] };

test("confirmMatchedWithBank sets matched + verifiedAt, leaves amount untouched", () => {
  const out = confirmMatchedWithBank(baseBill, new Date(2026, 8, 26));
  assert.equal(out.verification, "matched");
  assert.equal(out.verifiedAt, "2026-09-26");
  assert.equal(out.arthAmount, 35000);
});

test("undoMatch reverts to needs_verification", () => {
  const matched = confirmMatchedWithBank(baseBill);
  const out = undoMatch(matched);
  assert.equal(out.verification, "needs_verification");
  assert.equal(out.verifiedAt, null);
});

test("recordBankAmount: equal to Arth resolves straight to matched", () => {
  const out = recordBankAmount(baseBill, 35000);
  assert.equal(out.verification, "matched");
  assert.equal(out.bankAmount, 35000);
});

test("recordBankAmount: bank higher than Arth -> mismatch, arthAmount untouched", () => {
  const out = recordBankAmount(baseBill, 40000);
  assert.equal(out.verification, "mismatch");
  assert.equal(out.arthAmount, 35000);
  assert.equal(out.bankAmount, 40000);
  assert.equal(getMismatchDirection(out), "bank_higher");
});

test("recordBankAmount: Arth higher than bank -> mismatch, direction arth_higher", () => {
  const out = recordBankAmount({ ...baseBill, arthAmount: 40000, amount: 40000 }, 35000);
  assert.equal(out.verification, "mismatch");
  assert.equal(getMismatchDirection(out), "arth_higher");
});

test("getRecordsNowTotal re-sums live transactions for the bill's period", () => {
  const txns = [{ type: "expense", accId: "cc1", date: "2026-09-01", amount: 5000 }];
  const total = getRecordsNowTotal({ ...baseBill, arthAmount: 35000 }, card, accounts, txns, toDateOnly);
  assert.equal(total, 5000);
});

test("applyRecalculatedUpdate only fires on explicit call, records history, matches iff equals bank", () => {
  const mismatch = recordBankAmount(baseBill, 40000);
  const updated = applyRecalculatedUpdate(mismatch, 40000, new Date(2026, 8, 27));
  assert.equal(updated.arthAmount, 40000);
  assert.equal(updated.amount, 40000);
  assert.equal(updated.verification, "matched");
  assert.equal(updated.verifiedAt, "2026-09-27");
  assert.equal(updated.adjustments.length, 1);
  assert.equal(updated.adjustments[0].from, 35000);
  assert.equal(updated.adjustments[0].to, 40000);
});

test("applyRecalculatedUpdate stays mismatch if new total still doesn't equal bank amount", () => {
  const mismatch = recordBankAmount(baseBill, 40000);
  const updated = applyRecalculatedUpdate(mismatch, 38000);
  assert.equal(updated.verification, "mismatch");
  assert.equal(updated.verifiedAt, null);
});

test("getReviewCandidates flags boundary-day and duplicate-looking transactions deterministically", () => {
  const txns = [
    { id: "t1", type: "expense", accId: "cc1", date: "2026-09-15", amount: 500, merchant: "Amazon" }, // boundary
    { id: "t2", type: "expense", accId: "cc1", date: "2026-08-20", amount: 1200, merchant: "Swiggy" },
    { id: "t3", type: "expense", accId: "cc1", date: "2026-08-21", amount: 1200, merchant: "Swiggy" }, // dup of t2
    { id: "t4", type: "expense", accId: "cc1", date: "2026-08-25", amount: 300, merchant: "Store", note: "refund pending" },
  ];
  const candidates = getReviewCandidates(baseBill, txns, card, accounts);
  const ids = candidates.map(c => c.txn.id);
  assert.ok(ids.includes("t1"));
  assert.ok(ids.includes("t2"));
  assert.ok(ids.includes("t3"));
  assert.ok(ids.includes("t4"));
});
