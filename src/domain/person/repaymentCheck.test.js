import test from "node:test";
import assert from "node:assert/strict";
import { findRepaymentProblems, applyRepaymentFix, undoRepaymentFix } from "./repaymentCheck.js";
import { getFinancialPositionBreakdown } from "./financialPosition.js";

const owes = (amount, settledAmt = 0, extra = {}) => ({ amount, mode: "owes", settled: settledAmt >= amount, settledAmt, remainingAmt: Math.max(0, amount - settledAmt), ...extra });
const owed = (txns, bills, pid = "r") => getFinancialPositionBreakdown(pid, txns, bills, "me").filter(i => i.mode === "owesMe").reduce((s, i) => s + Math.round(i.amount * 100), 0) / 100;

// invented: Ravi owes 1,000 on a PAID water bill (the live split is on its payment entry) and 800 on a plain expense
const bills = () => [{ id: "b2", name: "Water", billDate: "2026-07-27", paidByTxnId: "tw", status: "paid", splitPeople: { r: owes(1000, 1000, { settled: true }) } }];   // stale copy: already settled
const txns = () => [
  { id: "tw", type: "expense", date: "2026-08-02", desc: "Water", amount: 3000, paidBillId: "b2", people: { r: owes(1000) } },                  // live share: NOT reduced
  { id: "e1", type: "expense", date: "2026-07-04", desc: "Plumber", amount: 800, people: { r: owes(800) } },
  { id: "s1", type: "settlement_in", isRefund: false, date: "2026-08-10", desc: "Ravi settled water", amount: 1000, appliedAmount: 1000, extraAmount: 0, fromPersonId: "r", settlementLinks: [{ kind: "bill", id: "b2", personId: "r", amount: 1000 }] },
  { id: "s2", type: "settlement_in", isRefund: false, date: "2026-08-12", desc: "Ravi paid plumber", amount: 800, appliedAmount: 0, extraAmount: 800, fromPersonId: "r", settlementLinks: [] },   // saved without choosing an item
];

