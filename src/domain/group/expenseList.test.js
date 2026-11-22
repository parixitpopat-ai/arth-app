import test from "node:test";
import assert from "node:assert/strict";
import { buildGroupExpenseList } from "./expenseList.js";
import { buildGroupExpenseMessage } from "./expenseMessage.js";

const nameOf = id => ({ r: "Raj", m: "Mangal", me: "Me" }[id] || id);
const base = { groupId: "g1", memberIds: ["r", "m"], from: "2026-11-01", to: "2026-11-30", nameOf };
const txns = [
  { id: "t1", type: "expense", desc: "Electricity", date: "2026-11-05", amount: 3000, groupId: "g1", people: { r: { amount: 1000, mode: "owes" }, m: { amount: 1000, mode: "owes", settled: true } } },
  { id: "t2", type: "expense", desc: "Party snacks", date: "2026-11-10", amount: 1200, groupId: "g1", groupCollectiveAmount: 1200 },            // tagged to the group, no member split
  { id: "t3", type: "expense", desc: "Other group", date: "2026-11-11", amount: 500, groupId: "g2" },
  { id: "t4", type: "expense", desc: "Old", date: "2026-10-30", amount: 700, groupId: "g1" },
  { id: "t5", type: "expense", desc: "Refund", date: "2026-11-12", amount: 100, groupId: "g1", isRefund: true },
  { id: "t6", type: "expense", desc: "Water bill", date: "2026-11-15", amount: 600, groupId: "g1", isBillPayment: true, paidBillId: "b1", paidBillName: "Water bill", people: { r: { amount: 200, mode: "owes" } } },
  { id: "t7", type: "income", desc: "Salary", date: "2026-11-02", amount: 9, groupId: "g1" },
];
const bills = [
  { id: "b1", name: "Water bill", amount: 600, billDate: "2026-11-14", groupId: "g1", status: "paid", paidByTxnId: "t6" },
  { id: "b2", name: "Internet", amount: 900, billDate: "2026-11-20", groupId: "g1", status: "unpaid", splitPeople: { r: { amount: 300, mode: "owes" }, m: { amount: 300, mode: "owes" } } },
  { id: "b3", name: "Elsewhere", amount: 50, billDate: "2026-11-20", groupId: "g2", status: "unpaid" },
  { id: "b4", name: "Cancelled", amount: 50, billDate: "2026-11-21", groupId: "g1", status: "cancelled" },
];
test("every expense tagged to the group in the period is listed, with or without a member split; others are not", () => {
  const r = buildGroupExpenseList({ ...base, txns, bills });
  assert.deepEqual(r.items.map(i => i.title), ["Electricity", "Party snacks", "Water bill", "Internet"]);
  assert.equal(r.totals.count, 4); assert.equal(r.totals.total, 3000 + 1200 + 600 + 900);
});
test("shares: who owes what, what is still open, and the person's own part", () => {
  const e = buildGroupExpenseList({ ...base, txns, bills }).items[0];
  assert.deepEqual(e.shares.map(s => [s.name, s.amount, s.remaining]), [["Raj", 1000, 1000], ["Mangal", 1000, 0]]);
  assert.equal(e.memberTotal, 2000); assert.equal(e.due, 1000); assert.equal(e.yourShare, 1000); assert.equal(e.payer, "you");
});
test("an expense tagged to the group as a whole has no member shares but keeps its group amount", () => {
  const s = buildGroupExpenseList({ ...base, txns, bills }).items[1];
  assert.deepEqual([s.shares.length, s.total, s.groupAmount, s.yourShare], [0, 1200, 1200, null]);
});
test("a paid bill is its payment entry (not listed twice); an unpaid bill is listed from its split; cancelled and other groups are not", () => {
  const r = buildGroupExpenseList({ ...base, txns, bills });
  assert.equal(r.items.filter(i => /Water/.test(i.title)).length, 1);
  const net = r.items.find(i => i.title === "Internet"); assert.deepEqual([net.kind, net.payer, net.due, net.shares.length], ["bill", "not paid yet", 600, 2]);
  assert.equal(r.items.some(i => /Elsewhere|Cancelled|Other group|Refund|Salary|Old/.test(i.title)), false);
});
test("a bill paid outside the period is not re-listed as unpaid, and an empty or strange input gives an empty list", () => {
  const r = buildGroupExpenseList({ ...base, from: "2026-11-18", to: "2026-11-30", txns, bills });
  assert.deepEqual(r.items.map(i => i.title), ["Internet"]);
  assert.deepEqual(buildGroupExpenseList({ ...base, txns: undefined, bills: undefined }).totals, { count: 0, total: 0, memberTotal: 0, due: 0 });
  assert.doesNotThrow(() => buildGroupExpenseList({ ...base, txns: [null, {}], bills: [undefined] }));
});
test("the message lists the ticked items with each member's share, then the totals and the UPI line", () => {
  const items = buildGroupExpenseList({ ...base, txns, bills }).items.map(i => ({ ...i, on: i.title !== "Internet" }));
  const m = buildGroupExpenseMessage(items, { groupName: "Flat", from: base.from, to: base.to, upiHandle: "me@upi" });
  assert.match(m, /^Flat · expenses/); assert.match(m, /Electricity - 3000 \(Raj 1000, Mangal 1000, you 1000\)/); assert.match(m, /Party snacks - 1200/);
  assert.match(m, /Total expenses = 4800/); assert.match(m, /Still to be paid by members = 1200/); assert.match(m, /Pay to: me@upi/);
  assert.doesNotMatch(m, /Internet/);
  assert.equal(buildGroupExpenseMessage(items.map(i => ({ ...i, on: false })), {}), "");
});

