import test from "node:test";
import assert from "node:assert/strict";
import { checkRepresentability, NOT_YET_REPRESENTABLE } from "../transactionRepresentability.js";

test("plain single-category expense create is representable", () => {
  const result = checkRepresentability({
    operation: "create",
    draft: { type: "expense", accId: "acc-1", catId: "cat-1", catIds: ["cat-1"], amount: 500, date: "2026-08-01" },
  });
  assert.equal(result.representable, true);
});

test("plain income create is representable", () => {
  const result = checkRepresentability({
    operation: "create",
    draft: { type: "income", accId: "acc-1", catId: null, catIds: [], amount: 50000, date: "2026-08-01" },
  });
  assert.equal(result.representable, true);
});

test("category-split expense create is NOT_YET_REPRESENTABLE", () => {
  const result = checkRepresentability({
    operation: "create",
    draft: { type: "expense", accId: "acc-1", catIds: ["cat-1", "cat-2"], catAllocations: [{ catId: "cat-1", amount: 300 }], amount: 500, date: "2026-08-01" },
  });
  assert.equal(result.representable, false);
  assert.equal(result.code, NOT_YET_REPRESENTABLE);
});

test("category-split expense edit is also NOT_YET_REPRESENTABLE (not just create)", () => {
  const prior = { id: "t1", type: "expense", accId: "acc-1", catIds: ["cat-1", "cat-2"], catAllocations: [{ catId: "cat-1", amount: 300 }], amount: 500 };
  const result = checkRepresentability({
    operation: "edit",
    draft: { ...prior, note: "updated note" },
    priorStoredRecord: prior,
  });
  assert.equal(result.representable, false);
  assert.equal(result.code, NOT_YET_REPRESENTABLE);
});

test("ordinary amount/note/category/subcategory/date edit is representable", () => {
  const prior = { id: "t1", type: "expense", accId: "acc-1", catId: "cat-1", subId: "sub-1", amount: 500, date: "2026-08-01", people: {} };
  const draft = { ...prior, amount: 600, catId: "cat-2", subId: "sub-2", date: "2026-08-02", note: "changed" };
  const result = checkRepresentability({ operation: "edit", draft, priorStoredRecord: prior });
  assert.equal(result.representable, true);
});

test("account change on edit is NOT_YET_REPRESENTABLE", () => {
  const prior = { id: "t1", type: "expense", accId: "acc-1", amount: 500, people: {} };
  const draft = { ...prior, accId: "acc-2" };
  const result = checkRepresentability({ operation: "edit", draft, priorStoredRecord: prior });
  assert.equal(result.representable, false);
  assert.equal(result.code, NOT_YET_REPRESENTABLE);
});

test("person-share change on edit is NOT_YET_REPRESENTABLE", () => {
  const prior = { id: "t1", type: "expense", accId: "acc-1", amount: 500, people: { p1: { amount: 200, mode: "owes" } } };
  const draft = { ...prior, people: { p1: { amount: 300, mode: "owes" } } };
  const result = checkRepresentability({ operation: "edit", draft, priorStoredRecord: prior });
  assert.equal(result.representable, false);
  assert.equal(result.code, NOT_YET_REPRESENTABLE);
});

test("unchanged person-share on edit (only amount/note changed) remains representable", () => {
  const prior = { id: "t1", type: "expense", accId: "acc-1", amount: 500, catId: "cat-1", people: { p1: { amount: 200, mode: "owes", settledAmt: 50, remainingAmt: 150, settled: false } } };
  const draft = { ...prior, amount: 550, note: "tweaked" };
  const result = checkRepresentability({ operation: "edit", draft, priorStoredRecord: prior });
  assert.equal(result.representable, true, "settlement bookkeeping fields (settledAmt/remainingAmt/settled) must not be mistaken for a person-share change");
});

test("a person-share mode with no domain equivalent (e.g. \"spent_on\") is NOT_YET_REPRESENTABLE on create", () => {
  const result = checkRepresentability({
    operation: "create",
    draft: { type: "expense", accId: "acc-1", amount: 500, people: { p1: { amount: 500, mode: "spent_on" } } },
  });
  assert.equal(result.representable, false);
  assert.equal(result.code, NOT_YET_REPRESENTABLE);
});

test("a pre-existing unrepresentable person-share mode on the prior record blocks edit too", () => {
  const prior = { id: "t1", type: "expense", accId: "acc-1", amount: 500, people: { p1: { amount: 500, mode: "spent_on" } } };
  const draft = { ...prior, note: "just a note change" };
  const result = checkRepresentability({ operation: "edit", draft, priorStoredRecord: prior });
  assert.equal(result.representable, false);
  assert.equal(result.code, NOT_YET_REPRESENTABLE);
});

test("transfer type is out of scope regardless of shape", () => {
  const result = checkRepresentability({
    operation: "create",
    draft: { type: "transfer", fromAccId: "acc-1", toAccId: "acc-2", amount: 500 },
  });
  assert.equal(result.representable, false);
  assert.equal(result.code, NOT_YET_REPRESENTABLE);
});
