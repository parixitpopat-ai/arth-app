import test from "node:test";
import assert from "node:assert/strict";
import { wireTransactionApplication } from "../wiring.js";

// Proves TRX-002B's success criteria directly: every mutation flows through the
// Aggregate, via the Application Layer built in TRX-002A — not a new mechanism.

test("PostTransaction command creates a real Transaction aggregate, persisted and events published", async () => {
  const { dispatcher, repository, eventPublisher } = wireTransactionApplication();

  const result = await dispatcher.dispatch({
    type: "PostTransaction",
    payload: {
      id: "txn-100",
      type: "expense",
      date: "2026-08-03",
      amount: 1000,
      accountId: "acc-1",
      personShares: [{ personId: "p1", amount: 600, mode: "owes" }],
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.amount, 1000);

  const stored = await repository.load("txn-100");
  assert.ok(stored, "aggregate must be persisted via the repository, same as TRX-002A's Tag example");
  assert.equal(stored.personShares[0].personId, "p1");

  assert.equal(eventPublisher.published.length, 1);
  assert.equal(eventPublisher.published[0].type, "TransactionPosted");
});

test("ApplySettlement command loads the aggregate, calls its own method, never mutates directly", async () => {
  const { dispatcher, repository, eventPublisher } = wireTransactionApplication();

  await dispatcher.dispatch({
    type: "PostTransaction",
    payload: {
      id: "txn-101",
      type: "expense",
      date: "2026-08-03",
      amount: 500,
      accountId: "acc-1",
      personShares: [{ personId: "p1", amount: 500, mode: "owes" }],
    },
  });
  eventPublisher.published.length = 0; // clear the post event for a clean assertion below

  const settleResult = await dispatcher.dispatch({
    type: "ApplySettlement",
    payload: { transactionId: "txn-101", personId: "p1", amount: 500 },
  });

  assert.equal(settleResult.ok, true);
  assert.equal(settleResult.data.fullySettled, true);

  const stored = await repository.load("txn-101");
  assert.equal(stored.personShares[0].settled, true, "the persisted aggregate reflects the settlement");

  assert.equal(eventPublisher.published.length, 1);
  assert.equal(eventPublisher.published[0].type, "TransactionSettlementApplied");
});

test("ApplySettlement on an unknown transaction returns NOT_FOUND, not a throw", async () => {
  const { dispatcher } = wireTransactionApplication();
  const result = await dispatcher.dispatch({
    type: "ApplySettlement",
    payload: { transactionId: "does-not-exist", personId: "p1", amount: 100 },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "NOT_FOUND");
});

test("PostTransaction validation errors surface as CommandResult.failure, never throw past the Dispatcher", async () => {
  const { dispatcher } = wireTransactionApplication();
  const result = await dispatcher.dispatch({
    type: "PostTransaction",
    payload: { id: "txn-bad", type: "not_a_real_type", date: "2026-08-03", amount: 100, accountId: "acc-1" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
});
