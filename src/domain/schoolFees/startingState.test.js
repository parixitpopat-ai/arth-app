import { test } from "node:test";
import assert from "node:assert/strict";
import {
  declareFeePeriodStartingState,
  getPeriodsNeedingDeclaration,
  editFeePeriodObligationAmount,
  correctFeePeriodStartingState,
  classifyPeriod,
  reconcileScheduleEdit,
} from "./startingState.js";

function makePeriod(overrides = {}) {
  return {
    id: "p1",
    scheduleId: "s1",
    label: "September 2026",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    dueDate: "2026-09-01",
    obligationAmount: 4500,
    startingStateDeclared: false,
    paidAmount: 0,
    discountAmount: 0,
    writeOffAmount: 0,
    appliedCreditAmount: 0,
    settlementLinks: [],
    ...overrides,
  };
}

// --- WP-3: declareFeePeriodStartingState -------------------------------

test("declaring unpaid marks declared, leaves paidAmount at 0", () => {
  const period = makePeriod();
  const result = declareFeePeriodStartingState(period, false);
  assert.equal(result.startingStateDeclared, true);
  assert.equal(result.paidAmount, 0);
});

test("declaring paid marks declared and sets paidAmount to the full obligation, with no settlementLinks entry", () => {
  const period = makePeriod({ obligationAmount: 4500 });
  const result = declareFeePeriodStartingState(period, true);
  assert.equal(result.startingStateDeclared, true);
  assert.equal(result.paidAmount, 4500);
  assert.deepEqual(result.settlementLinks, []); // no synthetic transaction, no link created
});

test("declaration never mutates the input period", () => {
  const period = makePeriod();
  const snapshot = JSON.parse(JSON.stringify(period));
  declareFeePeriodStartingState(period, true);
  assert.deepEqual(period, snapshot);
});

test("declaration refuses a non-boolean wasPaid — no silent default", () => {
  const period = makePeriod();
  assert.throws(() => declareFeePeriodStartingState(period, undefined), /must be explicitly true or false/);
  assert.throws(() => declareFeePeriodStartingState(period, "yes"), /must be explicitly true or false/);
  assert.throws(() => declareFeePeriodStartingState(period, 1), /must be explicitly true or false/);
});

test("declaration refuses to re-declare an already-declared period", () => {
  const period = makePeriod({ startingStateDeclared: true });
  assert.throws(() => declareFeePeriodStartingState(period, false), /already been declared/);
});

test("declaring one period does not affect a sibling period", () => {
  const sept = makePeriod({ id: "p1", label: "September 2026" });
  const oct = makePeriod({ id: "p2", label: "October 2026" });
  const declaredSept = declareFeePeriodStartingState(sept, true);
  assert.equal(declaredSept.paidAmount, 4500);
  assert.equal(oct.startingStateDeclared, false); // untouched
  assert.equal(oct.paidAmount, 0);
});

// --- WP-3: getPeriodsNeedingDeclaration ---------------------------------

test("flags only undeclared periods whose period has already ended", () => {
  const periods = [
    makePeriod({ id: "past-undeclared", periodEnd: "2026-06-30", startingStateDeclared: false }),
    makePeriod({ id: "past-declared", periodEnd: "2026-07-31", startingStateDeclared: true }),
    makePeriod({ id: "future-undeclared", periodEnd: "2026-12-31", startingStateDeclared: false }),
  ];
  const today = new Date("2026-08-15");
  const needing = getPeriodsNeedingDeclaration(periods, today);
  assert.equal(needing.length, 1);
  assert.equal(needing[0].id, "past-undeclared");
});

test("returns an empty array when nothing needs declaring", () => {
  const periods = [makePeriod({ periodEnd: "2026-12-31" })]; // future, undeclared — not yet due
  assert.deepEqual(getPeriodsNeedingDeclaration(periods, new Date("2026-08-15")), []);
});

// --- WP-4: editFeePeriodObligationAmount --------------------------------

test("edits the obligation amount of an untouched period", () => {
  const period = makePeriod({ obligationAmount: 4500 });
  const result = editFeePeriodObligationAmount(period, 4200);
  assert.equal(result.obligationAmount, 4200);
});

