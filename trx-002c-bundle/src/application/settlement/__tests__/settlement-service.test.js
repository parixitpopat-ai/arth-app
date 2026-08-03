import test from "node:test";
import assert from "node:assert/strict";
import { SettlementService } from "../SettlementService.js";
import { Transaction } from "../../../domain/transactions/Transaction.js";

const makeTxn = (id, personId, amount) => Transaction.post({
  id, type: "expense", date: "2026-08-03", amount, accountId: "acc-1",
  personShares: [{ personId, amount, mode: "owes" }],
});

test("SettlementService: allocates a payment fully against a single candidate", () => {
  const service = new SettlementService();
  const txn = makeTxn("t1", "p1", 300);

  const result = service.allocate(300, [{ target: txn, personId: "p1" }]);

  assert.equal(result.allocations.length, 1);
  assert.equal(result.allocations[0].appliedAmount.amount, 300);
  assert.equal(result.allocations[0].fullySettled, true);
  assert.equal(result.unappliedAmount.amount, 0);
});

test("SettlementService: splits one payment across multiple candidates, in order", () => {
  const service = new SettlementService();
  const txn1 = makeTxn("t1", "p1", 200);
  const txn2 = makeTxn("t2", "p1", 300);

  const result = service.allocate(350, [
    { target: txn1, personId: "p1" },
    { target: txn2, personId: "p1" },
  ]);

  assert.equal(result.allocations.length, 2);
  assert.equal(result.allocations[0].appliedAmount.amount, 200, "first candidate gets fully paid first");
  assert.equal(result.allocations[0].fullySettled, true);
  assert.equal(result.allocations[1].appliedAmount.amount, 150, "second candidate gets whatever's left");
  assert.equal(result.allocations[1].fullySettled, false);
  assert.equal(result.unappliedAmount.amount, 0);
});

// Matches the real observed behavior from this session's debugging (the "Apply
// to original dues" screen: "Applied ₹319.40 of ₹858.40 · ₹539 extra kept as
// advance") — a payment exceeding every candidate's total owed is not
// silently dropped, and is not forced onto an unselected candidate.
test("SettlementService: payment exceeding all candidates' owed amounts returns the excess as unapplied", () => {
  const service = new SettlementService();
  const txn = makeTxn("t1", "p1", 100);

  const result = service.allocate(250, [{ target: txn, personId: "p1" }]);

  assert.equal(result.allocations[0].appliedAmount.amount, 100);
  assert.equal(result.unappliedAmount.amount, 150, "excess is returned, never force-applied or dropped");
});

test("SettlementService: candidate with zero outstanding is skipped, not error", () => {
  const service = new SettlementService();
  const alreadySettled = makeTxn("t1", "p1", 100);
  alreadySettled.applySettlement("p1", 100); // fully settled already

  const stillOwed = makeTxn("t2", "p1", 200);

  const result = service.allocate(150, [
    { target: alreadySettled, personId: "p1" },
    { target: stillOwed, personId: "p1" },
  ]);

  assert.equal(result.allocations.length, 1, "the already-settled candidate is skipped, not allocated to");
  assert.equal(result.allocations[0].appliedAmount.amount, 150);
});

test("SettlementService: is stateless — repeated calls don't accumulate any internal state", () => {
  const service = new SettlementService();
  const txn1 = makeTxn("t1", "p1", 100);
  service.allocate(50, [{ target: txn1, personId: "p1" }]);

  const txn2 = makeTxn("t2", "p1", 100);
  const result = service.allocate(50, [{ target: txn2, personId: "p1" }]);

  // If the service carried any state from the first call, this would be affected.
  assert.equal(result.allocations[0].appliedAmount.amount, 50);
  assert.equal(Object.keys(service).length, 0, "SettlementService instance has no own fields — nothing to carry state in");
});
