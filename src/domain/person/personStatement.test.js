import test from "node:test";
import assert from "node:assert/strict";
import { buildPersonStatement, buildFamilyStatement, reconcileWithPosition } from "./personStatement.js";

// invented family: Ravi (r), Sunny (s), Mangal (m), Guru (g). Bills are recorded under Ravi. The family paid 2,000 on 5 Aug as ONE payment, applied to the members who owe.
const names = { r: "Ravi", s: "Sunny", m: "Mangal", g: "Guru" };
const nameOf = id => names[id] || id;
const owes = (amount, settledAmt = 0, extra = {}) => ({ amount, mode: "owes", settled: settledAmt >= amount, settledAmt, remainingAmt: Math.max(0, amount - settledAmt), ...extra });
const BILLS = [
  { id: "b1", name: "Electricity", billDate: "2026-07-27", dueDate: "2026-09-09", billPeriodFrom: "2026-06-10", billPeriodTo: "2026-07-25", billerAccountId: "ba-el", status: "unpaid", splitPeople: { r: owes(3000, 1000) } },
  { id: "b2", name: "Water", billDate: "2026-07-27", dueDate: "2026-08-02", billPeriodFrom: "2026-06-26", billPeriodTo: "2026-07-24", billerAccountId: "ba-wa", status: "paid", paidByTxnId: "tw", splitPeople: { r: owes(1000) } },   // stale copy: the payment entry holds the live one
  { id: "b3", name: "Maintenance: lift service", billDate: "2026-08-02", dueDate: "2026-08-20", billerAccountId: "ba-mt", status: "unpaid", splitPeople: { r: owes(1200) } },
];
const TXNS = [
  { id: "tw", type: "expense", date: "2026-08-02", desc: "Water", amount: 3000, paidBillId: "b2", people: { r: owes(1000, 650) } },
  { id: "e1", type: "expense", date: "2026-07-04", desc: "Plumber", amount: 800, people: { r: owes(800) } },
  { id: "e2", type: "expense", date: "2026-07-12", desc: "Repair", amount: 350, people: { s: owes(350, 350) } },
  { id: "e3", type: "expense", date: "2026-07-08", desc: "Gate fix", amount: 150, people: { g: owes(150, 150, { transferredTo: "r" }) } },
  { id: "e4", type: "expense", date: "2026-08-20", who: "Transferred from Guru", desc: "", note: "Debt transferred from Guru", amount: 150, people: { r: owes(150) } },
  { id: "pay1", type: "settlement_in", date: "2026-08-05", amount: 2000, fromGroupId: "fam", settlementLinks: [
    { kind: "group-bill", id: "b1", personId: "r", amount: 1000 }, { kind: "group-bill", id: "b2", personId: "r", amount: 650 }, { kind: "group-txn", id: "e2", personId: "s", amount: 350 }] },
];
const labelOf = c => (c.billId ? c.title.split(":")[0] : "Own expenses");
const args = { txns: TXNS, bills: BILLS, from: "2026-07-01", to: "2026-08-31", nameOf, labelOf };

