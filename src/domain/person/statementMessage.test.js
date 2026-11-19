import test from "node:test";
import assert from "node:assert/strict";
import { buildStatementMessage, shortDate, periodLabel } from "./statementMessage.js";

const st = (o = {}) => ({ from: "2026-07-01", to: "2026-08-31", opening: 0, sections: [{ label: "Electricity", subtotal: 3000 }, { label: "Water", subtotal: 1000 }, { label: "Own expenses", subtotal: 950 }], movedTotal: 0, paymentsTotal: 1650, closing: 3300, settled: false, credit: 0, ...o });
const fmt = n => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test("dates", () => {
  assert.equal(shortDate("2026-08-05"), "5 Aug"); assert.equal(shortDate("2026-08-05", true), "5 Aug 2026"); assert.equal(shortDate(""), "");
  assert.equal(periodLabel("2026-06-10", "2026-07-25"), "10 Jun – 25 Jul"); assert.equal(periodLabel("2026-06-10", ""), "");
});
test("the message: sections, paid, balance due, and the pay-to line", () => {
  const m = buildStatementMessage(st(), { name: "Ravi", fmt, upiHandle: "sample@upi" });
  assert.equal(m, ["Hi Ravi, statement 1 Jul 2026 – 31 Aug 2026:", "Electricity ₹3,000.00", "Water ₹1,000.00", "Own expenses ₹950.00", "Paid −₹1,650.00", "Balance due ₹3,300.00", "Pay to: sample@upi"].join("\n"));
});
test("brought forward and moved-away lines appear only when there is something", () => {
  const m = buildStatementMessage(st({ opening: 500, movedTotal: 150 }), { name: "Ravi", fmt });
  assert.match(m, /Brought forward ₹500\.00/); assert.match(m, /Moved to someone else −₹150\.00/);
  assert.doesNotMatch(buildStatementMessage(st(), { name: "Ravi", fmt }), /Brought forward|Moved/);
});
test("settled and credit: no balance due and no pay-to line", () => {
  const a = buildStatementMessage(st({ closing: 0, settled: true }), { name: "Sunny", fmt, upiHandle: "sample@upi" });
  assert.match(a, /settled/); assert.doesNotMatch(a, /Pay to/);
  const b = buildStatementMessage(st({ closing: -300, credit: 300 }), { name: "Ravi", fmt, upiHandle: "sample@upi" });
  assert.match(b, /Credit in your favour ₹300\.00/); assert.doesNotMatch(b, /Pay to|Balance due/);
});
test("no UPI handle saved: the pay-to line is left off, never invented", () => {
  assert.doesNotMatch(buildStatementMessage(st(), { name: "Ravi", fmt }), /Pay to/);
});

import { buildFamilyStatement } from "./personStatement.js";
import { buildFamilyMessage } from "./statementMessage.js";
test("the family message: sections added up across members, a move inside the family netted out, who owes what, and the pay-to line", () => {
  const owes = (amount, settledAmt = 0, extra = {}) => ({ amount, mode: "owes", settled: settledAmt >= amount, settledAmt, remainingAmt: Math.max(0, amount - settledAmt), ...extra });
  const bills = [{ id: "b1", name: "Electricity", billDate: "2026-07-27", billerAccountId: "ba-el", splitPeople: { r: owes(3000, 1000) } }, { id: "b3", name: "Maintenance", billDate: "2026-08-02", billerAccountId: "ba-mt", splitPeople: { r: owes(1200) } }];
  const txns = [
    { id: "e1", type: "expense", date: "2026-07-04", desc: "Plumber", amount: 800, people: { r: owes(800) } },
    { id: "e2", type: "expense", date: "2026-07-12", desc: "Repair", amount: 350, people: { s: owes(350, 350) } },
    { id: "e3", type: "expense", date: "2026-07-08", desc: "Gate fix", amount: 150, people: { g: owes(150, 150, { transferredTo: "r" }) } },
    { id: "e4", type: "expense", date: "2026-08-20", desc: "Transferred", note: "Debt transferred from Guru", amount: 150, people: { r: owes(150) } },
    { id: "pay1", type: "settlement_in", isRefund: false, date: "2026-08-05", amount: 1350, fromGroupId: "fam", settlementLinks: [{ kind: "group-bill", id: "b1", personId: "r", amount: 1000 }, { kind: "group-txn", id: "e2", personId: "s", amount: 350 }] },
  ];
  const nameOf = id => ({ r: "Ravi", s: "Sunny", m: "Mangal", g: "Guru" })[id];
  const labelOf = c => (c.billerAccountId === "ba-el" ? "Electricity" : c.billerAccountId === "ba-mt" ? "Society Maintenance" : "Own expenses");
  const fam = buildFamilyStatement({ memberIds: ["r", "s", "m", "g"], groupId: "fam", txns, bills, from: "2026-07-01", to: "2026-08-31", nameOf, labelOf });
  const m = buildFamilyMessage(fam, { groupName: "Suryamandal", nameOf, fmt: n => Number(n).toFixed(2), upiHandle: "sample@upi" });
  assert.equal(m, ["Hi, statement for the Suryamandal family, 1 Jul 2026 – 31 Aug 2026:", "Own expenses ₹1300.00", "Electricity ₹3000.00", "Society Maintenance ₹1200.00", "Paid by the family −₹1350.00", "Balance due ₹4150.00", "By person: Ravi ₹4150.00", "Pay to: sample@upi"].join("\n"));
  // own expenses: plumber 800 + repair 350 + gate fix 150 + "transferred from Guru" 150, less the 150 that moved inside the family = 1,300; balance 3,000 + 1,200 + 1,450 − 150 − 1,350 = 4,150 (all Ravi's)
});

