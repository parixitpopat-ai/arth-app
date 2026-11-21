import test from "node:test";
import assert from "node:assert/strict";
import { canSkipBill, skipBill, unskipBill, skipBlockedReason } from "./skipBill.js";
import { getMoneyRequiredForPeriod } from "../futureMoney/moneyRequired.js";
import { getBillBadge } from "../obligations/billBalance.js";

const bill = (o = {}) => ({ id: "b1", name: "Water", amount: 500, status: "unpaid", dueDate: "2026-11-25", ...o });

test("a plain unpaid bill can be skipped; statements, paid, cancelled and skipped ones cannot", () => {
  assert.equal(canSkipBill(bill()), true);
  for (const b of [bill({ isCcStatement: true }), bill({ status: "paid" }), bill({ status: "cancelled" }), bill({ skipped: true })]) assert.equal(canSkipBill(b), false);
  assert.match(skipBlockedReason(bill({ isCcStatement: true })), /bank is still owed/);
});

test("skip marks the bill and unskip restores it exactly", () => {
  const s = skipBill(bill(), { today: "2026-11-21" });
  assert.equal(s.skipped, true); assert.equal(s.skippedDate, "2026-11-21"); assert.equal(s.status, "unpaid");
  assert.deepEqual(unskipBill(s), bill());
  assert.equal(skipBill(bill({ isCcStatement: true }), { today: "x" }).skipped, undefined);
});

test("a skipped bill leaves Money Required; so does a cancelled one", () => {
  const fm = { committedSpending: [
    { sourceId: "a", amount: 500, status: "unpaid", skipped: false },
    { sourceId: "b", amount: 300, status: "unpaid", skipped: true },
    { sourceId: "c", amount: 200, status: "cancelled" },
  ] };
  const r = getMoneyRequiredForPeriod({ futureMoney: fm });
  assert.deepEqual(r.spending.map(e => e.sourceId), ["a"]);
  assert.equal(r.total, 500);
});

test("a skipped bill's badge is Skipped, never overdue", () => {
  assert.equal(getBillBadge(skipBill(bill({ dueDate: "2020-01-01" }), { today: "2026-11-21" }), [], new Date(2026, 10, 21)).kind, "skipped");
});

import { buildNextBillAfterSkip } from "./skipBill.js";
import { computeNextDueDate, computeNextPeriod } from "./periodCalculations.js";
test("skipping a recurring bill makes next month's bill; a one-off or schedule-owned one makes none", () => {
  const args = { today: "2026-11-21", genId: () => "n1", computeNextDueDate, computeNextPeriod };
  const n = buildNextBillAfterSkip(bill({ recurring: true, frequency: "monthly", billingModel: "calendar" }), args);
  assert.equal(n.dueDate, "2026-12-25"); assert.equal(n.status, "unpaid"); assert.equal(n.skipped, undefined); assert.equal(n.id, "n1");
  assert.equal(buildNextBillAfterSkip(bill(), args), null);
  assert.equal(buildNextBillAfterSkip(bill({ recurring: true }), { ...args, scheduleOwnsRegeneration: true }), null);
  assert.equal(buildNextBillAfterSkip(bill({ recurring: true, autoGenerate: false }), args), null);
});
