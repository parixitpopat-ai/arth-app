import test from "node:test";
import assert from "node:assert/strict";
import { dailySummary, nextDailyAt, buildDailyNotification } from "./dailySummary.js";

const my = t => Number(t.amount);
const txns = [
  { type: "expense", date: "2026-11-22", amount: 300 }, { type: "expense", date: "2026-11-22", amount: 200 },
  { type: "expense", date: "2026-11-21", amount: 1000 }, { type: "expense", date: "2026-11-02", amount: 500 },
  { type: "expense", date: "2026-10-30", amount: 9999 }, { type: "income", date: "2026-11-22", amount: 5000 }, { type: "expense", date: "2026-11-23", amount: 7 },
];
test("today, yesterday and the month so far; income, other months and future days do not count", () => {
  assert.deepEqual(dailySummary({ txns, today: "2026-11-22", myAmount: my }), { today: 500, yesterday: 1000, monthTotal: 2000, count: 2 });
  assert.deepEqual(dailySummary({ txns: [], today: "2026-11-22", myAmount: my }), { today: 0, yesterday: 0, monthTotal: 0, count: 0 });
  assert.equal(dailySummary({ txns, today: "2026-12-01", myAmount: my }).yesterday, 0);   // 30 Nov has none; month rolls over cleanly
});
test("next 9 pm: tonight if it is earlier, otherwise tomorrow", () => {
  assert.equal(nextDailyAt(new Date(2026, 10, 22, 15, 0)).toString(), new Date(2026, 10, 22, 21, 0).toString());
  assert.equal(nextDailyAt(new Date(2026, 10, 22, 21, 0)).toString(), new Date(2026, 10, 23, 21, 0).toString());
  assert.equal(nextDailyAt(new Date(2026, 10, 22, 23, 30)).toString(), new Date(2026, 10, 23, 21, 0).toString());
});
test("what it says: spent today, or nothing today; and silence when there is nothing at all", () => {
  const f = n => String(n), asOf = new Date(2026, 10, 22, 20, 0);
  const a = buildDailyNotification({ today: 500, yesterday: 1000, monthTotal: 2000 }, { sym: "₹", fmt: f, asOf });
  assert.equal(a.title, "Today: ₹500 spent"); assert.equal(a.body, "This month ₹2000 · Yesterday ₹1000"); assert.match(a.largeBody, /As of Sunday 22 Nov/);
  assert.equal(buildDailyNotification({ today: 0, yesterday: 0, monthTotal: 800 }, { sym: "₹", fmt: f, asOf }).title, "Nothing spent today");
  assert.equal(buildDailyNotification({ today: 0, yesterday: 0, monthTotal: 0 }, { sym: "₹", fmt: f, asOf }), null);
  assert.equal(buildDailyNotification(null, { sym: "₹", fmt: f, asOf }), null);
});
