import test from "node:test";
import assert from "node:assert/strict";
import { nextFireAt, tomorrowAt, buildWeeklyNotification } from "./weeklyNotification.js";

const L = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi, 0, 0);
test("next Sunday 19:00 from a Wednesday", () => {
  assert.deepEqual(nextFireAt(L(2026, 11, 11, 10), { weekday: 0, hour: 19, minute: 0 }), L(2026, 11, 15, 19));
});
test("on Sunday before 19:00 it is today; after 19:00 it is next Sunday", () => {
  assert.deepEqual(nextFireAt(L(2026, 11, 15, 9)), L(2026, 11, 15, 19));
  assert.deepEqual(nextFireAt(L(2026, 11, 15, 19, 0)), L(2026, 11, 22, 19));
  assert.deepEqual(nextFireAt(L(2026, 11, 15, 21)), L(2026, 11, 22, 19));
});
test("crosses a month end and a year end", () => {
  assert.deepEqual(nextFireAt(L(2026, 12, 29, 8), { weekday: 0 }), L(2027, 1, 3, 19));
});
test("'Later' is tomorrow at the same time", () => {
  assert.deepEqual(tomorrowAt(L(2026, 11, 15, 20)), L(2026, 11, 16, 19));
});
const sum = { headline: "Spends down by 32% this week", thisWeek: 27496, lastWeek: 40435, monthTotal: 67860 };
const o = { sym: "₹", fmt: n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","), asOf: L(2026, 11, 11, 10) };
test("text carries the numbers and when it was last up to date, and does not repeat Insights", () => {
  const n = buildWeeklyNotification(sum, o);
  assert.equal(n.title, "Spends down by 32% this week");
  assert.equal(n.body, "₹27,496 this week · This month ₹67,860");
  assert.match(n.largeBody, /Same days last week: ₹40,435/);
  assert.doesNotMatch(n.largeBody, /lower than|higher than/);
  assert.match(n.largeBody, /As of Wednesday 11 Nov/);
});
test("nothing to say means no notification", () => {
  assert.equal(buildWeeklyNotification({ thisWeek: 0, lastWeek: 0 }, o), null);
  assert.equal(buildWeeklyNotification(null, o), null);
});
