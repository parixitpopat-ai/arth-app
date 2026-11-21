import { test } from "node:test";
import assert from "node:assert/strict";
import { loanCandidate, previewConversion, convertCollectToLoan } from "./collectToLoan.js";

let n = 0; const genId = () => `id${++n}`;
const owes = (amount, extra = {}) => ({ amount, mode: "owes", settled: false, settledAmt: 0, remainingAmt: amount, ...extra });
const exp = (extra = {}) => ({ id: "e1", type: "expense", date: "2026-07-04", desc: "Cash to Raj", amount: 15000, accId: "bank1", catId: "family", catIds: ["family"], note: "for rent", people: { r: owes(15000) }, ...extra });
const receipt = (id, amount, date, extra = {}) => ({ id, type: "settlement_in", isRefund: false, date, desc: "Raj paid", amount, appliedAmount: amount, extraAmount: 0, accId: "bank1", fromPersonId: "r", settlementLinks: [{ kind: "txn", id: "e1", personId: "r", amount, title: "Cash to Raj" }], ...extra });

test("one person owing the whole amount, paid from an account, qualifies", () => {
  const c = loanCandidate(exp()); assert.equal(c.ok, true); assert.equal(c.personId, "r"); assert.equal(c.amount, 15000);
});
test("it is refused, with a plain reason, when it is not a clean handover", () => {
  const why = e => loanCandidate(e).reason;
  assert.match(why(exp({ people: { r: owes(9000) } })), /WHOLE amount/);                          // part of it is my own spending
  assert.match(why(exp({ people: { r: owes(7500), s: owes(7500) } })), /one person/);
  assert.match(why(exp({ people: { r: { amount: 15000, mode: "i_owe" } } })), /one person/);
  assert.match(why(exp({ people: { r: owes(15000, { transferredTo: "s" }) } })), /moved to someone else/);
  assert.match(why(exp({ groupId: "g1" })), /group or a bill/);
  assert.match(why(exp({ lineItems: [{ id: "l" }] })), /itemised/);
  assert.match(why(exp({ paidByPersonId: "r", accId: null })), /Someone else paid/);
  assert.match(why(exp({ accId: "" })), /not paid from/);
  assert.match(why(exp({ isLoanDisbursal: true })), /already a loan/);
  assert.match(why({ id: "x", type: "income", amount: 5 }), /expense/);
  assert.match(loanCandidate(exp(), { lendable: false }).reason, /not paid from/);                // e.g. paid on a credit card
});
test("an entry with nothing paid back becomes a loan of the full amount; the entry becomes the money-out entry with the SAME id, date and account", () => {
  const r = convertCollectToLoan({ txn: exp(), txns: [exp()], personName: "Raj Test", dueDate: "2027-02-01", interestRate: "12", genId, now: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.loan.principal, 15000); assert.equal(r.loan.outstanding, 15000); assert.equal(r.loan.direction, "given"); assert.equal(r.loan.dueDate, "2027-02-01"); assert.equal(r.loan.interestRate, 12); assert.equal(r.loan.startDate, "2026-07-04");
  const t = r.txns.find(x => x.id === "e1");
  assert.equal(t.type, "transfer"); assert.equal(t.fromAccId, "bank1"); assert.equal(t.toAccId, null); assert.equal(t.isLoanDisbursal, true); assert.equal(t.linkedLoanId, r.loan.id);
  assert.equal(t.date, "2026-07-04"); assert.deepEqual(t.catIds, []); assert.deepEqual(t.people, {}); assert.equal(t.note, "Money lent · for rent");
});
test("money already paid back is kept: each linked repayment becomes a loan receipt on the loan and the loan starts with what is still unpaid", () => {
  const e = exp({ people: { r: owes(15000, { settledAmt: 1500, settled: false }) } });
  const s = receipt("s1", 1500, "2026-07-11");
  const r = convertCollectToLoan({ txn: e, txns: [e, s], personName: "Raj Test", genId, now: 1 });
  assert.equal(r.ok, true); assert.equal(r.loan.outstanding, 13500); assert.equal(r.loan.status, "active");
  assert.deepEqual(r.loan.repayments.map(x => [x.amount, x.date, x.txnId]), [[1500, "2026-07-11", "s1"]]);
  const s2 = r.txns.find(x => x.id === "s1");
  assert.deepEqual(s2.settlementLinks, []); assert.equal(s2.linkedLoanId, r.loan.id); assert.equal(s2.amount, 1500); assert.equal(s2.accId, "bank1"); assert.equal(s2.fromPersonId, "r"); assert.equal(s2.desc, "Loan receipt - Raj Test");
});
test("paid but with no receipt recorded: it is added to the loan as a repayment with no money entry", () => {
  const e = exp({ people: { r: owes(15000, { settledAmt: 4000 }) } });
  const s = receipt("s1", 1500, "2026-07-11");
  const r = convertCollectToLoan({ txn: e, txns: [e, s], personName: "Raj", genId, now: 1 });
  assert.equal(r.loan.outstanding, 11000);
  assert.deepEqual(r.loan.repayments.map(x => x.amount), [1500, 2500]);
  assert.equal(r.txns.filter(t => t.type === "settlement_in").length, 1);                         // no money entry was invented
});
test("fully paid back: the loan is closed", () => {
  const e = exp({ people: { r: owes(15000, { settled: true, settledAmt: 15000 }) } });
  const r = convertCollectToLoan({ txn: e, txns: [e, receipt("s1", 15000, "2026-08-01")], personName: "Raj", genId, now: 1 });
  assert.equal(r.loan.outstanding, 0); assert.equal(r.loan.status, "closed"); assert.equal(r.loan.closedDate, "2026-08-01");
});
test("a repayment that also covers something else is refused, not guessed", () => {
  const e = exp({ people: { r: owes(15000, { settledAmt: 1500 }) } });
  const shared = receipt("s1", 2000, "2026-07-11", { settlementLinks: [{ kind: "txn", id: "e1", personId: "r", amount: 1500 }, { kind: "bill", id: "b9", personId: "r", amount: 500 }] });
  assert.match(previewConversion({ txn: e, txns: [e, shared] }).reason, /also covers something else/);
});
test("the preview says what converting does; spending does not change because the entry already counted as owed to me", () => {
  const pv = previewConversion({ txn: exp({ people: { r: owes(15000, { settledAmt: 1500 }) } }), txns: [exp(), receipt("s1", 1500, "2026-07-11")] });
  assert.equal(pv.ok, true); assert.equal(pv.paid, 1500); assert.equal(pv.outstanding, 13500); assert.deepEqual(pv.spendDrop, { amount: 0, date: "2026-07-04", catIds: ["family"] });   // already not my spending: the person owes the whole amount
});
test("a bad return date or interest is refused; a missing person is refused", () => {
  const base = { txn: exp(), txns: [exp()], personName: "Raj", genId, now: 1 };
  assert.match(convertCollectToLoan({ ...base, dueDate: "2026-07-01" }).reason, /before the date/);
  assert.match(convertCollectToLoan({ ...base, interestRate: "150" }).reason, /Interest/);
  assert.match(convertCollectToLoan({ ...base, personName: " " }).reason, /who this was lent to/);
});