test("both problems are found: a linked repayment whose live share was never reduced, and an unlinked repayment with its exact-amount item", () => {
  const f = findRepaymentProblems({ personId: "r", txns: txns(), bills: bills() });
  assert.equal(f.unreduced.length, 1);
  assert.deepEqual([f.unreduced[0].recordKind, f.unreduced[0].recordId, f.unreduced[0].shareAmount, f.unreduced[0].settledNow, f.unreduced[0].settleTo, f.unreduced[0].diff], ["txn", "tw", 1000, 0, 1000, 1000]);
  assert.equal(f.unlinked.length, 1);
  assert.deepEqual([f.unlinked[0].amount, f.unlinked[0].suggested.id, f.unlinked[0].suggested.remaining, f.unlinked[0].ambiguous], [800, "e1", 800, false]);
});
test("applying the 'unreduced' fix raises the live share only; what he owes drops by it; undo puts it back exactly", () => {
  const T = txns(), B = bills();
  assert.equal(owed(T, B), 1800);                                   // 1,000 water + 800 plumber, both still showing as owed
  const f = findRepaymentProblems({ personId: "r", txns: T, bills: B }).unreduced[0];
  const r = applyRepaymentFix({ txns: T, bills: B }, { type: "unreduced", personId: "r", recordKind: f.recordKind, recordId: f.recordId, settleTo: f.settleTo });
  const tw = r.txns.find(t => t.id === "tw");
  assert.deepEqual([tw.people.r.settledAmt, tw.people.r.remainingAmt, tw.people.r.settled], [1000, 0, true]);
  assert.equal(owed(r.txns, r.bills), 800);
  assert.deepEqual(r.txns.find(t => t.id === "s1"), T.find(t => t.id === "s1"));      // the repayment itself is untouched
  const back = undoRepaymentFix(r, r.undo);
  assert.deepEqual(back.txns, T); assert.deepEqual(back.bills, B);
  assert.equal(findRepaymentProblems({ personId: "r", txns: r.txns, bills: r.bills }).unreduced.length, 0);        // nothing left to fix
});
test("linking an unlinked repayment to an item: the repayment gains the link, the share is reduced, no money entry is created; undo restores", () => {
  const T = txns(), B = bills();
  const s = findRepaymentProblems({ personId: "r", txns: T, bills: B }).unlinked[0];
  const r = applyRepaymentFix({ txns: T, bills: B }, { type: "link", personId: "r", repaymentId: s.id, link: { kind: s.suggested.kind, id: s.suggested.id, amount: s.amount, title: s.suggested.title } });
  const rep = r.txns.find(t => t.id === "s2"), e1 = r.txns.find(t => t.id === "e1");
  assert.deepEqual([rep.settlementLinks.length, rep.settlementLinks[0].id, rep.appliedAmount, rep.extraAmount, rep.amount], [1, "e1", 800, 0, 800]);
  assert.deepEqual([e1.people.r.settledAmt, e1.people.r.settled], [800, true]);
  assert.equal(r.txns.length, T.length);
  assert.equal(owed(r.txns, r.bills), 1000);                         // only the (unfixed) water share is left
  const back = undoRepaymentFix(r, r.undo);
  assert.deepEqual(back.txns, T);
});
test("more than one open item with the exact amount is ambiguous: nothing is suggested", () => {
  const T = [{ id: "a", type: "expense", date: "2026-07-01", desc: "A", amount: 858.4, people: { r: owes(858.4) } }, { id: "b", type: "expense", date: "2026-08-01", desc: "B", amount: 858.4, people: { r: owes(858.4) } },
    { id: "s", type: "settlement_in", isRefund: false, date: "2026-08-05", amount: 858.4, fromPersonId: "r", settlementLinks: [] }];
  const u = findRepaymentProblems({ personId: "r", txns: T, bills: [] }).unlinked[0];
  assert.deepEqual([u.suggested, u.ambiguous, u.candidates.length], [null, true, 2]);
});
test("two repayments of the same amount do not both claim one item", () => {
  const T = [{ id: "a", type: "expense", date: "2026-07-01", desc: "A", amount: 500, people: { r: owes(500) } },
    { id: "s1", type: "settlement_in", isRefund: false, date: "2026-08-05", amount: 500, fromPersonId: "r", settlementLinks: [] }, { id: "s2", type: "settlement_in", isRefund: false, date: "2026-08-06", amount: 500, fromPersonId: "r", settlementLinks: [] }];
  const u = findRepaymentProblems({ personId: "r", txns: T, bills: [] }).unlinked;
  assert.deepEqual(u.map(x => x.suggested && x.suggested.id), ["a", null]);
});
test("a repayment bigger than the item raises it only to its share; the rest stays as an advance on the repayment", () => {
  const T = [{ id: "a", type: "expense", date: "2026-07-01", desc: "A", amount: 800, people: { r: owes(800) } }, { id: "s", type: "settlement_in", isRefund: false, date: "2026-08-05", amount: 1181, fromPersonId: "r", settlementLinks: [] }];
  const r = applyRepaymentFix({ txns: T, bills: [] }, { type: "link", personId: "r", repaymentId: "s", link: { kind: "txn", id: "a", amount: 1181, title: "A" } });
  assert.deepEqual([r.txns.find(t => t.id === "a").people.r.settledAmt, r.txns.find(t => t.id === "s").settlementLinks[0].amount, r.txns.find(t => t.id === "s").extraAmount], [800, 800, 381]);
});
test("nothing to fix, refunds, repayments from others, and shares moved away are all ignored; a fix that no longer applies returns null", () => {
  const T = [{ id: "a", type: "expense", date: "2026-07-01", desc: "A", amount: 800, people: { r: owes(800, 800) } },
    { id: "rf", type: "settlement_in", isRefund: true, date: "2026-08-05", amount: 100, fromPersonId: "r", settlementLinks: [] }, { id: "o", type: "settlement_in", isRefund: false, date: "2026-08-05", amount: 100, fromPersonId: "s", settlementLinks: [] },
    { id: "ok", type: "settlement_in", isRefund: false, date: "2026-08-05", amount: 800, fromPersonId: "r", settlementLinks: [{ kind: "txn", id: "a", personId: "r", amount: 800 }] }];
  const f = findRepaymentProblems({ personId: "r", txns: T, bills: [] });
  assert.deepEqual([f.unreduced.length, f.unlinked.length], [0, 0]);
  assert.equal(applyRepaymentFix({ txns: T, bills: [] }, { type: "link", personId: "r", repaymentId: "ok", link: { kind: "txn", id: "a", amount: 800 } }), null);       // already linked
  assert.equal(applyRepaymentFix({ txns: T, bills: [] }, { type: "unreduced", personId: "r", recordKind: "txn", recordId: "missing", settleTo: 1 }), null);
});

test("a loan receipt (money received against a loan) is never listed as a repayment that was not applied", () => {
  const txns = [
    { id: "lr", type: "settlement_in", isRefund: false, date: "2026-07-11", desc: "Loan receipt - Raj", amount: 1500, fromPersonId: "r", linkedLoanId: "loan1", settlementLinks: [] },
    { id: "rp", type: "settlement_in", isRefund: false, date: "2026-07-12", desc: "Raj paid", amount: 800, fromPersonId: "r", settlementLinks: [] },
  ];
  const r = findRepaymentProblems({ personId: "r", txns, bills: [] });
  assert.deepEqual(r.unlinked.map(u => u.id), ["rp"]);
});
