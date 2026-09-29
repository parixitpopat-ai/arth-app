import { test } from "node:test";
import assert from "node:assert/strict";
import { isMonthlyRhythm, groupFutureMoneyByRhythm } from "./rhythm.js";

// Reproduces the handoff's own worked example exactly (today = 28 Sep 2026), so a passing
// result here is checked against real numbers from the design doc, not just internal
// consistency: everyMonth total 38,464; November 52,664 (+ICICI Lombard insurance);
// January 42,264 (+school Term 3); March 56,464 (+LIC premium); December/February unchanged.
const FROM = "2026-09-28";

function buildFutureMoney() {
  const bill = { sourceType: "bill", sourceId: "airtel", category: "committedSpending", name: "Airtel Postpaid", amount: 799, date: "2026-10-03", status: "unpaid", recurs: true };
  const ccStatement = { sourceType: "ccStatement", sourceId: "hdfc", category: "committedSpending", name: "HDFC Sapphire", amount: 8765, date: "2026-10-05", status: "unpaid", recurs: true };
  const membership = { sourceType: "membership", sourceId: "cultfit", category: "committedSpending", name: "Cult.fit", amount: 1500, date: "2026-10-05", status: "unpaid", recurs: true };
  const debt = { sourceType: "debt", sourceId: "sbi_home", category: "debtService", name: "SBI Home loan EMI", amount: 22400, date: "2026-10-07", status: "upcoming", recurs: true };
  const sip = { sourceType: "recurringSchedule", sourceId: "ppfc", category: "committedSaving", name: "Parag Parikh Flexi Cap SIP", amount: 5000, date: "2026-10-10", status: "unpaid", recurs: true };
  const schoolTerm2 = { sourceType: "feePeriod", sourceId: "term2", category: "committedSpending", name: "Little Flower School Term 2", amount: 3800, date: "2026-10-15", status: "unpaid", recurs: false };
  const carInsurance = { sourceType: "insurancePolicy", sourceId: "icici_car", category: "committedSpending", name: "ICICI Lombard Car insurance", amount: 14200, date: "2026-11-12", status: "unpaid", recurs: true };
  const schoolTerm3 = { sourceType: "feePeriod", sourceId: "term3", category: "committedSpending", name: "Little Flower School Term 3", amount: 3800, date: "2027-01-15", status: "unpaid", recurs: false };
  const lifeInsurance = { sourceType: "insurancePolicy", sourceId: "lic", category: "committedSpending", name: "LIC Jeevan Anand premium", amount: 18000, date: "2027-03-28", status: "unpaid", recurs: true };

  return {
    committedSpending: [bill, ccStatement, membership, schoolTerm2, carInsurance, schoolTerm3, lifeInsurance],
    committedSaving: [sip],
    debtService: [debt],
  };
}

test("isMonthlyRhythm: monthly-cadence source types with recurs true are monthly; insurance and school fees never are", () => {
  assert.equal(isMonthlyRhythm({ sourceType: "bill", recurs: true }), true);
  assert.equal(isMonthlyRhythm({ sourceType: "ccStatement", recurs: true }), true);
  assert.equal(isMonthlyRhythm({ sourceType: "recurringSchedule", recurs: true }), true);
  assert.equal(isMonthlyRhythm({ sourceType: "debt", recurs: true }), true);
  assert.equal(isMonthlyRhythm({ sourceType: "membership", recurs: true }), true);
  assert.equal(isMonthlyRhythm({ sourceType: "insurancePolicy", recurs: true }), false, "annual, not monthly, despite recurs:true");
  assert.equal(isMonthlyRhythm({ sourceType: "feePeriod", recurs: false }), false);
  assert.equal(isMonthlyRhythm({ sourceType: "bill", recurs: false }), false, "a non-recurring bill is never in the monthly rhythm");
});

test("next30 contains exactly the six items due within 30 days of 28 Sep, sorted by date", () => {
  const { next30 } = groupFutureMoneyByRhythm(buildFutureMoney(), FROM);
  assert.equal(next30.length, 6);
  assert.deepEqual(next30.map(e => e.sourceId), ["airtel", "hdfc", "cultfit", "sbi_home", "ppfc", "term2"]);
});

