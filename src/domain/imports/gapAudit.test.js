import test from "node:test";
import assert from "node:assert/strict";
import { matchStatement } from "./matchStatement.js";
import { auditStatementGap } from "./gapAudit.js";

const row = (date, amountPaise, desc, k) => ({ date, amountPaise, desc, importKey: k || `${date}|${amountPaise}|${desc}` });
const ex = (id, date, amount, merchant, accId = "cc1") => ({ id, type: "expense", date, amount, merchant, desc: merchant, accId });
const audit = (rows, txns, o = {}) => {
  const m = matchStatement(rows, { transactions: txns, accountId: "cc1", importedKeys: [], linkedIds: [] });
  return auditStatementGap({ results: m.results, transactions: txns, accountId: "cc1", from: "2026-10-17", to: "2026-11-16", accountName: id => ({ bank1: "Savings", cc1: "Card" }[id] || ""), ...o });
};
// Arth amount = charges on the card less refunds; the statement total is given
const arthOf = txns => txns.reduce((s, t) => s + (t.accId === "cc1" && t.type === "expense" ? t.amount : 0) - (t.accId === "cc1" && t.type === "settlement_in" && t.isRefund ? t.amount : 0), 0);

test("everything agrees: no gap, no lines", () => {
  const txns = [ex("a", "2026-10-20", 1000, "A"), ex("b", "2026-10-25", 500, "B")];
  const r = audit([row("2026-10-20", -100000, "A"), row("2026-10-25", -50000, "B")], txns, { bankAmount: 1500, arthAmount: arthOf(txns) });
  assert.equal(r.gapPaise, 0); assert.deepEqual(r.lines, []); assert.equal(r.notExplainedPaise, 0);
});
test("a purchase recorded on ANOTHER account: the file has it, the card total lacks it", () => {
  const txns = [ex("a", "2026-10-20", 1000, "A"), ex("b", "2026-10-25", 1725, "B", "bank1")];
  const r = audit([row("2026-10-20", -100000, "A"), row("2026-10-25", -172500, "B")], txns, { bankAmount: 2725, arthAmount: arthOf(txns) });
  assert.equal(r.gapPaise, 172500);
  assert.deepEqual(r.lines.map(l => [l.id, l.paise]), [["other", 172500]]);
  assert.equal(r.lines[0].items[0].where, "Savings"); assert.equal(r.lines[0].items[0].txnId, "b");
  assert.equal(r.notExplainedPaise, 0);
});
test("a refund recorded on the card that the statement has not credited", () => {
  const txns = [ex("a", "2026-10-20", 1000, "A"), { id: "r", type: "settlement_in", isRefund: true, date: "2026-11-02", amount: 1725, accId: "cc1", merchant: "Refund" }];
  const r = audit([row("2026-10-20", -100000, "A")], txns, { bankAmount: 1000, arthAmount: arthOf(txns) });
  assert.equal(r.gapPaise, 172500);
  assert.deepEqual(r.lines.map(l => [l.id, l.paise]), [["refunds", 172500]]);
  assert.equal(r.notExplainedPaise, 0);
});
test("an entry on the card that the statement does not have lowers the gap (Arth counts more than the bank)", () => {
  const txns = [ex("a", "2026-10-20", 1000, "A"), ex("x", "2026-10-28", 300, "Extra")];
  const r = audit([row("2026-10-20", -100000, "A")], txns, { bankAmount: 1000, arthAmount: arthOf(txns) });
  assert.equal(r.gapPaise, -30000);
  assert.deepEqual(r.lines.map(l => [l.id, l.paise]), [["extra", -30000]]);
  assert.equal(r.notExplainedPaise, 0);
});
test("a statement purchase Arth does not have, plus the carry-over printed on the statement", () => {
  const txns = [ex("a", "2026-10-20", 1000, "A")];
  const r = audit([row("2026-10-20", -100000, "A"), row("2026-10-22", -25000, "NEW")], txns, { bankAmount: 1250 + 400, arthAmount: 1000, summary: { previousBalancePaise: 40000, paymentsPaise: 0 } });
  assert.equal(r.gapPaise, 65000);
  assert.deepEqual(r.lines.map(l => [l.id, l.paise]), [["carry", 40000], ["new", 25000]]);
  assert.equal(r.notExplainedPaise, 0);
});
test("anything the lines cannot account for is reported as not explained, never hidden", () => {
  const txns = [ex("a", "2026-10-20", 1000, "A")];
  const r = audit([row("2026-10-20", -100000, "A")], txns, { bankAmount: 1100, arthAmount: 1000 });
  assert.equal(r.gapPaise, 10000); assert.deepEqual(r.lines, []); assert.equal(r.notExplainedPaise, 10000);
});
test("the user's shape: all 77 rows matched, the whole gap sits in one named place", () => {
  const txns = [ex("a", "2026-10-20", 95000, "Big"), ex("z", "2026-11-01", 1725, "Misplaced", "bank1")];
  const r = audit([row("2026-10-20", -9500000, "Big"), row("2026-11-01", -172500, "Misplaced")], txns, { bankAmount: 96725, arthAmount: 95000 });
  assert.equal(r.gapPaise, 172500); assert.equal(r.lines.length, 1); assert.equal(r.lines[0].id, "other"); assert.equal(r.notExplainedPaise, 0);
});
test("does not change its inputs", () => {
  const txns = [ex("a", "2026-10-20", 1000, "A")]; const copy = JSON.stringify(txns);
  audit([row("2026-10-20", -100000, "A")], txns, { bankAmount: 1000, arthAmount: 1000 }); assert.equal(JSON.stringify(txns), copy);
});
