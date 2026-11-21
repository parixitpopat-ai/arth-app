import test from "node:test";
import assert from "node:assert/strict";
import { skipMonth, putMonthBack, isMonthSkipped, pruneSkippedMonths } from "./skipMonth.js";
import { getNextRecurringOccurrence } from "../bills/commitments.js";
import { getMoneyRequiredForPeriod } from "../futureMoney/moneyRequired.js";
import { getCommitments } from "../bills/commitments.js";

const sip = (o = {}) => ({ id: "r1", name: "Index fund", day: 10, amount: 5000, active: true, ...o });

test("skip and put back are idempotent and keep months sorted", () => {
  const s = skipMonth(skipMonth(sip(), "2026-12"), "2026-12");
  assert.deepEqual(s.skippedMonths, ["2026-12"]);
  assert.deepEqual(skipMonth(s, "2026-11").skippedMonths, ["2026-11", "2026-12"]);
  assert.equal(isMonthSkipped(s, "2026-12"), true);
  assert.equal(putMonthBack(s, "2026-12").skippedMonths.length, 0);
  assert.deepEqual(skipMonth(sip(), "Dec"), sip());
});

test("the next occurrence moves past a skipped month, and past several in a row", () => {
  const ref = new Date(2026, 10, 21);
  assert.equal(getNextRecurringOccurrence(sip(), ref), "2026-12-10");
  assert.equal(getNextRecurringOccurrence(sip({ skippedMonths: ["2026-12"] }), ref), "2027-01-10");
  assert.equal(getNextRecurringOccurrence(sip({ skippedMonths: ["2026-12", "2027-01"] }), ref), "2027-02-10");
});

test("a SIP skipped for its coming month leaves this month's Money Required, a different month does not", () => {
  const today = new Date(2026, 10, 21);
  const mr = r => getMoneyRequiredForPeriod({ futureMoney: { committedSaving: getCommitments([], [r], [], [], [], d => d, () => ({}), {}, today, {}).committedSaving }, today: "2026-11-21", horizonDays: 30 }).savingTotal;
  assert.equal(mr(sip()), 5000);
  assert.equal(mr(sip({ skippedMonths: ["2026-12"] })), 0);
  assert.equal(mr(sip({ skippedMonths: ["2026-11"] })), 5000);
});

test("past months are pruned", () => {
  assert.deepEqual(pruneSkippedMonths(sip({ skippedMonths: ["2026-09", "2026-12"] }), "2026-11-21").skippedMonths, ["2026-12"]);
});