test("everyMonth baseline is exactly bill+ccStatement+sip+debt+membership = 38,464, excluding insurance and school fees", () => {
  const { everyMonthEvents, everyMonthTotal } = groupFutureMoneyByRhythm(buildFutureMoney(), FROM);
  assert.equal(everyMonthTotal, 38464);
  assert.deepEqual(everyMonthEvents.map(e => e.sourceId).sort(), ["airtel", "cultfit", "hdfc", "ppfc", "sbi_home"].sort());
});

test("month buckets reproduce the handoff's exact worked totals: Nov 52,664 / Dec 38,464 / Jan 42,264 / Feb 38,464 / Mar 56,464", () => {
  const { monthBuckets } = groupFutureMoneyByRhythm(buildFutureMoney(), FROM);
  const byKey = Object.fromEntries(monthBuckets.map(b => [b.monthKey, b]));
  assert.equal(byKey["2026-11"].total, 52664);
  assert.equal(byKey["2026-11"].items.length, 1);
  assert.equal(byKey["2026-11"].items[0].sourceId, "icici_car");
  assert.equal(byKey["2026-12"].total, 38464);
  assert.equal(byKey["2026-12"].items.length, 0);
  assert.equal(byKey["2027-01"].total, 42264);
  assert.equal(byKey["2027-01"].items[0].sourceId, "term3");
  assert.equal(byKey["2027-02"].total, 38464);
  assert.equal(byKey["2027-03"].total, 56464);
  assert.equal(byKey["2027-03"].items[0].sourceId, "lic");
});

test("first bucket is November, not October — the 30-day window's cutoff month is skipped entirely", () => {
  const { monthBuckets } = groupFutureMoneyByRhythm(buildFutureMoney(), FROM);
  assert.equal(monthBuckets[0].monthKey, "2026-11");
});

test("months beyond monthsShownIndividually are marked hidden, not dropped", () => {
  const { monthBuckets } = groupFutureMoneyByRhythm(buildFutureMoney(), FROM, { monthsAhead: 12, monthsShownIndividually: 5 });
  assert.equal(monthBuckets.length, 12);
  assert.equal(monthBuckets.filter(b => !b.hidden).length, 5);
  assert.equal(monthBuckets[5].hidden, true);
});

test("no event is ever counted in both next30 and a month bucket's items — no double counting", () => {
  const { next30, monthBuckets } = groupFutureMoneyByRhythm(buildFutureMoney(), FROM);
  const next30Ids = new Set(next30.map(e => `${e.sourceType}:${e.sourceId}`));
  for (const bucket of monthBuckets) {
    for (const item of bucket.items) {
      assert.equal(next30Ids.has(`${item.sourceType}:${item.sourceId}`), false);
    }
  }
});

test("an event exactly at the 30-day cutoff month boundary is not silently dropped (gap-closing rule)", () => {
  // Cutoff for 28 Sep is 28 Oct; an event on 30 Oct (33 days out, but same calendar month as the
  // cutoff) must still surface somewhere — in next30's cutoff-month extension, per the rule that
  // documents this — never vanish between "next 30 days" and the first real month bucket.
  const fm = { committedSpending: [{ sourceType: "bill", sourceId: "late_oct", category: "committedSpending", name: "Late October bill", amount: 500, date: "2026-10-30", status: "unpaid", recurs: false }], committedSaving: [], debtService: [] };
  const { next30, monthBuckets } = groupFutureMoneyByRhythm(fm, FROM);
  const inNext30 = next30.some(e => e.sourceId === "late_oct");
  const inAnyBucket = monthBuckets.some(b => b.items.some(e => e.sourceId === "late_oct"));
  assert.equal(inNext30 || inAnyBucket, true, "must appear exactly once, somewhere");
  assert.equal(inNext30 && inAnyBucket, false, "must not appear in both");
});
