// T-34: the rules that decide what an itemised payment writes. Pure; the Add form only displays this plan and saves it.
import test from "node:test";
import assert from "node:assert/strict";
import { planItemBillLinks, withItemBillContributions, getDroppedItemBills, isItemBillContribution } from "./itemBillLinks.js";
import { getBillBalance } from "./billBalance.js";

let n = 0; const gen = () => `c${++n}`;
const bill = (id, amount, extra = {}) => ({ id, name: `Bill ${id}`, amount, status: "unpaid", ...extra });
const items = [{ id: "i1", amount: 3800 }, { id: "i2", amount: 2500 }, { id: "i3", amount: 900 }];

test("each linked item applies its own amount to its bill; an unlinked item is not in the plan", () => {
  const plan = planItemBillLinks({ items, links: { i1: "bT", i2: "bU" }, bills: [bill("bT", 3800), bill("bU", 2500)], contributions: [] });
  assert.equal(plan.i1.applied, 3800);
  assert.equal(plan.i2.applied, 2500);
  assert.equal(plan.i3, undefined);
});

test("an item cannot apply more than the bill still owes; the rest is unallocated", () => {
  const plan = planItemBillLinks({ items: [{ id: "a", amount: 1200 }], links: { a: "b" }, bills: [bill("b", 800)], contributions: [] });
  assert.equal(plan.a.applied, 800);
  assert.equal(plan.a.unallocated, 400);
});

test("several items may pay one bill, and together they never overpay it (earlier items count)", () => {
  const plan = planItemBillLinks({ items: [{ id: "a", amount: 700 }, { id: "b", amount: 600 }], links: { a: "s", b: "s" }, bills: [bill("s", 1000)], contributions: [] });
  assert.equal(plan.a.applied, 700);
  assert.equal(plan.b.applied, 300);
  assert.equal(plan.b.unallocated, 300);
});

test("what other payments already paid reduces what an item can apply", () => {
  const others = [{ obligationType: "bill", obligationId: "s", txnId: "other", amount: 600 }];
  const plan = planItemBillLinks({ items: [{ id: "a", amount: 700 }], links: { a: "s" }, bills: [bill("s", 1000)], contributions: others });
  assert.equal(plan.a.applied, 400);
});

test("saving writes one Contribution per applying item, tagged with its item, and the bill is derived from them", () => {
  const cs = withItemBillContributions([], { txnId: "t1", txnAmount: 6300, items, links: { i1: "bT", i2: "bU" }, bills: [bill("bT", 3800), bill("bU", 2500)] }, gen);
  assert.deepEqual(cs.map(c => [c.obligationId, c.lineItemId, c.amount]), [["bT", "i1", 3800], ["bU", "i2", 2500]]);
  assert.equal(getBillBalance(bill("bT", 3800), cs).status, "paid");
});

test("saving again replaces this transaction's item contributions; other contributions are untouched", () => {
  const other = { id: "z", obligationType: "bill", obligationId: "bT", txnId: "other", amount: 100 };
  const whole = { id: "w", obligationType: "bill", obligationId: "bW", txnId: "t1", amount: 50 }; // no lineItemId
  const first = withItemBillContributions([other, whole], { txnId: "t1", txnAmount: 6300, items, links: { i1: "bT" }, bills: [bill("bT", 3800)] }, gen);
  assert.ok(first.includes(other) && first.includes(whole));
  assert.equal(first.filter(c => isItemBillContribution(c, "t1")).length, 1);
  assert.equal(first.find(c => c.lineItemId === "i1").amount, 3700);   // 100 already paid by the other payment
  const second = withItemBillContributions(first, { txnId: "t1", txnAmount: 6300, items, links: {}, bills: [bill("bT", 3800)] }, gen);
  assert.equal(second.filter(c => isItemBillContribution(c, "t1")).length, 0);
  assert.ok(second.includes(other) && second.includes(whole));
});

test("a bill only an unlinked item paid is reported as dropped; one another payment also pays is not", () => {
  const prev = [
    { obligationType: "bill", obligationId: "a", txnId: "t1", lineItemId: "i1", amount: 10 },
    { obligationType: "bill", obligationId: "b", txnId: "t1", lineItemId: "i2", amount: 10 },
    { obligationType: "bill", obligationId: "b", txnId: "other", amount: 5 },
  ];
  assert.deepEqual(getDroppedItemBills({ prev, txnId: "t1", links: {}, items: [{ id: "i1" }, { id: "i2" }] }), ["a"]);
  assert.deepEqual(getDroppedItemBills({ prev, txnId: "t1", links: { i1: "a" }, items: [{ id: "i1" }, { id: "i2" }] }), []);
});

test("a transaction with no item links writes nothing and keeps behaviour for records without lineItemId", () => {
  const plain = { id: "p", obligationType: "bill", obligationId: "b", txnId: "t1", amount: 500 };
  assert.deepEqual(withItemBillContributions([plain], { txnId: "t1", txnAmount: 500, items: [], links: {}, bills: [] }, gen), [plain]);
});
