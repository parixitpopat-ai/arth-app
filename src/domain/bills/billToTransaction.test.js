import test from "node:test";
import assert from "node:assert/strict";
import { canConvertBillToTxn, billToExpense } from "./billToTransaction.js";

const bill = (over = {}) => ({ id: "b1", name: "Store purchase", merchant: "Big Store", amount: 4999, status: "unpaid", billDate: "2026-11-10", dueDate: "2026-11-25", catId: "shopping", catIds: ["shopping"], splitPeople: {}, ...over });

test("a plain unpaid one-off bill can be converted", () => assert.deepEqual(canConvertBillToTxn(bill()), { ok: true }));
test("refuses: card statement, paid, cancelled, linked payment", () => {
  for (const b of [bill({ isCcStatement: true }), bill({ status: "paid" }), bill({ status: "cancelled" }), bill({ paidByTxnId: "t9" })]) assert.equal(canConvertBillToTxn(b).ok, false);
});
test("refuses a bill with part paid (a contribution), but not one with another bill's contribution", () => {
  assert.equal(canConvertBillToTxn(bill(), [{ obligationType: "bill", obligationId: "b1", amount: 10 }]).ok, false);
  assert.equal(canConvertBillToTxn(bill(), [{ obligationType: "bill", obligationId: "other", amount: 10 }]).ok, true);
});
test("refuses a connection bill, a recurring bill, a split bill, a group bill, and no amount", () => {
  assert.equal(canConvertBillToTxn(bill({ billerAccountId: "ba1" })).ok, false);
  assert.equal(canConvertBillToTxn(bill({ recurring: true })).ok, false);
  assert.equal(canConvertBillToTxn(bill({ splitPeople: { p2: { amount: 500, mode: "owes" } } })).ok, false);
  assert.equal(canConvertBillToTxn(bill({ groupId: "g1" })).ok, false);
  assert.equal(canConvertBillToTxn(bill({ amount: 0 })).ok, false);
  assert.ok(canConvertBillToTxn(bill({ billerAccountId: "ba1" })).reason.length > 10);
});
test("the expense carries amount, name, merchant, category and the chosen account and date", () => {
  const t = billToExpense({ bill: bill({ subId: "s1", invoiceNo: "INV-7" }), accId: "cc1", date: "2026-11-10", genId: () => "t-new", now: 5 });
  assert.deepEqual([t.id, t.type, t.amount, t.accId, t.date, t.merchant, t.desc, t.catId, t.catIds, t.subId, t.subIds], ["t-new", "expense", 4999, "cc1", "2026-11-10", "Big Store", "Store purchase", "shopping", ["shopping"], "s1", ["s1"]]);
  assert.match(t.note, /Moved from a bill \(invoice INV-7\)/);
});
test("a photo on the bill is kept; none is invented", () => {
  assert.equal(billToExpense({ bill: bill({ imageBase64: "data:image/jpeg;base64,AAA" }), accId: "cc1", date: "2026-11-10", genId: () => "x" }).imageBase64, "data:image/jpeg;base64,AAA");
  assert.equal("imageBase64" in billToExpense({ bill: bill(), accId: "cc1", date: "2026-11-10", genId: () => "x" }), false);
});
test("does not change the bill it was made from", () => {
  const b = bill(); const copy = JSON.stringify(b); billToExpense({ bill: b, accId: "cc1", date: "2026-11-10", genId: () => "x" }); assert.equal(JSON.stringify(b), copy);
});
