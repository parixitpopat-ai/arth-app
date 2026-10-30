import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGroupDates, createGroup, listPayableInstalments, itemKey } from "./group.js";
import { projectFeePeriodsToCommitments } from "../schoolFees/futureMoney.js";
import { settleFeePeriods } from "../schoolFees/settlement.js";
import { composeFutureMoneyCommitments } from "../futureMoney/compose.js";
import { getMoneyRequiredForPeriod } from "../futureMoney/moneyRequired.js";
import { buildCommitmentTimeline } from "../futureMoney/commitmentTimeline.js";
import { groupFutureMoneyByRhythm } from "../futureMoney/rhythm.js";
import { buildReadiness } from "../budget/readiness.js";

// Pay together feeds the 30-day cash requirement: a group's cash sits on the group's payment date, once.
const period = (id, dueDate, extra = {}) => ({ id, label: id, dueDate, obligationAmount: 4000, paidAmount: 0, startingStateDeclared: true, ...extra });
const fmOf = periods => composeFutureMoneyCommitments({ committedSpending: [], committedSaving: [] }, [projectFeePeriodsToCommitments(periods)]);
const flat = fm => [...fm.committedSpending, ...fm.committedSaving, ...fm.debtService];
const group = (periods, ids, date, today = "2026-08-20") => {
  const fm = fmOf(periods);
  const r = createGroup({ events: flat(fm), keys: ids.map(i => `feePeriod:${i}`), date, genId: () => "g1", today });
  assert.equal(r.ok, true, r.reason);
  return r.group;
};
// the three screens' calculations, exactly as App.jsx wires them
const home = (fm, groups, today, days = 30) => getMoneyRequiredForPeriod({ futureMoney: applyGroupDates(fm, groups), today, horizonDays: days });
const outlook = (fm, groups, today) => buildCommitmentTimeline({ futureMoney: applyGroupDates(fm, groups), openingBalance: 100000, today, horizonDays: 30 });
const ready = (fm, groups, monthKey, today) => buildReadiness({ events: flat(fm), commitments: [], monthKey, monthBudget: 0, today, groups });

const SEP = period("Sep", "2026-09-10"), OCT = period("Oct", "2026-10-10"), NOV = period("Nov", "2026-11-10");

test("the brief's example: Sep + Oct planned together on 25 Sep show 8,000 in the 30-day need - not 4,000, not 12,000", () => {
  const today = "2026-09-01", periods = [SEP, OCT, NOV], fm = fmOf(periods), g = group(periods, ["Sep", "Oct"], "2026-09-25", today);
  assert.equal(home(fm, [], today).total, 4000);              // before grouping: only Sep falls in the window (Oct 10 is 39 days out)
  assert.equal(home(fm, [g], today).total, 8000);             // grouped: Sep + Oct on 25 Sep
  assert.equal(home(fm, [g], today, 90).total, 12000);        // the ungrouped Nov joins only when the window reaches it
});

test("three months grouped together land as one amount on the group date", () => {
  const today = "2026-09-01", periods = [SEP, OCT, NOV], fm = fmOf(periods), g = group(periods, ["Sep", "Oct", "Nov"], "2026-09-25", today);
  assert.equal(home(fm, [g], today).total, 12000);
  assert.equal(home(fm, [g], today).count, 3);
  assert.deepEqual([...new Set(flat(applyGroupDates(fm, [g])).map(e => e.date))], ["2026-09-25"]);
});

test("grouped and ungrouped fees in the same window: the group uses its date, the rest keep their own", () => {
  const today = "2026-09-01", periods = [SEP, OCT, NOV, period("Dec", "2026-12-10")], fm = fmOf(periods);
  const g = group(periods, ["Sep", "Nov"], "2026-09-20", today);
  const r = home(fm, [g], today, 60);                         // Sep+Nov on 20 Sep, Oct on 10 Oct; Dec is out
  assert.equal(r.total, 12000);
  assert.deepEqual(r.spending.map(e => `${e.name}@${e.date}`).sort(), ["Nov@2026-09-20", "Oct@2026-10-10", "Sep@2026-09-20"]);
});

