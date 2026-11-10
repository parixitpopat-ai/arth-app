import test from "node:test";
import assert from "node:assert/strict";
import { monthBounds, shiftMonth, dayBefore, buildStatement, statementCsv } from "./accountStatement.js";

test("months: bounds, shifting across years, day before", () => {
  assert.deepEqual(monthBounds(2026, 2), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(monthBounds(2028, 2), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.equal(dayBefore("2026-03-01"), "2026-02-28");
  assert.equal(dayBefore("2026-01-01"), "2025-12-31");
});

const row = (id, date, signed, extra = {}) => ({ id: "a_" + id, t: { id, date, ...extra }, signed, secondary: extra.sec || "Expense" });
test("bank statement: opening + rows = closing, oldest first with a running balance, totals exact", () => {
  const rows = [row(3, "2026-10-20", -100.10, { merchant: "Shop" }), row(1, "2026-10-02", 5000, { desc: "Salary", sec: "Income" }), row(2, "2026-10-02", -0.2), row(9, "2026-09-30", -1), row(10, "2026-11-01", -1)];
  const st = buildStatement({ rows, from: "2026-10-01", to: "2026-10-31", openingBalance: 1000 });
  assert.equal(st.count, 3);
  assert.deepEqual(st.lines.map(l => [l.date, l.debitPaise, l.creditPaise, l.balancePaise]), [["2026-10-02", 0, 500000, 600000], ["2026-10-02", 20, 0, 599980], ["2026-10-20", 10010, 0, 589970]]);
  assert.equal(st.totalInPaise, 500000); assert.equal(st.totalOutPaise, 10030);
  assert.equal(st.openingPaise, 100000); assert.equal(st.closingPaise, 589970);
  assert.equal(st.closingPaise, st.openingPaise + st.totalInPaise - st.totalOutPaise);
  assert.equal(st.lines[0].description, "Salary · Income"); assert.equal(st.lines[2].description, "Shop · Expense");
});
test("statement: rows before the account's opening date are left out; empty period works", () => {
  const rows = [row(1, "2026-04-01", -50), row(2, "2026-04-10", -25)];
  const st = buildStatement({ rows, from: "2026-04-01", to: "2026-04-30", openingBalance: 500, ignoreBefore: "2026-04-05" });
  assert.equal(st.count, 1); assert.equal(st.closingPaise, 47500);
  const empty = buildStatement({ rows: [], from: "2026-05-01", to: "2026-05-31", openingBalance: 123.45 });
  assert.equal(empty.count, 0); assert.equal(empty.closingPaise, 12345);
});
test("card statement: no balance, charges and credits for the period", () => {
  const st = buildStatement({ rows: [row(1, "2026-10-06", -375.1), row(2, "2026-10-09", 1000)], from: "2026-09-17", to: "2026-10-16", openingBalance: null });
  assert.equal(st.hasBalance, false); assert.equal(st.closingPaise, null); assert.equal(st.lines[0].balancePaise, null);
  assert.equal(st.totalOutPaise, 37510); assert.equal(st.totalInPaise, 100000);
});
test("csv: bank-style dates, quoting, opening/closing lines", () => {
  const st = buildStatement({ rows: [row(1, "2026-10-02", -12.5, { merchant: 'Cafe, "Nice"' })], from: "2026-10-01", to: "2026-10-31", openingBalance: 100 });
  assert.equal(statementCsv(st), 'Date,Description,Debit,Credit,Balance\n01-10-2026,Opening balance,,,100.00\n02-10-2026,"Cafe, ""Nice"" · Expense",12.50,,87.50\n31-10-2026,Closing balance,,,87.50\n');
});
