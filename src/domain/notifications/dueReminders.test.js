import test from "node:test";
import assert from "node:assert/strict";
import { buildDueReminders } from "./dueReminders.js";

const now = new Date(2026, 10, 22, 10, 0);
const bill = (o = {}) => ({ id: "b1", name: "Water Bill", amount: 500, status: "unpaid", dueDate: "2026-11-30", ...o });

test("a bill due in 8 days gets a reminder 3 days before and one on the day, at 9 am, soonest first", () => {
  const r = buildDueReminders({ bills: [bill()], now });
  assert.deepEqual(r.map(x => [x.kind, x.at.getDate(), x.at.getHours()]), [["soon", 27, 9], ["due", 30, 9]]);
  assert.equal(r[0].title, "Water Bill is due in 3 days");
  assert.match(r[0].body, /₹500/);
});

test("times already past are not scheduled", () => {
  const r = buildDueReminders({ bills: [bill({ dueDate: "2026-11-23" })], now });
  assert.deepEqual(r.map(x => x.kind), ["due"]);
  assert.equal(buildDueReminders({ bills: [bill({ dueDate: "2026-11-22" })], now }).length, 0);
});

test("paid, cancelled, skipped, zero or far-away bills get none", () => {
  for (const b of [bill({ status: "paid" }), bill({ status: "cancelled" }), bill({ skipped: true }), bill({ amount: 0 }), bill({ dueDate: "2027-03-01" })]) assert.equal(buildDueReminders({ bills: [b], now }).length, 0);
});

test("a part-paid bill is reminded for what is left", () => {
  const r = buildDueReminders({ bills: [bill()], now, balanceOf: () => 200 });
  assert.match(r[0].body, /₹200/);
});

test("ids are stable and different for the two reminders of one bill", () => {
  const a = buildDueReminders({ bills: [bill()], now }), b = buildDueReminders({ bills: [bill()], now });
  assert.deepEqual(a.map(x => x.id), b.map(x => x.id));
  assert.notEqual(a[0].id, a[1].id);
});
