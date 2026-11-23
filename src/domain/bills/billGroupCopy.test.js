import test from "node:test";
import assert from "node:assert/strict";
import { billClaim, copyFromBill, restoreCollect, findPaymentsMissingBillGroup, applyBillGroupFixes } from "./billGroupCopy.js";

const bill = { id: "b1", name: "Goa Electricity", amount: 4000, groupId: "g1", status: "paid", paidByTxnId: "p1", groupCollectiveAmount: 3445, splitPeople: { x: { amount: 300, mode: "owes" }, y: { amount: 255, mode: "owes" } } };
const empty = { id: "p1", type: "expense", amount: 4000, date: "2026-07-12", paidBillId: "b1", paidBillName: "Goa Electricity" };

test("a bill carries a claim only when it has a collect amount or people who owe; otherwise nothing", () => {
  assert.equal(billClaim({ id: "b", groupId: "g1" }), null);
  assert.equal(billClaim(null), null);
  assert.deepEqual(billClaim(bill), { groupId: "g1", collective: 3445, people: bill.splitPeople });
});
test("an empty payment takes the bill's group, collect amount and people, marked as a split", () => {
  const p = copyFromBill(bill, empty);
  assert.equal(p.groupId, "g1"); assert.equal(p.groupCollectiveAmount, 3445); assert.equal(p.trackingMode, "split"); assert.deepEqual(p.people, bill.splitPeople); assert.equal(p.billGroupCopied, true);
});
test("never overwrites: an entry with its own group, people, collect amount or person gets nothing; later payments get nothing", () => {
  for (const own of [{ groupId: "g9" }, { people: { z: { amount: 5, mode: "owes" } } }, { groupCollectiveAmount: 10 }, { forPerson: "x" }, { groupAllocations: [{ groupId: "g2", amount: 1, mode: "owes" }] }]) assert.deepEqual(copyFromBill(bill, { ...empty, ...own }), {}, JSON.stringify(own));
  assert.deepEqual(copyFromBill(bill, empty, { isFirst: false }), {});
  assert.deepEqual(copyFromBill({ id: "b2" }, empty), {});
});
test("a payment in the bill's group that lost its collect amount (marked only tag) gets it back; one that is already a split does not", () => {
  const lost = { ...empty, groupId: "g1", trackingMode: "tag", groupCollectiveAmount: 0 };
  const r = restoreCollect(bill, lost);
  assert.equal(r.groupCollectiveAmount, 3445); assert.equal(r.trackingMode, "split");
  assert.deepEqual(restoreCollect(bill, { ...lost, trackingMode: "split" }), {});
  assert.deepEqual(restoreCollect(bill, { ...lost, groupId: "g2" }), {});
});
test("the review list: only the bill's first payment, only what changes something; fixed and already-owned entries are not offered", () => {
  const bills = [bill, { ...bill, id: "b2", name: "Water", paidByTxnId: "p2", groupCollectiveAmount: 788, splitPeople: {} }, { ...bill, id: "b3", paidByTxnId: "p3" }];
  const txns = [empty,
    { id: "p2", type: "expense", amount: 788, date: "2026-07-14", paidBillId: "b2", groupId: "g1", trackingMode: "tag", groupCollectiveAmount: 0 },
    { id: "p3", type: "expense", amount: 3900, date: "2026-08-10", paidBillId: "b3", groupId: "g9", groupCollectiveAmount: 5, trackingMode: "split" },
    { id: "p4", type: "expense", amount: 100, date: "2026-07-20", paidBillId: "b1" }];   // a later payment of b1
  const f = findPaymentsMissingBillGroup(txns, bills);
  assert.deepEqual(f.map(x => [x.txnId, x.kind]).sort(), [["p1", "copy"], ["p2", "collect"]]);
  const done = applyBillGroupFixes(txns, bills, ["p1", "p2"]);
  assert.equal(done.find(t => t.id === "p1").groupCollectiveAmount, 3445);
  assert.equal(done.find(t => t.id === "p2").groupCollectiveAmount, 788);
  assert.equal(done.find(t => t.id === "p3").groupId, "g9");          // untouched
  assert.equal(done.find(t => t.id === "p4").groupId, undefined);     // a later payment, untouched
  assert.deepEqual(findPaymentsMissingBillGroup(done, bills), []);    // nothing left to fix
  assert.deepEqual(applyBillGroupFixes(txns, bills, ["p3"]).find(t => t.id === "p3"), txns[2]);   // an id that no longer applies writes nothing
  assert.deepEqual(findPaymentsMissingBillGroup(null, null), []);
});

test("'I already paid this' (applyAllocations) copies the bill's group onto an empty payment, but not onto one that has its own", async () => {
  const { applyAllocations } = await import("./billAllocation.js");
  const open = { id: "b7", name: "Goa Electricity", amount: 4000, groupId: "g1", status: "unpaid", groupCollectiveAmount: 3445, splitPeople: {} };
  let n = 0; const genId = () => `c${++n}`;
  const r = applyAllocations({ txn: { id: "t1", type: "expense", amount: 4000, date: "2026-07-12" }, allocations: [{ billId: "b7", applied: 4000 }], bills: [open], contributions: [], genId });
  assert.equal(r.txnPatch.groupId, "g1"); assert.equal(r.txnPatch.groupCollectiveAmount, 3445); assert.equal(r.txnPatch.paidBillId, "b7");
  const own = applyAllocations({ txn: { id: "t2", type: "expense", amount: 4000, date: "2026-07-12", groupId: "g9" }, allocations: [{ billId: "b7", applied: 4000 }], bills: [open], contributions: [], genId });
  assert.equal(own.txnPatch.groupId, undefined); assert.equal(own.txnPatch.paidBillId, "b7");
});

test("prefill rows: the group's amount to collect and each person who owes, in the form's own row shape; nothing for a bill that carries nothing", async () => {
  const { prefillRowsFromBill } = await import("./billGroupCopy.js");
  assert.deepEqual(prefillRowsFromBill(bill), [
    { targetType: "group", targetId: "g1", mode: "owes", amount: "3445" },
    { targetType: "person", targetId: "x", mode: "owes", amount: "300" },
    { targetType: "person", targetId: "y", mode: "owes", amount: "255" },
  ]);
  assert.deepEqual(prefillRowsFromBill({ id: "b", groupId: "g1" }), []);
  assert.deepEqual(prefillRowsFromBill(null), []);
});