test("edit never mutates the input period", () => {
  const period = makePeriod();
  const snapshot = JSON.parse(JSON.stringify(period));
  editFeePeriodObligationAmount(period, 4200);
  assert.deepEqual(period, snapshot);
});

test("rejects a zero, negative, or non-numeric amount", () => {
  const period = makePeriod();
  assert.throws(() => editFeePeriodObligationAmount(period, 0), /positive number/);
  assert.throws(() => editFeePeriodObligationAmount(period, -100), /positive number/);
  assert.throws(() => editFeePeriodObligationAmount(period, "4500"), /positive number/);
  assert.throws(() => editFeePeriodObligationAmount(period, NaN), /positive number/);
});

test("P0: does NOT reject editing a period with a bare paidAmount claim and no genuine transaction (settlementLinks empty) — this is the fake-paid bug fix", () => {
  const period = makePeriod({ startingStateDeclared: true, paidAmount: 4500, settlementLinks: [] });
  const result = editFeePeriodObligationAmount(period, 4200);
  assert.equal(result.obligationAmount, 4200);
});

test("rejects editing a period with a GENUINE transaction-backed payment (settlementLinks present)", () => {
  const period = makePeriod({ paidAmount: 4500, settlementLinks: [{ txnId: "txn1", amount: 4500 }] });
  assert.throws(() => editFeePeriodObligationAmount(period, 4200), /already been settled/);
});

test("rejects editing a period that already has a discount applied", () => {
  const period = makePeriod({ discountAmount: 200 });
  assert.throws(() => editFeePeriodObligationAmount(period, 4200), /already been settled/);
});

test("rejects editing a period that already has a write-off applied", () => {
  const period = makePeriod({ writeOffAmount: 500 });
  assert.throws(() => editFeePeriodObligationAmount(period, 4200), /already been settled/);
});

test("rejects editing a period that already has applied credit", () => {
  const period = makePeriod({ appliedCreditAmount: 300 });
  assert.throws(() => editFeePeriodObligationAmount(period, 4200), /already been settled/);
});

test("editing one period does not affect a sibling period", () => {
  const sept = makePeriod({ id: "p1", obligationAmount: 4500 });
  const oct = makePeriod({ id: "p2", obligationAmount: 4500 });
  const editedSept = editFeePeriodObligationAmount(sept, 5000);
  assert.equal(editedSept.obligationAmount, 5000);
  assert.equal(oct.obligationAmount, 4500); // untouched
});

// --- P0: correctFeePeriodStartingState ----------------------------------

test("corrects a fake-paid period (declared paid, no settlementLinks) to unpaid — resets paidAmount to 0", () => {
  const period = makePeriod({ startingStateDeclared: true, paidAmount: 4500, settlementLinks: [] });
  const result = correctFeePeriodStartingState(period, false, "Marked paid by mistake at setup");
  assert.equal(result.paidAmount, 0);
  assert.equal(result.startingStateDeclared, true); // still declared, just corrected — not un-declared
});

test("corrects a declared-unpaid period to paid, symmetrically", () => {
  const period = makePeriod({ startingStateDeclared: true, paidAmount: 0 });
  const result = correctFeePeriodStartingState(period, true, "Actually was paid, forgot to mark it");
  assert.equal(result.paidAmount, period.obligationAmount);
});

test("correction never mutates the input period", () => {
  const period = makePeriod({ startingStateDeclared: true, paidAmount: 4500, settlementLinks: [] });
  const snapshot = JSON.parse(JSON.stringify(period));
  correctFeePeriodStartingState(period, false, "Test reason");
  assert.deepEqual(period, snapshot);
});

test("correction never touches discount/writeOff/appliedCredit/settlementLinks", () => {
  const period = makePeriod({ startingStateDeclared: true, paidAmount: 4500, settlementLinks: [], discountAmount: 100, writeOffAmount: 50, appliedCreditAmount: 25 });
  const result = correctFeePeriodStartingState(period, false, "Test reason");
  assert.equal(result.discountAmount, 100);
  assert.equal(result.writeOffAmount, 50);
  assert.equal(result.appliedCreditAmount, 25);
  assert.deepEqual(result.settlementLinks, []);
});