test("a payment date inside the window pulls its fees in; outside the window keeps them out - even if they are due inside it", () => {
  const today = "2026-09-01", periods = [SEP, OCT], fm = fmOf(periods);
  assert.equal(home(fm, [group(periods, ["Sep", "Oct"], "2026-09-30", today)], today).total, 8000);
  const late = group(periods, ["Sep", "Oct"], "2026-11-20", today);   // Sep is due in 9 days but is planned for 20 Nov
  assert.equal(home(fm, [late], today).total, 0);
  assert.equal(home(fm, [late], today, 90).total, 8000);
  assert.equal(home(fm, [], today).total, 4000);                       // without the group Sep counts on its own date
});

test("overdue months can be grouped with future ones and count on the planned date, not as overdue", () => {
  const today = "2026-10-03", periods = [SEP, OCT, NOV], fm = fmOf(periods);
  assert.deepEqual(listPayableInstalments(flat(fm), []).map(e => e.sourceId), ["Sep", "Oct", "Nov"]);
  const g = group(periods, ["Sep", "Nov"], "2026-10-25", today);
  assert.equal(home(fm, [], today).total, 8000);              // ungrouped: Sep overdue + Oct due 10 Oct
  const r = home(fm, [g], today);                              // Sep+Nov on 25 Oct, Oct on 10 Oct
  assert.equal(r.total, 12000);
  const t = outlook(fm, [g], today);
  assert.equal(t.overdueTotal, 0);
  assert.deepEqual(t.rows.map(x => `${x.event.name}@${x.date}`).sort(), ["Nov@2026-10-25", "Oct@2026-10-10", "Sep@2026-10-25"]);
  assert.equal(home(fm, [group(periods, ["Sep", "Oct"], "2026-12-01", today)], today).total, 0);   // planned beyond 30 days: arrears leave the window too
});

test("partly paid counts only what is left; fully paid counts nothing and does not change the others", () => {
  const today = "2026-09-01";
  const periods = [period("Sep", "2026-09-10", { paidAmount: 1500 }), OCT, NOV];
  const fm = fmOf(periods), g = group(periods, ["Sep", "Oct"], "2026-09-25", today);
  assert.equal(home(fm, [g], today).total, 2500 + 4000);
  const settled = [period("Sep", "2026-09-10", { paidAmount: 4000 }), OCT, NOV];
  const fm2 = fmOf(settled);                                   // Sep is fully paid after the group was made
  assert.equal(home(fm2, [g], today).total, 4000);             // only Oct remains in the group
  assert.equal(home(fm2, [g], today, 90).total, 8000);         // Oct (grouped) + Nov (ungrouped) - Sep is never counted again
});

test("settling the grouped fees with the existing flow leaves the unrelated month alone and empties the group's cash", () => {
  const today = "2026-09-01", periods = [SEP, OCT, NOV], g = group(periods, ["Sep", "Oct"], "2026-09-25", today);
  const after = settleFeePeriods(periods, ["Sep", "Oct"], 8000, "txn1");
  assert.equal(after.find(p => p.id === "Nov").paidAmount, 0);
  assert.equal(after.find(p => p.id === "Nov").settlementLinks, undefined);
  assert.equal(home(fmOf(after), [g], today, 90).total, 4000);  // Sep+Oct gone; Nov still owed on its own date
});

test("creating a group never changes the periods, the events' amounts or any payment status", () => {
  const today = "2026-09-01", periods = JSON.parse(JSON.stringify([SEP, OCT, NOV])), fm = fmOf(periods);
  const before = JSON.stringify([periods, fm]);
  const g = group(periods, ["Sep", "Oct"], "2026-09-25", today);
  applyGroupDates(fm, [g]);
  assert.equal(JSON.stringify([periods, fm]), before);
  const moved = flat(applyGroupDates(fm, [g]));
  assert.deepEqual(moved.map(e => [e.name, e.amount, e.status]), [["Sep", 4000, "unpaid"], ["Oct", 4000, "unpaid"], ["Nov", 4000, "unpaid"]]);
  assert.equal(applyGroupDates(fm, []), fm);
});

