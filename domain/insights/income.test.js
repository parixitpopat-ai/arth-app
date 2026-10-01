import { test } from "node:test";
import assert from "node:assert/strict";
import { getIncomeSummary, getIncomeMonthSeries } from "./income.js";

test("getIncomeSummary totals only type:income transactions in the given period, sorted most-recent first", () => {
  const periodTxns = [
    { id: "t1", type: "income", merchant: "Acme Corp", date: "2026-09-01", amount: 110000 },
    { id: "t2", type: "income", who: "Flat 2B", date: "2026-09-05", amount: 10000 },
    { id: "t3", type: "expense", date: "2026-09-10", amount: 500 },
  ];
  const { total, rows } = getIncomeSummary(periodTxns);
  assert.equal(total, 120000);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "t2", "most recent date first");
  assert.equal(rows[0].name, "Flat 2B");
  assert.equal(rows[1].name, "Acme Corp");
});

test("getIncomeSummary on an empty period returns zero total and no rows, never throws", () => {
  assert.deepEqual(getIncomeSummary([]), { total: 0, rows: [] });
  assert.deepEqual(getIncomeSummary(null), { total: 0, rows: [] });
});

test("getIncomeMonthSeries returns one entry per requested month key, in the order given", () => {
  const txns = [
    { type: "income", date: "2026-08-01", amount: 118500 },
    { type: "income", date: "2026-09-01", amount: 120000 },
    { type: "expense", date: "2026-09-02", amount: 500 },
  ];
  const series = getIncomeMonthSeries(txns, ["2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(series, [
    { monthKey: "2026-08", total: 118500 },
    { monthKey: "2026-09", total: 120000 },
    { monthKey: "2026-10", total: 0 },
  ]);
});
