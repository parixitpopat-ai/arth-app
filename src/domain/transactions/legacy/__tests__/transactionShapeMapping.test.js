import test from "node:test";
import assert from "node:assert/strict";
import { Transaction } from "../../Transaction.js";
import { transactionFromStoredShape, storedDraftToEditChanges } from "../transactionFromStoredShape.js";
import { transactionToStoredShape } from "../transactionToStoredShape.js";

test("transactionFromStoredShape maps every WP-TXN-01 field correctly (expense)", () => {
  const stored = { id: "t1", type: "expense", date: "2026-08-01", amount: 500, accId: "acc-1", catId: "cat-1", subId: "sub-1", note: "lunch", people: { p1: { amount: 200, mode: "owes", settledAmt: 0 } } };
  const payload = transactionFromStoredShape(stored);
  const txn = new Transaction(payload);
  assert.equal(txn.accountId, "acc-1");
  assert.equal(txn.categoryId, "cat-1");
  assert.equal(txn.subcategoryId, "sub-1");
  assert.equal(txn.amount.amount, 500);
  assert.equal(txn.personShares.length, 1);
  assert.equal(txn.personShares[0].personId, "p1");
  assert.equal(txn.personShares[0].mode, "owes");
});

test("transactionFromStoredShape maps income with no personShares", () => {
  const stored = { id: "t2", type: "income", date: "2026-08-01", amount: 50000, accId: "acc-1", catId: null, subId: null, note: null };
  const payload = transactionFromStoredShape(stored);
  const txn = new Transaction(payload);
  assert.equal(txn.type, "income");
  assert.equal(txn.personShares.length, 0);
});

test("transactionFromStoredShape excludes the __me__ sentinel from personShares", () => {
  const stored = { id: "t3", type: "expense", date: "2026-08-01", amount: 500, accId: "acc-1", people: { __me__: { amount: 300, mode: "on_me" }, p1: { amount: 200, mode: "owes" } } };
  const payload = transactionFromStoredShape(stored);
  const txn = new Transaction(payload);
  assert.equal(txn.personShares.length, 1);
  assert.equal(txn.personShares[0].personId, "p1");
});

test("storedDraftToEditChanges only includes the five fields Transaction.edit() applies", () => {
  const draft = { id: "t1", type: "expense", accId: "acc-1", catId: "cat-2", subId: "sub-2", amount: 600, date: "2026-08-02", note: "changed", people: { p1: { amount: 200, mode: "owes" } } };
  const changes = storedDraftToEditChanges(draft);
  assert.deepEqual(Object.keys(changes).sort(), ["amount", "categoryId", "date", "note", "subcategoryId"]);
});

test("transactionToStoredShape on CREATE produces the expected fields with no stale spread", () => {
  const txn = Transaction.post({ id: "t1", type: "expense", date: "2026-08-01", amount: 500, accountId: "acc-1", categoryId: "cat-1", note: "lunch" });
  const stored = transactionToStoredShape(txn, null);
  assert.equal(stored.accId, "acc-1");
  assert.equal(stored.catId, "cat-1");
  assert.deepEqual(stored.catIds, ["cat-1"]);
  assert.equal(stored.amount, 500);
  assert.equal(stored.people, undefined, "no people key should be created for a non-split expense");
});

test("transactionToStoredShape preserves unknown legacy fields via prior-record spread (unknown-field preservation, mandatory)", () => {
  const prior = {
    id: "t1", type: "expense", accId: "acc-1", catId: "cat-1", amount: 500, note: "old note",
    desc: "Lunch at Cafe", merchant: "Cafe X", imageBase64: "abc123", transactionRef: "REF-1", groupId: "grp-9",
  };
  const txn = Transaction.post({ id: "t1", type: "expense", date: "2026-08-01", amount: 500, accountId: "acc-1", categoryId: "cat-1", note: "old note" });
  txn.edit({ note: "updated note" });
  const stored = transactionToStoredShape(txn, prior);

  assert.equal(stored.note, "updated note", "the actually-edited field must change");
  assert.equal(stored.desc, "Lunch at Cafe", "unknown field must survive untouched");
  assert.equal(stored.merchant, "Cafe X", "unknown field must survive untouched");
  assert.equal(stored.imageBase64, "abc123", "unknown field must survive untouched");
  assert.equal(stored.transactionRef, "REF-1", "unknown field must survive untouched");
  assert.equal(stored.groupId, "grp-9", "unknown field must survive untouched");
});

test("transactionToStoredShape does NOT claim to preserve catAllocations semantics — it is not aggregate-aware and would go stale", () => {
  // This is a documentation-by-test case: catAllocations describes a
  // multi-category split. checkRepresentability() rejects any record with
  // catAllocations before it ever reaches this function (see
  // transactionRepresentability.test.js). If a caller bypassed that check
  // and called this function directly on a record that happens to still
  // carry a catAllocations field from before, the prior-record spread would
  // carry it forward VERBATIM AND UNCHANGED — it does not get recomputed
  // against the aggregate's single categoryId, and would silently
  // contradict the (now single) catId/catIds this function does set. This
  // test exists so nobody mistakes "the field is still present" for "the
  // field is correctly preserved".
  const prior = { id: "t1", type: "expense", accId: "acc-1", amount: 500, catAllocations: [{ catId: "cat-1", amount: 300 }, { catId: "cat-2", amount: 200 }] };
  const txn = Transaction.post({ id: "t1", type: "expense", date: "2026-08-01", amount: 500, accountId: "acc-1", categoryId: "cat-9" });
  const stored = transactionToStoredShape(txn, prior);

  assert.deepEqual(stored.catIds, ["cat-9"], "the synthesized plural now reflects only the single new category");
  assert.deepEqual(
    stored.catAllocations,
    [{ catId: "cat-1", amount: 300 }, { catId: "cat-2", amount: 200 }],
    "catAllocations is carried forward VERBATIM and is now inconsistent with catId/catIds — this function must never be called on a representable-boundary submission that has this field; that guarantee lives in checkRepresentability(), not here"
  );
});

test("transactionToStoredShape removes catIds/subIds when the category/subcategory is cleared", () => {
  const prior = { id: "t1", type: "expense", accId: "acc-1", catId: "cat-1", catIds: ["cat-1"], subId: "sub-1", subIds: ["sub-1"], amount: 500 };
  const txn = Transaction.post({ id: "t1", type: "expense", date: "2026-08-01", amount: 500, accountId: "acc-1", categoryId: null, subcategoryId: null });
  const stored = transactionToStoredShape(txn, prior);
  assert.equal("catIds" in stored, false);
  assert.equal("subIds" in stored, false);
});
