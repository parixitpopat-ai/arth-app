import test from "node:test";
import assert from "node:assert/strict";
import { matchStatement, DAY_WINDOW } from "./matchStatement.js";
import { unmatchedInArth, newCredits } from "./arthOnly.js";

const row = (date, amountPaise, desc = "x", k) => ({ date, amountPaise, desc, importKey: k || `${date}|${amountPaise}|${desc}` });
const tx = (id, date, amount, extra = {}) => ({ id, type: "expense", date, amount, accId: "cc1", merchant: `shop ${id}`, ...extra });
const run = (rows, txns, o = {}) => { const m = matchStatement(rows, { transactions: txns, accountId: "cc1", importedKeys: [], linkedIds: [] }); return unmatchedInArth({ results: m.results, transactions: txns, accountId: "cc1", from: "2026-10-17", to: "2026-11-16", lastRowDate: "2026-11-12", ...o }); };

test("entries the file matched are not flagged; an Arth entry nothing in the file matches is", () => {
  const r = run([row("2026-10-20", -100000), row("2026-10-25", -50000)], [tx("a", "2026-10-20", 1000), tx("b", "2026-10-26", 500), tx("c", "2026-10-28", 777.5)]);
  assert.deepEqual(r.arthOnly.map(x => x.id), ["c"]);
  assert.equal(r.arthOnly[0].amountPaise, -77750); assert.equal(r.arthOnly[0].label, "shop c");
});
test("the same date window as the preview: two days apart is a match, three is not", () => {
  assert.equal(DAY_WINDOW, 2);
  assert.equal(run([row("2026-10-20", -100000)], [tx("a", "2026-10-22", 1000)]).arthOnly.length, 0);
  assert.equal(run([row("2026-10-20", -100000)], [tx("a", "2026-10-23", 1000)]).arthOnly.length, 1);
});
test("two identical file rows do not both hide behind one Arth entry, and one file row does not hide two Arth entries", () => {
  assert.equal(run([row("2026-10-20", -100000, "a", "k1"), row("2026-10-20", -100000, "b", "k2")], [tx("a", "2026-10-20", 1000), tx("b", "2026-10-20", 1000)]).arthOnly.length, 0);
  assert.equal(run([row("2026-10-20", -100000)], [tx("a", "2026-10-20", 1000), tx("b", "2026-10-20", 1000)]).arthOnly.map(x => x.id).length, 1);
});
test("only entries inside the period are checked, and other accounts are ignored", () => {
  const r = run([], [tx("old", "2026-09-01", 100), tx("in", "2026-10-30", 100), tx("other", "2026-10-30", 100, { accId: "bank1" })]);
  assert.deepEqual(r.arthOnly.map(x => x.id), ["in"]);
});
test("an entry dated after the file's last row is marked pending (may not have posted yet) and left out of the total", () => {
  const r = run([], [tx("p", "2026-11-14", 200), tx("q", "2026-11-01", 300)]);
  assert.deepEqual(r.arthOnly.map(x => [x.id, x.pending]), [["q", false], ["p", true]]);
  assert.equal(r.totalPaise, -30000);
});
test("a new row and an Arth-only entry that look like one purchase are paired, with the reason", () => {
  const r = run([row("2026-10-20", -499900, "Big Store", "kn")], [tx("z", "2026-10-27", 4999)]);
  assert.deepEqual(r.pairs, [{ rowKey: "kn", arthId: "z", why: "same amount, 7 days apart" }]);
  const s = run([row("2026-10-20", -499900, "Big Store", "kn")], [tx("z", "2026-10-20", 4990)]);
  assert.equal(s.pairs[0].why, "same day, a different amount");
});
test("rows imported before are not flagged on the Arth side", () => {
  const txns = [tx("a", "2026-10-20", 1000, { importKey: "kk" })];
  const m = matchStatement([row("2026-10-20", -100000, "x", "kk")], { transactions: txns, accountId: "cc1", importedKeys: ["kk"], linkedIds: [] });
  assert.equal(unmatchedInArth({ results: m.results, transactions: txns, accountId: "cc1", from: "2026-10-17", to: "2026-11-16" }).arthOnly.length, 0);
});
test("does not change its inputs", () => {
  const txns = [tx("a", "2026-10-20", 1000)]; const copy = JSON.stringify(txns); run([row("2026-10-20", -100000)], txns); assert.equal(JSON.stringify(txns), copy);
});

test("newCredits: only the payments/refunds of the file that Arth does not have, with their total", () => {
  const rows = [row("2026-10-20", -100000, "a", "k1"), row("2026-10-22", 175275, "REFUND", "k2"), row("2026-10-23", 50000, "PAYMENT", "k3")];
  const m = matchStatement(rows, { transactions: [tx("a", "2026-10-20", 1000), { id: "p", type: "cc_payment", date: "2026-10-23", amount: 500, toAccId: "cc1" }], accountId: "cc1", importedKeys: [], linkedIds: [] });
  const c = newCredits(m.results);
  assert.deepEqual(c.rows.map(r => r.desc), ["REFUND"]); assert.equal(c.totalPaise, 175275);
  assert.deepEqual(newCredits([]), { rows: [], totalPaise: 0 });
});