test("refuses to correct a period with a GENUINE transaction — that is real history, not a correctable claim", () => {
  const period = makePeriod({ startingStateDeclared: true, paidAmount: 4500, settlementLinks: [{ txnId: "txn1", amount: 4500 }] });
  assert.throws(() => correctFeePeriodStartingState(period, false, "Test reason"), /genuine transaction/);
});

test("refuses to correct a period that was never declared", () => {
  const period = makePeriod({ startingStateDeclared: false });
  assert.throws(() => correctFeePeriodStartingState(period, false, "Test reason"), /no starting-state declaration/);
});

test("refuses a non-boolean newWasPaid", () => {
  const period = makePeriod({ startingStateDeclared: true, settlementLinks: [] });
  assert.throws(() => correctFeePeriodStartingState(period, undefined, "Test reason"), /must be explicitly true or false/);
});

test("refuses a missing, empty, or whitespace-only reason", () => {
  const period = makePeriod({ startingStateDeclared: true, settlementLinks: [] });
  assert.throws(() => correctFeePeriodStartingState(period, false), /a reason is required/);
  assert.throws(() => correctFeePeriodStartingState(period, false, ""), /a reason is required/);
  assert.throws(() => correctFeePeriodStartingState(period, false, "   "), /a reason is required/);
});

test("full round-trip: fake-paid period is uneditable, then correctable, then editable", () => {
  let period = makePeriod({ startingStateDeclared: true, paidAmount: 4500, settlementLinks: [] });
  // The redefined guard already allows this directly (P0's fix), but the
  // intended UX flow is correct-then-edit — proving both paths work:
  const corrected = correctFeePeriodStartingState(period, false, "Marked paid by mistake at setup");
  assert.equal(corrected.paidAmount, 0);
  const edited = editFeePeriodObligationAmount(corrected, 4200);
  assert.equal(edited.obligationAmount, 4200);
});

// --- P1: correction audit trail (startingStateCorrections) ---------------

test("records a correction entry — previousWasPaid, newWasPaid, reason, correctedAt — matching discountEntries'/writeOffEntries' shape convention", () => {
  const period = makePeriod({ startingStateDeclared: true, paidAmount: 4500, settlementLinks: [] });
  const result = correctFeePeriodStartingState(period, false, "Marked paid by mistake at setup");
  assert.equal(result.startingStateCorrections.length, 1);
  const entry = result.startingStateCorrections[0];
  assert.equal(entry.previousWasPaid, true);
  assert.equal(entry.newWasPaid, false);
  assert.equal(entry.reason, "Marked paid by mistake at setup");
  assert.ok(Number.isFinite(entry.correctedAt));
});

test("multiple corrections append, never overwrite a prior entry", () => {
  let period = makePeriod({ startingStateDeclared: true, paidAmount: 4500, settlementLinks: [] });
  period = correctFeePeriodStartingState(period, false, "First correction");
  period = correctFeePeriodStartingState(period, true, "Actually it was paid after all");
  assert.equal(period.startingStateCorrections.length, 2);
  assert.equal(period.startingStateCorrections[0].reason, "First correction");
  assert.equal(period.startingStateCorrections[1].reason, "Actually it was paid after all");
  assert.equal(period.startingStateCorrections[0].previousWasPaid, true);
  assert.equal(period.startingStateCorrections[1].previousWasPaid, false); // reflects the state at time of THIS correction
});

test("a period with no prior corrections starts with an empty/absent array, not an error", () => {
  const period = makePeriod({ startingStateDeclared: true, paidAmount: 4500, settlementLinks: [] });
  assert.deepEqual(period.startingStateCorrections || [], []);
});

// --- P0: classifyPeriod --------------------------------------------------

