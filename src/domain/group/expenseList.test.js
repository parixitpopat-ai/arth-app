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
