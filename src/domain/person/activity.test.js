import { test } from "node:test";
import assert from "node:assert/strict";
import { getPersonSixMonthActivity } from "./activity.js";

test("aggregates attributed spend per month over exactly a 6-month window ending at the reference date", () => {
  const txns = [
    { id: "t1", type: "expense", date: "2026-09-15" },
    { id: "t2", type: "expense", date: "2026-08-10" },
    { id: "t3", type: "expense", date: "2026-03-01" }, // outside the 6-month window from Sep ref
  ];
  const getPersonAttributedAmount = (t) => (t.id === "t3" ? 9999 : 100);
  const result = getPersonSixMonthActivity("p1", txns, getPersonAttributedAmount, "2026-09-30");
  assert.equal(result.months.length, 6);
  assert.deepEqual(result.months.map(m => m.key), ["2026-04","2026-05","2026-06","2026-07","2026-08","2026-09"]);
  assert.equal(result.months.find(m => m.key === "2026-09").total, 100);
  assert.equal(result.months.find(m => m.key === "2026-08").total, 100);
  assert.equal(result.totalOverPeriod, 200); // t3 correctly excluded, outside window
});

test("non-expense transactions never contribute", () => {
  const txns = [{ id: "t1", type: "income", date: "2026-09-01" }];
  const result = getPersonSixMonthActivity("p1", txns, () => 5000, "2026-09-30");
  assert.equal(result.totalOverPeriod, 0);
  assert.equal(result.transactionCount, 0);
});

test("zero-attributed transactions (person not involved) never count toward transactionCount", () => {
  const txns = [{ id: "t1", type: "expense", date: "2026-09-01" }];
  const result = getPersonSixMonthActivity("p1", txns, () => 0, "2026-09-30");
  assert.equal(result.transactionCount, 0);
});

test("monthlyAverage is totalOverPeriod / 6, and zero when there's no activity at all", () => {
  const txns = [{ id: "t1", type: "expense", date: "2026-09-01" }];
  const result = getPersonSixMonthActivity("p1", txns, () => 600, "2026-09-30");
  assert.equal(result.monthlyAverage, 100);

  const empty = getPersonSixMonthActivity("p1", [], () => 0, "2026-09-30");
  assert.equal(empty.monthlyAverage, 0);
});

test("month labels are correct, in chronological order, oldest first", () => {
  const result = getPersonSixMonthActivity("p1", [], () => 0, "2026-09-30");
  assert.deepEqual(result.months.map(m => m.label), ["Apr","May","Jun","Jul","Aug","Sep"]);
});

test("handles empty/missing transaction list without throwing", () => {
  const result = getPersonSixMonthActivity("p1", undefined, () => 0, "2026-09-30");
  assert.equal(result.transactionCount, 0);
  assert.equal(result.totalOverPeriod, 0);
});

test("correctly rolls over a year boundary", () => {
  const result = getPersonSixMonthActivity("p1", [], () => 0, "2026-02-15");
  assert.deepEqual(result.months.map(m => m.key), ["2025-09","2025-10","2025-11","2025-12","2026-01","2026-02"]);
});