test("Home, Outlook (Needed + timeline + rhythm) and Readiness agree on the same grouped obligations", () => {
  const today = "2026-09-01", periods = [SEP, OCT, NOV], fm = fmOf(periods), g = group(periods, ["Sep", "Oct"], "2026-09-25", today);
  const h = home(fm, [g], today), o = outlook(fm, [g], today), planned = applyGroupDates(fm, [g]);
  assert.equal(h.total, 8000);
  assert.equal(o.neededTotal, h.total);
  assert.equal(o.buffer, 100000 - h.total);
  const rh = groupFutureMoneyByRhythm(planned, today);
  assert.equal(rh.next30.reduce((s, e) => s + e.amount, 0), 8000);
  const inMonths = rh.monthBuckets.flatMap(b => b.items || []).map(itemKey);
  assert.equal(inMonths.includes("feePeriod:Sep") || inMonths.includes("feePeriod:Oct"), false);   // not again in a later bucket
  const sepReady = ready(fm, [g], "2026-09", today);
  assert.equal(sepReady.cashNeeded, 8000);                     // Readiness for the group's month: the same 8,000, once
  assert.equal(ready(fm, [g], "2026-10", today).cashNeeded, 0);// and not again on Oct's own due date
  assert.equal(ready(fm, [g], "2026-11", today).cashNeeded, 4000); // Nov, ungrouped, on its own date
});

test("Readiness and the 30-day need agree for grouped overdue + future fees", () => {
  const today = "2026-10-03", periods = [SEP, OCT, NOV], fm = fmOf(periods), g = group(periods, ["Sep", "Nov"], "2026-10-25", today);
  assert.equal(ready(fm, [g], "2026-10", today).cashNeeded, 4000 * 2 + 4000);  // group 8,000 + Oct 4,000 on its own date
  assert.equal(home(fm, [g], today).total, 12000);
});

// Wiring guard: Home and Outlook must read the planned list - one calculation, no screen on raw dates.
import { readFileSync } from "node:fs";
test("App.jsx feeds Money Required, the timeline and the rhythm from the planned list, never the raw one", () => {
  const src = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
  assert.match(src, /const futureMoneyPlanned = applyGroupDates\(futureMoney, payGroups\)/);
  assert.equal((src.match(/getMoneyRequiredForPeriod\(\{ futureMoney:futureMoneyPlanned,/g) || []).length, 2);
  assert.match(src, /buildCommitmentTimeline\(\{ futureMoney:futureMoneyPlanned,/);
  assert.match(src, /groupFutureMoneyByRhythm\(futureMoneyPlanned,/);
  assert.equal(/getMoneyRequiredForPeriod\(\{ futureMoney,/.test(src), false);
  assert.match(src, /buildReadiness\(\{[\s\S]{0,200}events: \[\.\.\.\(futureMoney\.committedSpending/); // Readiness keeps the unmodified events
});

test("an event already marked paid is never moved, and an item in two groups follows the first", () => {
  const paid = { sourceType: "bill", sourceId: "b1", category: "committedSpending", name: "Bill", amount: 900, date: "2026-09-05", status: "paid" };
  const fm = { committedSpending: [paid, ...fmOf([SEP, OCT]).committedSpending], committedSaving: [], debtService: [] };
  const g = { id: "g1", date: "2026-09-25", items: [{ sourceType: "bill", sourceId: "b1" }, { sourceType: "feePeriod", sourceId: "Sep" }] };
  const g2 = { id: "g2", date: "2026-10-28", items: [{ sourceType: "feePeriod", sourceId: "Sep" }, { sourceType: "feePeriod", sourceId: "Oct" }] };
  const moved = applyGroupDates(fm, [g, g2]).committedSpending;
  assert.equal(moved.find(e => e.sourceId === "b1").date, "2026-09-05");
  assert.equal(moved.find(e => e.sourceId === "Sep").date, "2026-09-25");
  assert.equal(moved.find(e => e.sourceId === "Oct").date, "2026-10-28");
});
