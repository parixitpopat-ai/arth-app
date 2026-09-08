import test from "node:test";
import assert from "node:assert/strict";
import { wireTransactionApplication } from "../wiring.js";

test("EditTransaction applies amount/note/category/subcategory/date via Transaction.edit()", async () => {
  const { dispatcher, repository } = wireTransactionApplication();
  await dispatcher.dispatch({
    type: "PostTransaction",
    payload: { id: "t1", type: "expense", date: "2026-08-01", amount: 500, accountId: "acc-1", categoryId: "cat-1" },
  });

  const result = await dispatcher.dispatch({
    type: "EditTransaction",
    payload: { transactionId: "t1", changes: { amount: 700, categoryId: "cat-2", note: "updated" } },
  });

  assert.equal(result.ok, true);
  const stored = await repository.load("t1");
  assert.equal(stored.amount.amount, 700);
  assert.equal(stored.categoryId, "cat-2");
  assert.equal(stored.note, "updated");
});

test("EditTransaction on an unknown id returns NOT_FOUND, not a throw", async () => {
  const { dispatcher } = wireTransactionApplication();
  const result = await dispatcher.dispatch({
    type: "EditTransaction",
    payload: { transactionId: "does-not-exist", changes: { amount: 100 } },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "NOT_FOUND");
});

test("EditTransaction rejects a changes payload containing accountId — UNSUPPORTED_EDIT_FIELDS, distinct from NOT_YET_REPRESENTABLE, no silent partial apply", async () => {
  const { dispatcher, repository } = wireTransactionApplication();
  await dispatcher.dispatch({
    type: "PostTransaction",
    payload: { id: "t1", type: "expense", date: "2026-08-01", amount: 500, accountId: "acc-1" },
  });

  const result = await dispatcher.dispatch({
    type: "EditTransaction",
    payload: { transactionId: "t1", changes: { amount: 700, accountId: "acc-2" } },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "UNSUPPORTED_EDIT_FIELDS");

  const stored = await repository.load("t1");
  assert.equal(stored.amount.amount, 500, "amount must NOT have been partially applied — the whole command must fail, not half-succeed");
  assert.equal(stored.accountId, "acc-1");
});

test("EditTransaction surfaces a genuine validation error distinctly (VALIDATION_ERROR, not NOT_YET_REPRESENTABLE, not UNSUPPORTED_EDIT_FIELDS)", async () => {
  const { dispatcher } = wireTransactionApplication();
  await dispatcher.dispatch({
    type: "PostTransaction",
    payload: { id: "t1", type: "expense", date: "2026-08-01", amount: 500, accountId: "acc-1" },
  });

  const result = await dispatcher.dispatch({
    type: "EditTransaction",
    payload: { transactionId: "t1", changes: { amount: -50 } },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
});