import { plainAmount, statementLines, familyLines, buildSimpleMessage } from "./statementMessage.js";
test("plain amounts: whole numbers have no decimals, others have two", () => {
  assert.deepEqual([135, 1177.8, 1089, 3045, 360, 0.1 + 0.2].map(plainAmount), ["135", "1177.80", "1089", "3045", "360", "0.30"]);
});
test("the simple list is exactly 'Item - amount' lines and a total, for the ticked items only", () => {
  const lines = [["Common Meter Bill", 135], ["PWD bill", 1177.8], ["New water Bill", 1089], ["Electricity bill", 3045], ["Coffee", 360], ["Left out", 999]].map(([title, due], i) => ({ key: `k${i}`, title, due, amount: due, paid: 0, on: title !== "Left out", prefix: "" }));
  assert.equal(buildSimpleMessage(lines), ["Common Meter Bill - 135", "PWD bill - 1177.80", "New water Bill - 1089", "Electricity bill - 3045", "Coffee - 360", "", "Total = 5806.80"].join("\n"));
  assert.match(buildSimpleMessage(lines, { upiHandle: "sample@upi" }), /\nPay to: sample@upi$/);
  assert.equal(buildSimpleMessage(lines.map(l => ({ ...l, on: false }))), "");
  assert.equal(buildSimpleMessage(lines.map(l => ({ ...l, on: l.title === "Coffee" })).map(l => ({ ...l, due: 0.1 + l.due - l.due }))), "Coffee - 0.10\n\nTotal = 0.10");
});
test("lines come from a statement at what is still due: a fully paid item starts unticked; brought forward is offered", () => {
  const st = { personId: "r", opening: 500, sections: [{ label: "Electricity", items: [{ kind: "bill", id: "b1", title: "Electricity", amount: 3000, paid: 1000, due: 2000 }, { kind: "bill", id: "b2", title: "Water", amount: 1000, paid: 1000, due: 0 }, { kind: "txn", id: "e4", title: "x", transferredFrom: "Guru", amount: 150, paid: 0, due: 150 }] }] };
  const ls = statementLines(st);
  assert.deepEqual(ls.map(l => [l.title, l.due, l.ticked]), [["Brought forward", 500, true], ["Electricity", 2000, true], ["Water", 0, false], ["Transferred from Guru", 150, true]]);
  const msg = buildSimpleMessage(ls.map(l => ({ ...l, on: l.ticked })));
  assert.equal(msg, ["Brought forward - 500", "Electricity - 2000", "Transferred from Guru - 150", "", "Total = 2650"].join("\n"));
});
test("a family list names each member's lines", () => {
  const mk = (id, due) => ({ personId: id, opening: 0, sections: [{ label: "X", items: [{ kind: "bill", id: `b${id}`, title: "Electricity", amount: due, paid: 0, due }] }] });
  const ls = familyLines({ members: [mk("r", 3000), mk("s", 2000)] }, id => ({ r: "Ravi", s: "Sunny" })[id]);
  assert.equal(buildSimpleMessage(ls.map(l => ({ ...l, on: true })), { withNames: true }), ["Ravi: Electricity - 3000", "Sunny: Electricity - 2000", "", "Total = 5000"].join("\n"));
});
