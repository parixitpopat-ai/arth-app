import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EDU_SUB, EDUCATION_CATEGORY, feeKindForEducationSub, educationSubNeedsPeriod, selectionNeedsSchool,
  monthRangeToDates, dateRangeToDates, findApplicablePeriods, planFeeAllocation, validateFeeAllocation,
  buildEducationLineItems, collectLinkedFeePeriods, applyEducationSettlement,
} from "./educationLines.js";
import { settleFeePeriods } from "./settlement.js";

const per = (id, start, end, over = {}) => ({
  id, scheduleId: "s1", kind: "tuition", periodStart: start, periodEnd: end, dueDate: start,
  label: id, obligationAmount: 5000, paidAmount: 0, discountAmount: 0, writeOffAmount: 0,
  appliedCreditAmount: 0, startingStateDeclared: true, settlementLinks: [], ...over,
});
const schedules = [{ id: "s1", billerAccountId: "b1" }, { id: "s2", billerAccountId: "b2" }];
const periods = [
  per("jul", "2026-07-01", "2026-07-31"), per("aug", "2026-08-01", "2026-08-31"),
  per("sep", "2026-09-01", "2026-09-30"), per("oct", "2026-10-01", "2026-10-31"),
  per("reg", "2026-06-01", "2026-06-30", { kind: "registration", obligationAmount: 8000 }),
  per("uni", "2026-06-01", "2026-06-30", { kind: "uniform", obligationAmount: 2000 }),
  per("other", "2026-07-01", "2026-07-31", { scheduleId: "s2" }),
];

test("Education category is zero-budget with stable ids", () => {
  assert.equal(EDUCATION_CATEGORY.id, "education");
  assert.equal(EDUCATION_CATEGORY.budget, 0);
  assert.equal(EDUCATION_CATEGORY.subs.length, 7);
});

test("only School Fees takes a period; reg/uniform one-time; books etc are not obligations", () => {
  assert.equal(educationSubNeedsPeriod(EDU_SUB.SCHOOL_FEES), true);
  assert.equal(educationSubNeedsPeriod(EDU_SUB.REGISTRATION), false);
  assert.equal(educationSubNeedsPeriod(EDU_SUB.UNIFORM), false);
  assert.equal(feeKindForEducationSub(EDU_SUB.REGISTRATION), "registration");
  assert.equal(feeKindForEducationSub(EDU_SUB.UNIFORM), "uniform");
  for (const s of [EDU_SUB.BOOKS, EDU_SUB.ACTIVITIES, EDU_SUB.EXAMS, EDU_SUB.OTHER]) assert.equal(feeKindForEducationSub(s), null);
  assert.equal(selectionNeedsSchool([EDU_SUB.BOOKS]), false);
  assert.equal(selectionNeedsSchool([EDU_SUB.BOOKS, EDU_SUB.UNIFORM]), true);
});

test("month range -> dates, count and label", () => {
  const r = monthRangeToDates("2026-07", "2026-09");
  assert.deepEqual([r.from, r.to, r.months, r.label], ["2026-07-01", "2026-09-30", 3, "Jul 2026 – Sep 2026"]);
  assert.equal(monthRangeToDates("2026-09", "2026-07"), null);
  assert.equal(monthRangeToDates("x", "2026-07"), null);
  assert.equal(monthRangeToDates("2026-07", "2026-07").label, "Jul 2026");
  assert.equal(dateRangeToDates("2026-07-10", "2026-09-05").months, 3);
  assert.equal(dateRangeToDates("2026-09-05", "2026-07-10"), null);
});

test("tuition range matches only this school's overlapping tuition periods", () => {
  const a = findApplicablePeriods({ feePeriods: periods, feeSchedules: schedules, billerAccountId: "b1", kind: "tuition", from: "2026-07-01", to: "2026-09-30" });
  assert.deepEqual(a.map(x => x.period.id), ["jul", "aug", "sep"]);
});

test("one-time kinds ignore dates and match only their kind", () => {
  const r = findApplicablePeriods({ feePeriods: periods, feeSchedules: schedules, billerAccountId: "b1", kind: "registration" });
  assert.deepEqual(r.map(x => x.period.id), ["reg"]);
});

test("no overlap -> empty; settled periods excluded; undeclared flagged", () => {
  assert.equal(findApplicablePeriods({ feePeriods: periods, feeSchedules: schedules, billerAccountId: "b1", kind: "tuition", from: "2027-01-01", to: "2027-03-31" }).length, 0);
  const ps = [per("jul", "2026-07-01", "2026-07-31", { paidAmount: 5000 }), per("aug", "2026-08-01", "2026-08-31", { startingStateDeclared: false })];
  const a = findApplicablePeriods({ feePeriods: ps, feeSchedules: schedules, billerAccountId: "b1", kind: "tuition", from: "2026-07-01", to: "2026-08-31" });
  assert.deepEqual(a.map(x => [x.period.id, x.needsDeclaration]), [["aug", true]]);
});