test("classifyPeriod: genuine settlementLinks -> protected, regardless of date", () => {
  const past = makePeriod({ periodStart: "2026-06-01", settlementLinks: [{ txnId: "t1", amount: 100 }] });
  const future = makePeriod({ periodStart: "2026-12-01", settlementLinks: [{ txnId: "t2", amount: 100 }] });
  assert.equal(classifyPeriod(past, "2026-09-15"), "protected");
  assert.equal(classifyPeriod(future, "2026-09-15"), "protected");
});

test("classifyPeriod: discount/writeOff/appliedCredit -> protected, regardless of date", () => {
  assert.equal(classifyPeriod(makePeriod({ periodStart: "2026-12-01", discountAmount: 100 }), "2026-09-15"), "protected");
  assert.equal(classifyPeriod(makePeriod({ periodStart: "2026-12-01", writeOffAmount: 100 }), "2026-09-15"), "protected");
  assert.equal(classifyPeriod(makePeriod({ periodStart: "2026-12-01", appliedCreditAmount: 100 }), "2026-09-15"), "protected");
});

test("classifyPeriod: fake-paid (declared, paidAmount>0, no settlementLinks), past -> correctable", () => {
  const period = makePeriod({ periodStart: "2026-06-01", startingStateDeclared: true, paidAmount: 4500, settlementLinks: [] });
  assert.equal(classifyPeriod(period, "2026-09-15"), "correctable");
});

test("classifyPeriod: past, untouched or declared-unpaid -> historical-editable", () => {
  const untouched = makePeriod({ periodStart: "2026-06-01" });
  const declaredUnpaid = makePeriod({ periodStart: "2026-06-01", startingStateDeclared: true, paidAmount: 0 });
  assert.equal(classifyPeriod(untouched, "2026-09-15"), "historical-editable");
  assert.equal(classifyPeriod(declaredUnpaid, "2026-09-15"), "historical-editable");
});

test("classifyPeriod: future, untouched -> future", () => {
  const period = makePeriod({ periodStart: "2026-12-01" });
  assert.equal(classifyPeriod(period, "2026-09-15"), "future");
});

test("classifyPeriod: a fake-paid claim on a FUTURE period is still correctable, not future — protection status is about the claim, not the calendar", () => {
  const period = makePeriod({ periodStart: "2026-12-01", startingStateDeclared: true, paidAmount: 4500, settlementLinks: [] });
  assert.equal(classifyPeriod(period, "2026-09-15"), "correctable");
});

// --- P0: reconcileScheduleEdit --------------------------------------------

function makeSchedulePeriods({ start = "2026-06-01", end = "2027-03-31", rate = 3500, scheduleId = "s1" } = {}) {
  // Mirrors generateFeePeriods' own month enumeration, for building realistic fixtures.
  const months = [];
  let [y, m] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    const mk = `${y}-${String(m).padStart(2, "0")}`;
    months.push(mk);
    m++; if (m > 12) { m = 1; y++; }
  }
  return months.map(mk => makePeriod({
    id: `p-${mk}`, scheduleId, label: mk,
    periodStart: `${mk}-01`, periodEnd: `${mk}-28`, dueDate: `${mk}-01`,
    obligationAmount: rate,
  }));
}

test("reconcileScheduleEdit: unchanged schedule (same dates, same rate) -> zero removals, zero additions, zero updates", () => {
  const feePeriods = makeSchedulePeriods();
  const result = reconcileScheduleEdit({
    feePeriods, newSchoolYearStart: "2026-06-01", newSchoolYearEnd: "2027-03-31",
    newRateRules: [{ from: "2026-06", to: "2027-03", monthlyRate: 3500 }], todayStr: "2026-09-15",
  });
  assert.deepEqual(result.periodsToRemove, []);
  assert.deepEqual(result.periodsToAdd, []);
  assert.deepEqual(result.periodsToUpdate, []);
  assert.equal(result.periodsUnchanged.length, feePeriods.length);
});

