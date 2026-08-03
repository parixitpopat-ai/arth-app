import test from "node:test";
import assert from "node:assert/strict";
import { Transaction, TransactionValidationError, VALID_TRANSACTION_TYPES } from "../Transaction.js";

const baseParams = () => ({
  id: "txn-1",
  type: "expense",
  date: "2026-08-03",
  amount: 500,
  accountId: "acc-1",
});

// --- Constructor invariants ---

test("Transaction: rejects invalid type", () => {
  assert.throws(
    () => new Transaction({ ...baseParams(), type: "not_a_real_type" }),
    TransactionValidationError
  );
});

test("Transaction: accepts every type in the frozen taxonomy", () => {
  for (const type of VALID_TRANSACTION_TYPES) {
    assert.doesNotThrow(() => new Transaction({ ...baseParams(), type }));
  }
});

test("Transaction: requires a date", () => {
  assert.throws(() => new Transaction({ ...baseParams(), date: null }), TransactionValidationError);
});

// Invariant (Team 1 Invariant Table): "Transaction has exactly one Account reference"
test("Transaction: requires an accountId", () => {
  assert.throws(() => new Transaction({ ...baseParams(), accountId: null }), TransactionValidationError);
});

// Invariant (Team 1 Invariant Table): type constrains which child objects are valid
test("Transaction: personShares only allowed for type=expense", () => {
  assert.throws(
    () => new Transaction({
      ...baseParams(),
      type: "income",
      personShares: [{ personId: "p1", amount: 100, mode: "owes" }],
    }),
    TransactionValidationError
  );

  assert.doesNotThrow(() => new Transaction({
    ...baseParams(),
    type: "expense",
    personShares: [{ personId: "p1", amount: 100, mode: "owes" }],
  }));
});

// --- Behavior: post() ---

test("Transaction.post(): raises TransactionPosted event", () => {
  const txn = Transaction.post(baseParams());
  const events = txn.pullEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "TransactionPosted");
  assert.equal(events[0].transactionId, "txn-1");
  assert.equal(events[0].amount, 500);
});

test("Transaction.post(): pullEvents() clears the queue (events consumed once)", () => {
  const txn = Transaction.post(baseParams());
  txn.pullEvents();
  assert.equal(txn.pullEvents().length, 0, "events should not be returned twice");
});

// --- Behavior: edit() ---

test("Transaction.edit(): applies changes and raises TransactionEdited", () => {
  const txn = Transaction.post(baseParams());
  txn.pullEvents();

  txn.edit({ amount: 750, note: "corrected amount" });

  assert.equal(txn.amount.amount, 750);
  assert.equal(txn.note, "corrected amount");

  const events = txn.pullEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "TransactionEdited");
});

test("Transaction.edit(): cannot edit a deleted transaction", () => {
  const txn = Transaction.post(baseParams());
  txn.delete();
  assert.throws(() => txn.edit({ amount: 100 }), TransactionValidationError);
});

// --- Behavior: delete() ---
// Per ADR-018 (real repo): permanent, no soft-delete.

test("Transaction.delete(): raises TransactionDeleted event", () => {
  const txn = Transaction.post(baseParams());
  txn.pullEvents();
  txn.delete();
  const events = txn.pullEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "TransactionDeleted");
});

test("Transaction.delete(): cannot delete an already-deleted transaction", () => {
  const txn = Transaction.post(baseParams());
  txn.delete();
  assert.throws(() => txn.delete(), TransactionValidationError);
});

// --- SettlementTarget contract (ADR-033) ---

test("Transaction.applySettlement(): reduces the correct person's share and raises TransactionSettlementApplied", () => {
  const txn = Transaction.post({
    ...baseParams(),
    personShares: [
      { personId: "p1", amount: 300, mode: "owes" },
      { personId: "p2", amount: 200, mode: "owes" },
    ],
  });
  txn.pullEvents();

  const result = txn.applySettlement("p1", 300);

  assert.equal(result.fullySettled, true);
  const p1Share = txn.personShares.find(s => s.personId === "p1");
  const p2Share = txn.personShares.find(s => s.personId === "p2");
  assert.equal(p1Share.settled, true);
  assert.equal(p1Share.remainingAmt.amount, 0);
  assert.equal(p2Share.settled, false, "settling p1 must not affect p2's share");
  assert.equal(p2Share.remainingAmt.amount, 200);

  const events = txn.pullEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "TransactionSettlementApplied");
  assert.equal(events[0].personId, "p1");
  assert.equal(events[0].fullySettled, true);
});

test("Transaction.applySettlement(): partial payment leaves share unsettled with correct remainingAmt", () => {
  const txn = Transaction.post({
    ...baseParams(),
    personShares: [{ personId: "p1", amount: 300, mode: "owes" }],
  });
  const result = txn.applySettlement("p1", 100);
  assert.equal(result.fullySettled, false);
  assert.equal(txn.personShares[0].remainingAmt.amount, 200);
});

test("Transaction.applySettlement(): throws for a person with no share on this transaction", () => {
  const txn = Transaction.post({
    ...baseParams(),
    personShares: [{ personId: "p1", amount: 300, mode: "owes" }],
  });
  assert.throws(() => txn.applySettlement("someone-else", 100));
});

test("Transaction.applySettlement(): cannot settle a deleted transaction", () => {
  const txn = Transaction.post({
    ...baseParams(),
    personShares: [{ personId: "p1", amount: 300, mode: "owes" }],
  });
  txn.delete();
  assert.throws(() => txn.applySettlement("p1", 100), TransactionValidationError);
});

test("Transaction.outstanding(): sums remainingAmt across all owes-mode shares", () => {
  const txn = Transaction.post({
    ...baseParams(),
    personShares: [
      { personId: "p1", amount: 300, mode: "owes" },
      { personId: "p2", amount: 200, mode: "owes" },
      { personId: "p3", amount: 100, mode: "on_me" }, // not "owes" — excluded
    ],
  });
  assert.equal(txn.outstanding().amount, 500);

  txn.applySettlement("p1", 300);
  assert.equal(txn.outstanding().amount, 200, "outstanding() must reflect settlements applied so far");
});

// --- CBR acceptance check: no duplicate settlement logic ---
// The CBR's whole premise was that "reduce owed amount, recompute settled" had
// 4 independent implementations. This aggregate is the canonical one — this test
// exists to make that claim checkable, not just asserted in a document.

test("CBR acceptance: PersonShare is frozen — direct mutation is structurally impossible, not just discouraged", () => {
  const txn = Transaction.post({
    ...baseParams(),
    personShares: [{ personId: "p1", amount: 300, mode: "owes" }],
  });
  const share = txn.personShares[0];

  // ES modules run in strict mode: assigning to a frozen object's property throws.
  assert.throws(() => { share.settledAmt = 999; }, TypeError);
});
