import test from "node:test";
import assert from "node:assert/strict";
import { weeklySummary, mondayOf } from "./weeklySummary.js";

const mine = t => t.amount;
const e = (date, amount, cat) => ({ type: "expense", date, amount, cat });
const run = (txns, today) => weeklySummary({ txns, today, myAmount: mine, catIdsOf: t => (t.cat ? [t.cat] : []), catName: id => id.toUpperCase() });

test("Monday of the week, local dates (2026-11-15 is a Sunday)", () => {
  assert.equal(mondayOf("2026-11-15"), "2026-11-09");
  assert.equal(mondayOf("2026-11-09"), "2026-11-09");
  assert.equal(mondayOf("2026-11-01"), "2026-10-26");
});
test("this week is compared with the SAME stretch of last week, not a whole finished week", () => {
  // today Wednesday 2026-11-11: this week Mon 9 to Wed 11, last week Mon 2 to Wed 4
  const s = run([e("2026-11-10", 700), e("2026-11-03", 1000), e("2026-11-06", 5000) /* last Fri: not in the span */], "2026-11-11");
  assert.equal(s.thisWeek, 700); assert.equal(s.lastWeek, 1000);
  assert.equal(s.pct, -30); assert.equal(s.direction, "down");
  assert.equal(s.headline, "Spends down by 30% this week");
});
test("up, same, and no last-week base (no percentage invented)", () => {
  assert.equal(run([e("2026-11-10", 1500), e("2026-11-03", 1000)], "2026-11-11").direction, "up");
  assert.equal(run([e("2026-11-10", 1000), e("2026-11-03", 1000)], "2026-11-11").direction, "same");
  const none = run([e("2026-11-10", 1500)], "2026-11-11");
  assert.equal(none.pct, null); assert.equal(none.direction, null); assert.equal(none.headline, "Spend this week");
});
test("month total is the month so far, to today only", () => {
  const s = run([e("2026-11-02", 100), e("2026-11-10", 200), e("2026-10-30", 999), e("2026-11-20", 777)], "2026-11-11");
  assert.equal(s.monthTotal, 300);
});
test("only expenses count, and 'my' amount comes from the shared rule", () => {
  const s = weeklySummary({ txns: [{ type: "income", date: "2026-11-10", amount: 9999 }, e("2026-11-10", 1000)], today: "2026-11-11", myAmount: t => t.amount / 2 });
  assert.equal(s.thisWeek, 500);
});
test("top mover is the category that moved most in the direction of the headline", () => {
  const s = run([e("2026-11-10", 200, "food"), e("2026-11-03", 3000, "shopping"), e("2026-11-03", 400, "food")], "2026-11-11");
  assert.equal(s.direction, "down");
  assert.equal(s.topMover.id, "shopping"); assert.equal(s.topMover.name, "SHOPPING"); assert.equal(s.topMover.diff, -3000);
  const up = run([e("2026-11-10", 5000, "travel"), e("2026-11-03", 1000, "food")], "2026-11-11");
  assert.equal(up.topMover.id, "travel");
});
test("tiny movements are not called out", () => {
  const s = run([e("2026-11-10", 150, "food"), e("2026-11-03", 100, "food"), e("2026-11-10", 5000, "x"), e("2026-11-03", 5000, "x")], "2026-11-11");
  assert.equal(s.topMover, null);
});
