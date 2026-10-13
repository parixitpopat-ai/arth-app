// UI-2C WP-5 (T-34): an itemised payment links a Bill from one item. The optional lineItemId on a Contribution, and the
// per-item check next to amount <= txnAmount. No lineItemId = the whole transaction is one item, exactly as before.
import test from "node:test";
import assert from "node:assert/strict";
import { createContribution, withNewContribution, ContributionValidationError, getLineItemAmount, getLineItemContributed, getLineItemUnallocated } from "./contribution.js";
import { withBillContributionForTxn } from "./billContributionSync.js";
import { getBillBalance, getBillLedger, getTxnUnallocated } from "./billBalance.js";

let n = 0; const gen = () => `c${++n}`;
const base = { obligationType: "bill", obligationId: "b1", txnId: "t1", txnAmount: 6300 };
const txn = { id: "t1", amount: 6300, lineItems: [{ id: "i1", qty: 1, unitPrice: 3800 }, { id: "i2", qty: 1, unitPrice: 2500 }] };

test("without lineItemId the record is unchanged (no new key)", () => {
  const c = createContribution({ ...base, amount: 3800 }, gen);
  assert.deepEqual(Object.keys(c).sort(), ["amount", "createdAt", "id", "obligationId", "obligationType", "txnId"]);
});

test("with a lineItemId the record carries it, and an item amount is required", () => {
  const c = createContribution({ ...base, amount: 3800, lineItemId: "i1", lineItemAmount: 3800 }, gen);
  assert.equal(c.lineItemId, "i1");
  assert.throws(() => createContribution({ ...base, amount: 3800, lineItemId: "i1" }, gen), ContributionValidationError);
  assert.throws(() => createContribution({ ...base, amount: 3800, lineItemId: "  ", lineItemAmount: 3800 }, gen), ContributionValidationError);
});

test("a contribution cannot be worth more than its item, alongside the existing txn-amount check", () => {
  assert.throws(() => createContribution({ ...base, amount: 4000, lineItemId: "i1", lineItemAmount: 3800 }, gen), /line item/);
  assert.throws(() => createContribution({ ...base, amount: 7000, lineItemId: "i1", lineItemAmount: 9000 }, gen), /transaction/);
});

test("an item's contributions together cannot exceed the item", () => {
  const first = withNewContribution([], { ...base, amount: 2000, lineItemId: "i1", lineItemAmount: 3800 }, gen);
  const second = withNewContribution(first, { ...base, obligationId: "b2", amount: 1800, lineItemId: "i1", lineItemAmount: 3800 }, gen);
  assert.equal(getLineItemContributed(second, "t1", "i1"), 3800);
  assert.throws(() => withNewContribution(second, { ...base, obligationId: "b3", amount: 1, lineItemId: "i1", lineItemAmount: 3800 }, gen), /exceed/);
});

test("T-34: the tuition item pays the Bill, the uniform item does not; the uniform stays unallocated", () => {
  const cs = withNewContribution([], { ...base, amount: 3800, lineItemId: "i1", lineItemAmount: 3800 }, gen);
  assert.equal(getBillBalance({ id: "b1", amount: 3800, status: "unpaid" }, cs).status, "paid");
  assert.equal(getLineItemUnallocated(txn, "i1", cs), 0);
  assert.equal(getLineItemUnallocated(txn, "i2", cs), 2500);
  assert.equal(getLineItemAmount(txn.lineItems[0]), 3800);
});

test("two items of one payment can each pay the same Bill; both count (one payment per item, not collapsed)", () => {
  let cs = withNewContribution([], { ...base, amount: 3800, lineItemId: "i1", lineItemAmount: 3800 }, gen);
  cs = withNewContribution(cs, { ...base, amount: 2500, lineItemId: "i2", lineItemAmount: 2500 }, gen);
  const bal = getBillBalance({ id: "b1", amount: 6300, status: "unpaid" }, cs);
  assert.equal(bal.paid, 6300);
  assert.equal(bal.status, "paid");
  assert.equal(getBillLedger({ id: "b1", amount: 6300, status: "unpaid" }, cs, [txn]).rows.length, 2);
  assert.equal(getTxnUnallocated(txn, cs), 0);
});

test("a whole-transaction contribution (no item) still counts once per payment, as before", () => {
  const dup = [
    { id: "x1", obligationType: "bill", obligationId: "b1", txnId: "t1", amount: 500 },
    { id: "x2", obligationType: "bill", obligationId: "b1", txnId: "t1", amount: 500 },
  ];
  assert.equal(getBillBalance({ id: "b1", amount: 1000, status: "unpaid" }, dup).paid, 500);
});

test("the Bill upsert replaces only that item's contribution when an item is given", () => {
  let cs = withBillContributionForTxn([], { billId: "b1", txnId: "t1", amount: 3800, txnAmount: 6300, lineItemId: "i1", lineItemAmount: 3800 }, gen);
  cs = withBillContributionForTxn(cs, { billId: "b1", txnId: "t1", amount: 2500, txnAmount: 6300, lineItemId: "i2", lineItemAmount: 2500 }, gen);
  assert.equal(cs.length, 2);
  cs = withBillContributionForTxn(cs, { billId: "b1", txnId: "t1", amount: 3000, txnAmount: 6300, lineItemId: "i1", lineItemAmount: 3800 }, gen);
  assert.equal(cs.length, 2);
  assert.equal(cs.find(c => c.lineItemId === "i1").amount, 3000);
  assert.equal(cs.find(c => c.lineItemId === "i2").amount, 2500);
  // and with no item the old behaviour: one contribution for the pair
  const whole = withBillContributionForTxn(withBillContributionForTxn([], { billId: "b9", txnId: "t9", amount: 100, txnAmount: 100 }, gen), { billId: "b9", txnId: "t9", amount: 80, txnAmount: 100 }, gen);
  assert.equal(whole.length, 1);
  assert.equal(whole[0].amount, 80);
});