test("planFeeAllocation: exact / partial / excess / none", () => {
  const a = findApplicablePeriods({ feePeriods: periods, feeSchedules: schedules, billerAccountId: "b1", kind: "tuition", from: "2026-07-01", to: "2026-09-30" });
  assert.equal(planFeeAllocation(a, 15000).status, "exact");
  const p = planFeeAllocation(a, 7000);
  assert.equal(p.status, "partial");
  assert.deepEqual(p.suggested.map(s => s.amount), [5000, 2000, 0]);
  assert.equal(planFeeAllocation(a, 16000).status, "excess");
  assert.equal(planFeeAllocation(a, 16000).excess, 1000);
  assert.equal(planFeeAllocation([], 100).status, "none");
});

test("validateFeeAllocation guards sum, over-allocation and foreign periods", () => {
  const a = findApplicablePeriods({ feePeriods: periods, feeSchedules: schedules, billerAccountId: "b1", kind: "tuition", from: "2026-07-01", to: "2026-09-30" });
  assert.equal(validateFeeAllocation(a, [{ periodId: "jul", amount: 5000 }, { periodId: "aug", amount: 2000 }], 7000), null);
  assert.ok(validateFeeAllocation(a, [{ periodId: "jul", amount: 5000 }], 7000));
  assert.ok(validateFeeAllocation(a, [{ periodId: "jul", amount: 6000 }], 6000));
  assert.ok(validateFeeAllocation(a, [{ periodId: "other", amount: 100 }], 100));
});

const lines = () => [
  { id: "l1", subId: EDU_SUB.SCHOOL_FEES, name: "School Fees", amount: 15000, coversLabel: "Jul 2026 – Sep 2026",
    allocations: [{ periodId: "jul", amount: 5000 }, { periodId: "aug", amount: 5000 }, { periodId: "sep", amount: 5000 }] },
  { id: "l2", subId: EDU_SUB.REGISTRATION, name: "Registration Fees", amount: 8000, allocations: [{ periodId: "reg", amount: 8000 }] },
  { id: "l3", subId: EDU_SUB.UNIFORM, name: "Uniform", amount: 2000, allocations: [{ periodId: "uni", amount: 2000 }] },
  { id: "l4", subId: EDU_SUB.BOOKS, name: "Books", amount: 500 },
];

test("line items: one per line, all Education, own subId; Books has no fee period", () => {
  const li = buildEducationLineItems(lines());
  assert.equal(li.length, 4);
  assert.ok(li.every(i => i.catId === "education"));
  assert.deepEqual(li.map(i => i.unitPrice), [15000, 8000, 2000, 500]);
  assert.deepEqual(li[0].feePeriodIds, ["jul", "aug", "sep"]);
  assert.equal(li[0].feePeriodId, undefined);
  assert.equal(li[1].feePeriodId, "reg");
  assert.equal("feePeriodId" in li[3] || "feePeriodIds" in li[3], false);
});

test("linkedFeePeriods merges all fee lines; Books excluded", () => {
  const l = collectLinkedFeePeriods(lines());
  assert.equal(l.length, 5);
  assert.equal(l.reduce((s, a) => s + a.amount, 0), 25000);
});

test("end-to-end settlement via existing settleFeePeriods; later payment settles only remainder", () => {
  const settle = (ps, ids, total, txnId, alloc) => settleFeePeriods(ps, ids, total, txnId, alloc);
  let ps = applyEducationSettlement(periods, collectLinkedFeePeriods(lines()), 99, settle);
  const get = id => ps.find(p => p.id === id);
  assert.equal(get("jul").paidAmount, 5000);
  assert.equal(get("reg").paidAmount, 8000);
  assert.equal(get("uni").paidAmount, 2000);
  assert.equal(get("oct").paidAmount, 0);
  // partial first, remainder later
  const part = [{ id: "l", subId: EDU_SUB.SCHOOL_FEES, name: "School Fees", amount: 7000,
    allocations: [{ periodId: "jul", amount: 5000 }, { periodId: "aug", amount: 2000 }] }];
  let q = applyEducationSettlement(periods, collectLinkedFeePeriods(part), 1, settle);
  const rest = findApplicablePeriods({ feePeriods: q, feeSchedules: schedules, billerAccountId: "b1", kind: "tuition", from: "2026-07-01", to: "2026-09-30" });
  assert.deepEqual(rest.map(x => [x.period.id, x.outstanding]), [["aug", 3000], ["sep", 5000]]);
  assert.equal(q.find(p => p.id === "jul").paidAmount, 5000);
});

test("undeclared periods are declared unpaid then settled", () => {
  const ps = [per("jul", "2026-07-01", "2026-07-31", { startingStateDeclared: false })];
  const out = applyEducationSettlement(ps, [{ periodId: "jul", amount: 5000 }], 5, settleFeePeriods);
  assert.equal(out[0].paidAmount, 5000);
  assert.equal(out[0].startingStateDeclared, true);
});
