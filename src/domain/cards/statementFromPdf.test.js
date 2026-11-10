import test from "node:test";
import assert from "node:assert/strict";
import { planStatementBillFromPdf } from "./statementFromPdf.js";

const toDateOnly = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d, 12); };
const card = { id: "cc1", name: "Test Card", type: "cc", statementDate: 16, dueDate: 3 };
const ex = (id, date, amount, accId = "cc1") => ({ id, type: "expense", date, amount, accId });
const summary = { totalDuePaise: 5189744, dueDate: "2026-11-03", periodFrom: "2026-09-17", periodTo: "2026-10-16", statementDate: "2026-10-16" };
let n = 0; const genId = () => "g" + ++n;
const run = (over = {}) => planStatementBillFromPdf({ card, accounts: [card], txns: [], bills: [], summary, toDateOnly, genId, today: "2026-11-10", ...over });

test("plan: creates the bill for the printed cycle; Arth counts entries AFTER the day before the first day, up to the closing day", () => {
  const txns = [ex("a", "2026-09-16", 999), ex("b", "2026-09-17", 40000), ex("c", "2026-10-16", 11897.44), ex("d", "2026-10-17", 777), ex("e", "2026-10-01", 5, "bank1")];
  const p = run({ txns });
  assert.equal(p.ok, true); assert.equal(p.action, "create");
  assert.equal(p.periodFrom, "2026-09-16"); assert.equal(p.periodTo, "2026-10-16");
  assert.equal(p.arthAmount, 51897.44); assert.equal(p.bankAmount, 51897.44); assert.equal(p.difference, 0);
  assert.equal(p.bill.isCcStatement, true); assert.equal(p.bill.accId, "cc1"); assert.equal(p.bill.dueDate, "2026-11-03"); assert.equal(p.bill.status, "unpaid");
  assert.equal(p.bill.verification, "matched"); assert.equal(p.bill.bankAmount, 51897.44); assert.deepEqual(p.notes, []);
});
test("plan: a gap is recorded as a mismatch, never hidden; the difference is the bank's figure minus Arth's", () => {
  const p = run({ txns: [ex("b", "2026-09-20", 51247.44)] });
  assert.equal(p.arthAmount, 51247.44); assert.equal(p.difference, 650); assert.equal(p.bill.verification, "mismatch");
});
test("plan: an existing bill for the same statement (period end within 3 days) is updated in place, with an adjustment note; a different statement is not touched", () => {
  const old = { id: "b1", isCcStatement: true, accId: "cc1", periodFrom: "2026-09-15", periodTo: "2026-10-15", arthAmount: 14706.39, amount: 14706.39, dueDate: "2026-11-02", status: "unpaid", verification: "needs_verification", bankAmount: null, adjustments: [] };
  const p = run({ bills: [old, { ...old, id: "b0", periodTo: "2026-09-15" }], txns: [ex("b", "2026-09-20", 51897.44)] });
  assert.equal(p.action, "update"); assert.equal(p.bill.id, "b1"); assert.equal(p.prev, old);
  assert.equal(p.bill.periodTo, "2026-10-16"); assert.equal(p.bill.arthAmount, 51897.44); assert.equal(p.bill.dueDate, "2026-11-03");
  assert.deepEqual(p.bill.adjustments, [{ at: "2026-11-10", from: 14706.39, to: 51897.44 }]); assert.equal(p.bill.verification, "matched");
  assert.equal(old.arthAmount, 14706.39);                                  // the input is not mutated
});
test("plan: setting it twice is 'unchanged'; a paid bill keeps its status; refusals have plain reasons; a wrong statement day is noted", () => {
  const first = run({ txns: [ex("b", "2026-09-20", 51897.44)] });
  assert.equal(run({ txns: [ex("b", "2026-09-20", 51897.44)], bills: [first.bill] }).action, "unchanged");
  assert.equal(run({ txns: [ex("b", "2026-09-20", 51897.44)], bills: [{ ...first.bill, status: "paid" }] }).bill.status, "paid");
  assert.match(planStatementBillFromPdf({ card, accounts: [card], txns: [], bills: [], summary: {}, toDateOnly, genId, today: "2026-11-10" }).reason, /total due/);
  assert.match(planStatementBillFromPdf({ card, accounts: [card], txns: [], bills: [], summary: { totalDuePaise: 1 }, toDateOnly, genId, today: "2026-11-10" }).reason, /closing date/);
  assert.match(planStatementBillFromPdf({ card: { id: "b", type: "bank" }, accounts: [], txns: [], bills: [], summary, toDateOnly, genId, today: "2026-11-10" }).reason, /not a credit card/);
  const wrongDay = run({ card: { ...card, statementDate: 15 }, accounts: [{ ...card, statementDate: 15 }], txns: [ex("b", "2026-09-20", 1)] });
  assert.match(wrongDay.notes[0], /closed on day 16.*statement day in Arth is 15/);
});