test("Ravi: charges by type, which bill each payment went to, paid and still due on every charge", () => {
  const st = buildPersonStatement({ personId: "r", ...args });
  assert.equal(st.opening, 0);
  assert.deepEqual(st.sections.map(x => [x.label, x.subtotal]), [["Own expenses", 950], ["Electricity", 3000], ["Water", 1000], ["Maintenance", 1200]]);   // own = plumber 800 + transferred from Guru 150
  const item = t => st.sections.flatMap(x => x.items).find(i => i.title === t);
  assert.deepEqual([item("Electricity").amount, item("Electricity").paid, item("Electricity").due, item("Electricity").billDate, item("Electricity").dueDate, item("Electricity").periodFrom, item("Electricity").periodTo], [3000, 1000, 2000, "2026-07-27", "2026-09-09", "2026-06-10", "2026-07-25"]);
  assert.deepEqual([item("Water").amount, item("Water").paid, item("Water").due], [1000, 650, 350]);    // a paid bill: its share is on the payment entry, counted once
  assert.deepEqual([item("Maintenance: lift service").paid, item("Maintenance: lift service").due], [0, 1200]);
  assert.equal(st.sections.flatMap(x => x.items).find(i => i.transferredFrom === "Guru").amount, 150);
  assert.equal(st.chargesTotal, 6150); assert.equal(st.paymentsTotal, 1650); assert.equal(st.closing, 4500);
  assert.equal(st.payments.length, 1);
  assert.deepEqual(st.payments[0].applied.map(a => [a.title, a.amount]), [["Electricity", 1000], ["Water", 650]]);
});
test("Sunny: only the part of the family payment applied to him; Mangal: nothing", () => {
  const s = buildPersonStatement({ personId: "s", ...args });
  assert.deepEqual([s.chargesTotal, s.paymentsTotal, s.closing, s.settled], [350, 350, 0, true]);
  const m = buildPersonStatement({ personId: "m", ...args });
  assert.deepEqual([m.chargesTotal, m.paymentsTotal, m.closing, m.sections.length], [0, 0, 0, 0]);
});
test("Guru: a debt moved to Ravi is a MOVE, not a payment, and leaves nothing due", () => {
  const g = buildPersonStatement({ personId: "g", ...args });
  assert.deepEqual([g.chargesTotal, g.movedTotal, g.paymentsTotal, g.closing], [150, 150, 0, 0]);
  assert.deepEqual([g.moved[0].to, g.moved[0].on, g.moved[0].amount], ["r", "2026-08-20", 150]);       // dated by the transfer entry
});
test("the family: sum of its members; a move inside the family changes nothing; the closing equals the sum", () => {
  const f = buildFamilyStatement({ memberIds: ["r", "s", "m", "g"], groupId: "fam", ...args });
  assert.deepEqual([f.chargesTotal, f.movedWithinFamily, f.movedTotal, f.paymentsTotal, f.closing], [6500, 150, 0, 2000, 4500]);
  assert.deepEqual(f.members.map(m => m.closing), [4500, 0, 0, 0]);
  assert.deepEqual(f.unapplied, []);
});
test("a family payment with no member linked is listed as not applied and changes no member's balance", () => {
  const extra = { id: "pay2", type: "settlement_in", date: "2026-08-10", amount: 500, fromGroupId: "fam", settlementLinks: [] };
  const f = buildFamilyStatement({ memberIds: ["r", "s", "m", "g"], groupId: "fam", ...args, txns: [...TXNS, extra] });
  assert.deepEqual(f.unapplied.map(u => [u.id, u.amount]), [["pay2", 500]]);
  assert.equal(f.closing, 4500);
});
test("brought forward: earlier charges less earlier payments; a payment before the start date reduces it", () => {
  const st = buildPersonStatement({ personId: "r", ...args, from: "2026-08-01" });          // plumber (4 Jul) and the two 27 Jul bills are earlier
  assert.equal(st.opening, 800 + 3000 + 1000);
  assert.equal(st.chargesTotal, 1200 + 150);
  assert.equal(st.closing, 4500);
  const late = buildPersonStatement({ personId: "r", ...args, from: "2026-08-06" });          // the 5 Aug payment is now before the start
  assert.equal(late.opening, 800 + 3000 + 1000 + 1200 - 1650); assert.equal(late.closing, 4500);
});
test("paid and still due are as of the end date: a payment after it is not counted", () => {
  const st = buildPersonStatement({ personId: "r", ...args, to: "2026-08-04" });
  const el = st.sections.flatMap(x => x.items).find(i => i.title === "Electricity");
  assert.deepEqual([el.paid, el.due], [0, 3000]); assert.equal(st.paymentsTotal, 0);
});
test("the person's own repayment (Settle on a bill): applied to that bill; extra is kept as an advance credit; one with no bill is shown as such", () => {
  const bills = [{ id: "bx", name: "Electricity", billDate: "2026-07-27", splitPeople: { r: owes(1000) } }];
  const txns = [
    { id: "s1", type: "settlement_in", date: "2026-08-01", amount: 1200, appliedAmount: 1000, extraAmount: 200, fromPersonId: "r", settlementLinks: [{ kind: "bill", id: "bx", personId: "r", amount: 1000 }] },
    { id: "s2", type: "settlement_in", date: "2026-08-03", amount: 100, appliedAmount: 100, fromPersonId: "r", settlementLinks: [] },
  ];
  const st = buildPersonStatement({ personId: "r", txns, bills, from: "2026-07-01", to: "2026-08-31", nameOf, labelOf });
  assert.equal(st.sections[0].items[0].paid, 1000);
  assert.deepEqual(st.payments.map(p => [p.id, p.amount]), [["s1", 1200], ["s2", 100]]);
  assert.ok(st.payments[0].applied.some(a => a.advance && a.amount === 200)); assert.ok(st.payments[1].applied[0].noBill);
  assert.equal(st.closing, -300); assert.equal(st.credit, 300);
});
test("a refund is not a payment and a non-owing share is not a charge", () => {
  const txns = [{ id: "rf", type: "settlement_in", isRefund: true, date: "2026-08-01", amount: 500, fromPersonId: "r", settlementLinks: [{ kind: "txn", id: "x", personId: "r", amount: 500 }] },
    { id: "x", type: "expense", date: "2026-07-02", amount: 500, people: { r: { amount: 500, mode: "owes_by_me" } } }];
  const st = buildPersonStatement({ personId: "r", txns, bills: [], from: "2026-07-01", to: "2026-08-31", nameOf, labelOf });
  assert.deepEqual([st.chargesTotal, st.paymentsTotal], [0, 0]);
});
test("the statement's closing equals what the person's page shows owed (the safeguard)", () => {
  for (const id of ["r", "s", "m", "g"]) {
    const st = buildPersonStatement({ personId: id, ...args });
    const rc = reconcileWithPosition(st, { txns: TXNS, bills: BILLS, meId: "me" });
    assert.equal(rc.matches, true, `${id}: statement ${rc.closing} vs page ${rc.pageOwesMe}`);
  }
});
test("amounts never drift: shares in odd paise add up exactly", () => {
  const bills = [{ id: "b", name: "Water", billDate: "2026-07-27", splitPeople: { r: owes(777.78), s: owes(933.33) } }];
  const a = buildPersonStatement({ personId: "r", txns: [], bills, from: "2026-07-01", to: "2026-07-31", nameOf, labelOf });
  const b = buildPersonStatement({ personId: "s", txns: [], bills, from: "2026-07-01", to: "2026-07-31", nameOf, labelOf });
  assert.equal(Math.round((a.closing + b.closing) * 100), 171111);
});
