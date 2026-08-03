import test from "node:test";
import assert from "node:assert/strict";
import { TransactionPersonShare, PersonShareValidationError } from "../TransactionPersonShare.js";

// Invariant 1 (Team 1 Invariant Table): settled always equals remainingAmt<=0,
// computed, never independently set. This is the exact invariant whose absence
// caused the original bill-status bug this whole session started from.
test("PersonShare: settled is always computed from remainingAmt, never independently settable", () => {
  const share = new TransactionPersonShare({ personId: "p1", amount: 100, mode: "owes" });
  assert.equal(share.settled, false);
  assert.equal(share.remainingAmt.amount, 100);

  const afterFullPayment = share.applySettlement(100);
  assert.equal(afterFullPayment.remainingAmt.amount, 0);
  assert.equal(afterFullPayment.settled, true, "settled must become true the instant remainingAmt hits zero — no separate flag to forget to set");
});

// Invariant 2 (Team 1 Invariant Table): settledAmt never exceeds amount.
test("PersonShare: settledAmt can never exceed amount, even if overpaid", () => {
  const share = new TransactionPersonShare({ personId: "p1", amount: 100, mode: "owes" });
  const overpaid = share.applySettlement(150); // paying more than owed
  assert.equal(overpaid.settledAmt.amount, 100, "settledAmt clamps at amount, never exceeds it");
  assert.equal(overpaid.remainingAmt.amount, 0);
  assert.equal(overpaid.settled, true);
});

test("PersonShare: partial settlement leaves settled false with correct remainingAmt", () => {
  const share = new TransactionPersonShare({ personId: "p1", amount: 100, mode: "owes" });
  const partial = share.applySettlement(40);
  assert.equal(partial.settledAmt.amount, 40);
  assert.equal(partial.remainingAmt.amount, 60);
  assert.equal(partial.settled, false);
});

test("PersonShare: applySettlement is immutable — original share is untouched", () => {
  const share = new TransactionPersonShare({ personId: "p1", amount: 100, mode: "owes" });
  const updated = share.applySettlement(50);
  assert.equal(share.settledAmt.amount, 0, "original instance must not mutate");
  assert.equal(updated.settledAmt.amount, 50);
});

test("PersonShare: rejects invalid mode", () => {
  assert.throws(
    () => new TransactionPersonShare({ personId: "p1", amount: 100, mode: "invalid_mode" }),
    PersonShareValidationError
  );
});

test("PersonShare: rejects missing personId", () => {
  assert.throws(
    () => new TransactionPersonShare({ amount: 100, mode: "owes" }),
    PersonShareValidationError
  );
});