test("reconcileScheduleEdit: expansion adds only genuinely new months, never duplicates existing ones", () => {
  const feePeriods = makeSchedulePeriods({ start: "2026-06-01", end: "2026-08-31" }); // Jun/Jul/Aug only
  const result = reconcileScheduleEdit({
    feePeriods, newSchoolYearStart: "2026-06-01", newSchoolYearEnd: "2026-10-31", // extend to Oct
    newRateRules: [{ from: "2026-06", to: "2026-10", monthlyRate: 3500 }], todayStr: "2026-09-15",
  });
  assert.equal(result.periodsToAdd.length, 2); // Sept, Oct only
  const addedMonths = result.periodsToAdd.map(p => p.periodStart.slice(0, 7)).sort();
  assert.deepEqual(addedMonths, ["2026-09", "2026-10"]);
  assert.deepEqual(result.periodsToRemove, []);
});

test("reconcileScheduleEdit: shrink removes eligible (untouched/correctable) out-of-range periods safely", () => {
  const feePeriods = makeSchedulePeriods({ start: "2026-06-01", end: "2027-03-31" });
  const result = reconcileScheduleEdit({
    feePeriods, newSchoolYearStart: "2026-06-01", newSchoolYearEnd: "2026-08-31", // shrink to Jun-Aug only
    newRateRules: [{ from: "2026-06", to: "2026-08", monthlyRate: 3500 }], todayStr: "2026-09-15",
  });
  // Everything from Sept onward (all untouched, future) should be removed.
  assert.equal(result.periodsToRemove.length, feePeriods.length - 3);
  assert.ok(result.periodsToRemove.every(p => p.periodStart.slice(0, 7) > "2026-08"));
});

test("reconcileScheduleEdit: a PROTECTED period outside the new range is kept and reported separately, never removed", () => {
  const feePeriods = makeSchedulePeriods({ start: "2026-06-01", end: "2027-03-31" })
    .map(p => p.periodStart === "2027-01-01" ? { ...p, settlementLinks: [{ txnId: "t1", amount: 3500 }] } : p);
  const result = reconcileScheduleEdit({
    feePeriods, newSchoolYearStart: "2026-06-01", newSchoolYearEnd: "2026-08-31",
    newRateRules: [{ from: "2026-06", to: "2026-08", monthlyRate: 3500 }], todayStr: "2026-09-15",
  });
  assert.ok(!result.periodsToRemove.some(p => p.periodStart === "2027-01-01")); // never in the removal set
  assert.ok(result.protectedOutOfRange.some(p => p.periodStart === "2027-01-01"));
  assert.ok(result.periodsUnchanged.some(p => p.periodStart === "2027-01-01"));
});

test("reconcileScheduleEdit: a CORRECTABLE (fake-paid) out-of-range period IS removed — a claim is not history", () => {
  const feePeriods = makeSchedulePeriods({ start: "2026-06-01", end: "2027-03-31" })
    .map(p => p.periodStart === "2027-01-01" ? { ...p, startingStateDeclared: true, paidAmount: 3500, settlementLinks: [] } : p);
  const result = reconcileScheduleEdit({
    feePeriods, newSchoolYearStart: "2026-06-01", newSchoolYearEnd: "2026-08-31",
    newRateRules: [{ from: "2026-06", to: "2026-08", monthlyRate: 3500 }], todayStr: "2026-09-15",
  });
  assert.ok(result.periodsToRemove.some(p => p.periodStart === "2027-01-01"));
});

test("reconcileScheduleEdit: rate-only change recalculates only future, unprotected periods", () => {
  const feePeriods = makeSchedulePeriods({ start: "2026-06-01", end: "2027-03-31", rate: 3500 });
  const result = reconcileScheduleEdit({
    feePeriods, newSchoolYearStart: "2026-06-01", newSchoolYearEnd: "2027-03-31",
    newRateRules: [{ from: "2026-06", to: "2027-03", monthlyRate: 4000 }], todayStr: "2026-09-15",
  });
  // Sept 2026 onward = future; June/July/Aug = past, never touched.
  assert.ok(result.periodsToUpdate.every(p => p.periodStart.slice(0, 7) >= "2026-09"));
  assert.ok(result.periodsToUpdate.every(p => p.obligationAmount === 4000));
  assert.equal(result.periodsToRemove.length, 0);
  assert.equal(result.periodsToAdd.length, 0);
});

