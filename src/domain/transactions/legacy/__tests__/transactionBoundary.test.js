import test from "node:test";
import assert from "node:assert/strict";
import { wireTransactionApplication } from "../../../../application/transactions/wiring.js";
import { submitTransactionThroughBoundary } from "../transactionBoundary.js";
import { NOT_YET_REPRESENTABLE } from "../transactionRepresentability.js";

function makeStatePort(initial = []) {
  let store = [...initial];
  return {
    getAll: () => store,
    upsert: (record) => {
      const idx = store.findIndex(t => String(t.id) === String(record.id));
      store = idx === -1 ? [record, ...store] : store.map((t, i) => (i === idx ? record : t));
    },
    _peek: () => store,
  };
}

test("split expense CREATE is rejected as NOT_YET_REPRESENTABLE and handled by the legacy path", async () => {
  const port = makeStatePort([]);
  const { dispatcher } = wireTransactionApplication({ statePort: port });
  let legacyCalledWith = null;

  const draft = { id: "t1", type: "expense", accId: "acc-1", catIds: ["cat-1", "cat-2"], catAllocations: [{ catId: "cat-1", amount: 300 }], amount: 500, date: "2026-08-01" };
  const outcome = await submitTransactionThroughBoundary({
    operation: "create",
    draft,
    dispatcher,
    legacyUpsert: (d) => { legacyCalledWith = d; },
  });

  assert.equal(outcome.usedLegacyPath, true);
  assert.equal(outcome.code, NOT_YET_REPRESENTABLE);
  assert.deepEqual(legacyCalledWith, draft, "legacy upsertTxn must receive the draft completely unchanged");
  assert.equal(port._peek().length, 0, "the new repository must NOT have been written to for a legacy-routed submission");
});

test("split expense EDIT is also rejected as NOT_YET_REPRESENTABLE and handled by the legacy path", async () => {
  const priorStoredRecord = { id: "t1", type: "expense", accId: "acc-1", catIds: ["cat-1", "cat-2"], catAllocations: [{ catId: "cat-1", amount: 300 }], amount: 500, date: "2026-08-01" };
  const port = makeStatePort([priorStoredRecord]);
  const { dispatcher } = wireTransactionApplication({ statePort: port });
  let legacyCalled = false;

  const draft = { ...priorStoredRecord, note: "a note change" };
  const outcome = await submitTransactionThroughBoundary({
    operation: "edit",
    draft,
    priorStoredRecord,
    dispatcher,
    legacyUpsert: () => { legacyCalled = true; },
  });

  assert.equal(outcome.usedLegacyPath, true);
  assert.equal(outcome.code, NOT_YET_REPRESENTABLE);
  assert.equal(legacyCalled, true);
});

test("single-category expense CREATE crosses the new boundary and produces correct catId/catIds", async () => {
  const port = makeStatePort([]);
  const { dispatcher } = wireTransactionApplication({ statePort: port });
  let legacyCalled = false;

  const draft = { id: "t1", type: "expense", accId: "acc-1", catId: "cat-1", catIds: ["cat-1"], amount: 500, date: "2026-08-01", note: "lunch" };
  const outcome = await submitTransactionThroughBoundary({
    operation: "create",
    draft,
    dispatcher,
    legacyUpsert: () => { legacyCalled = true; },
  });

  assert.equal(outcome.usedLegacyPath, false);
  assert.equal(outcome.result.ok, true);
  assert.equal(legacyCalled, false);
  assert.equal(port._peek().length, 1);
  assert.equal(port._peek()[0].catId, "cat-1");
  assert.deepEqual(port._peek()[0].catIds, ["cat-1"]);
});

test("single-category expense EDIT (amount+category only) crosses the new boundary", async () => {
  const priorStoredRecord = { id: "t1", type: "expense", accId: "acc-1", catId: "cat-1", catIds: ["cat-1"], amount: 500, date: "2026-08-01", note: "lunch", people: {} };
  const port = makeStatePort([priorStoredRecord]);
  const { dispatcher } = wireTransactionApplication({ statePort: port });

  const draft = { ...priorStoredRecord, amount: 650, catId: "cat-2" };
  const outcome = await submitTransactionThroughBoundary({ operation: "edit", draft, priorStoredRecord, dispatcher, legacyUpsert: () => { throw new Error("must not be called"); } });

  assert.equal(outcome.usedLegacyPath, false);
  assert.equal(outcome.result.ok, true);
  assert.equal(port._peek()[0].amount, 650);
  assert.equal(port._peek()[0].catId, "cat-2");
});

test("account-change EDIT is NOT_YET_REPRESENTABLE and goes through legacy, not a partial new-path apply", async () => {
  const priorStoredRecord = { id: "t1", type: "expense", accId: "acc-1", catId: "cat-1", amount: 500, date: "2026-08-01", people: {} };
  const port = makeStatePort([priorStoredRecord]);
  const { dispatcher } = wireTransactionApplication({ statePort: port });
  let legacyCalledWith = null;

  const draft = { ...priorStoredRecord, amount: 999, accId: "acc-2" };
  const outcome = await submitTransactionThroughBoundary({
    operation: "edit",
    draft,
    priorStoredRecord,
    dispatcher,
    legacyUpsert: (d) => { legacyCalledWith = d; },
  });

  assert.equal(outcome.usedLegacyPath, true);
  assert.equal(outcome.code, NOT_YET_REPRESENTABLE);
  assert.deepEqual(legacyCalledWith, draft, "the WHOLE operation (amount change included) must go to legacy — never split amount->new, account->old");
  assert.equal(port._peek()[0].amount, 500, "the new repository must be untouched — no partial application of the amount change");
});

test("a genuine validation failure after passing representability is returned as-is, NEVER silently redirected to the legacy path", async () => {
  const port = makeStatePort([]);
  const { dispatcher } = wireTransactionApplication({ statePort: port });
  let legacyCalled = false;

  // Representable shape (single category, no split, no account/people concerns
  // since it's a create) but a genuinely invalid amount.
  const draft = { id: "t1", type: "expense", accId: "acc-1", catId: "cat-1", amount: -50, date: "2026-08-01" };
  const outcome = await submitTransactionThroughBoundary({
    operation: "create",
    draft,
    dispatcher,
    legacyUpsert: () => { legacyCalled = true; },
  });

  assert.equal(outcome.usedLegacyPath, false, "a real validation error must not be reported as having used the legacy path");
  assert.equal(outcome.result.ok, false);
  assert.equal(outcome.result.error.code, "VALIDATION_ERROR");
  assert.notEqual(outcome.result.error.code, NOT_YET_REPRESENTABLE);
  assert.equal(legacyCalled, false, "legacyUpsert must NOT have been called for a genuine validation error");
  assert.equal(port._peek().length, 0, "nothing should have been written anywhere for a failed submission");
});
