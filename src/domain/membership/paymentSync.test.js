import test from "node:test";
import assert from "node:assert/strict";
import { withMembershipPaymentSynced } from "./paymentSync.js";

const base = { txnId: "t1", membershipId: "m1", amount: 3500, accId: "b2", catId: "fitness" };

test("the expense the membership created follows an edit of amount, account and category", () => {
  const out = withMembershipPaymentSynced([{ id: "t1", linkedMembershipId: "m1", amount: 3000, accId: "b1", catId: "health", catIds: ["health"], date: "2026-10-14" }], base);
  assert.deepEqual(out[0], { id: "t1", linkedMembershipId: "m1", amount: 3500, accId: "b2", catId: "fitness", catIds: ["fitness"], date: "2026-10-14" });
});

test("a transaction the user linked by hand is never rewritten", () => {
  const manual = { id: "t1", amount: 3000, accId: "b1", catId: "health" };
  assert.deepEqual(withMembershipPaymentSynced([manual], base), [manual]);
});

test("a transaction linked to a different membership, or another transaction, is untouched", () => {
  const other = { id: "t2", linkedMembershipId: "m1", amount: 1 };
  const wrong = { id: "t1", linkedMembershipId: "m9", amount: 2 };
  assert.deepEqual(withMembershipPaymentSynced([other, wrong], base), [other, wrong]);
});

test("missing input is safe", () => {
  assert.deepEqual(withMembershipPaymentSynced(undefined, base), []);
});