import { categorySplit } from "./expenseList.js";
import { buildCategoryBreakup } from "./categoryBreakup.js";
test("an expense without line items goes whole to its category; with none it is 'no category'", () => {
  assert.deepEqual(categorySplit({ catId: "food" }, 100000), [{ catId: "food", amount: 1000, labels: [] }]);
  assert.deepEqual(categorySplit({}, 50000), [{ catId: null, amount: 500, labels: [] }]);
  assert.deepEqual(categorySplit({ catIds: ["a", "b"] }, 50000), [{ catId: "a", amount: 500, labels: [] }]);
});
test("line items count by their own category and amount; what is left (tax, rounding) goes to the main category; it always adds up", () => {
  const t = { catId: "groc", lineItems: [{ label: "Rice", qty: 2, unitPrice: 100, catId: "groc" }, { label: "Soap", qty: 1, unitPrice: 50, catId: "home" }, { label: "Bag", qty: 1, unitPrice: 20 }] };
  const r = categorySplit(t, 30000);   // total 300: groc 200 + home 50, 50 left -> main (groc)
  assert.deepEqual(r.map(x => [x.catId, x.amount]).sort(), [["groc", 250], ["home", 50]]);
  assert.equal(r.reduce((s, x) => s + x.amount, 0), 300);
});
test("line items that add up to more than the expense are not trusted", () => {
  assert.deepEqual(categorySplit({ catId: "x", lineItems: [{ qty: 1, unitPrice: 500, catId: "y" }] }, 30000).map(c => [c.catId, c.amount]), [["x", 300]]);
});
test("the break-up adds the ticked items by category, biggest first, no-category last, with shares and the entries behind each", () => {
  const cats = [{ id: "food", name: "Food", icon: "🍔" }, { id: "util", name: "Utilities", icon: "💡" }];
  const items = [
    { key: "a", title: "Electricity", date: "2026-11-05", categories: [{ catId: "util", amount: 3000, labels: [] }] },
    { key: "b", title: "Party", date: "2026-11-10", categories: [{ catId: "food", amount: 700, labels: ["Cake"] }, { catId: null, amount: 100, labels: [] }] },
    { key: "c", title: "Dinner", date: "2026-11-12", categories: [{ catId: "food", amount: 200, labels: [] }] },
  ];
  const b = buildCategoryBreakup(items, cats);
  assert.deepEqual(b.rows.map(r => [r.name, r.amount, r.pct]), [["Utilities", 3000, 75], ["Food", 900, 22.5], ["No category", 100, 2.5]]);
  assert.equal(b.total, 4000); assert.deepEqual(b.rows[1].entries.map(e => e.title), ["Party", "Dinner"]); assert.deepEqual(b.rows[1].entries[0].labels, ["Cake"]);
  assert.deepEqual(buildCategoryBreakup([], cats), { rows: [], total: 0 });
  assert.equal(buildCategoryBreakup([{ key: "z", title: "x", date: "2026-11-01", categories: [{ catId: "gone", amount: 5 }] }], cats).rows[0].name, "Other category");
});
test("the message adds a By category section with the shares", () => {
  const items = buildGroupExpenseList({ ...base, txns: [{ id: "q", type: "expense", desc: "Lunch", date: "2026-11-05", amount: 400, groupId: "g1", catId: "food" }], bills: [] }).items.map(i => ({ ...i, on: true }));
  const m = buildGroupExpenseMessage(items, { groupName: "Flat", from: base.from, to: base.to, breakup: buildCategoryBreakup(items, [{ id: "food", name: "Food" }]) });
  assert.match(m, /By category:\nFood - 400 \(100%\)/);
});