test("reconcileScheduleEdit: rate change never touches a PAST period, even if untouched", () => {
  const feePeriods = makeSchedulePeriods({ start: "2026-06-01", end: "2027-03-31", rate: 3500 });
  const result = reconcileScheduleEdit({
    feePeriods, newSchoolYearStart: "2026-06-01", newSchoolYearEnd: "2027-03-31",
    newRateRules: [{ from: "2026-06", to: "2027-03", monthlyRate: 9999 }], todayStr: "2026-09-15",
  });
  const june = feePeriods.find(p => p.periodStart === "2026-06-01");
  assert.ok(!result.periodsToUpdate.some(p => p.id === june.id));
  assert.ok(result.periodsUnchanged.some(p => p.id === june.id && p.obligationAmount === 3500));
});

test("reconcileScheduleEdit: rate change never touches a transaction-backed FUTURE period", () => {
  const feePeriods = makeSchedulePeriods({ start: "2026-06-01", end: "2027-03-31", rate: 3500 })
    .map(p => p.periodStart === "2026-12-01" ? { ...p, settlementLinks: [{ txnId: "t1", amount: 3500 }] } : p);
  const result = reconcileScheduleEdit({
    feePeriods, newSchoolYearStart: "2026-06-01", newSchoolYearEnd: "2027-03-31",
    newRateRules: [{ from: "2026-06", to: "2027-03", monthlyRate: 9999 }], todayStr: "2026-09-15",
  });
  assert.ok(!result.periodsToUpdate.some(p => p.periodStart === "2026-12-01"));
});

test("reconcileScheduleEdit: combined shrink + rate change produces the correct union of both effects", () => {
  const feePeriods = makeSchedulePeriods({ start: "2026-06-01", end: "2027-03-31", rate: 3500 });
  const result = reconcileScheduleEdit({
    feePeriods, newSchoolYearStart: "2026-06-01", newSchoolYearEnd: "2026-11-30", // shrink, drop Dec-Mar
    newRateRules: [{ from: "2026-06", to: "2026-11", monthlyRate: 4000 }], todayStr: "2026-09-15",
  });
  assert.ok(result.periodsToRemove.every(p => p.periodStart.slice(0, 7) > "2026-11")); // shrink effect
  assert.ok(result.periodsToUpdate.every(p => p.periodStart.slice(0, 7) >= "2026-09" && p.periodStart.slice(0, 7) <= "2026-11")); // rate effect, future-only
  assert.ok(result.periodsToUpdate.every(p => p.obligationAmount === 4000));
});

test("reconcileScheduleEdit: never mutates the input feePeriods array or its entries", () => {
  const feePeriods = makeSchedulePeriods({ start: "2026-06-01", end: "2026-08-31" });
  const snapshot = JSON.parse(JSON.stringify(feePeriods));
  reconcileScheduleEdit({
    feePeriods, newSchoolYearStart: "2026-06-01", newSchoolYearEnd: "2026-07-31",
    newRateRules: [{ from: "2026-06", to: "2026-07", monthlyRate: 9999 }], todayStr: "2026-09-15",
  });
  assert.deepEqual(feePeriods, snapshot);
});

test("reconcileScheduleEdit: existing settlementLinks on a kept period are returned byte-identical, never touched", () => {
  const links = [{ txnId: "t1", amount: 3500 }];
  const feePeriods = makeSchedulePeriods({ start: "2026-06-01", end: "2026-08-31" })
    .map(p => p.periodStart === "2026-06-01" ? { ...p, settlementLinks: links } : p);
  const result = reconcileScheduleEdit({
    feePeriods, newSchoolYearStart: "2026-06-01", newSchoolYearEnd: "2026-08-31",
    newRateRules: [{ from: "2026-06", to: "2026-08", monthlyRate: 3500 }], todayStr: "2026-09-15",
  });
  const kept = result.periodsUnchanged.find(p => p.periodStart === "2026-06-01");
  assert.deepEqual(kept.settlementLinks, links);
});
