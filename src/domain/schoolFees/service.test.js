import { test } from "node:test";
import assert from "node:assert/strict";
import * as schoolFeesService from "./service.js";
import { projectFeePeriodsToCommitments } from "./futureMoney.js";

let idCounter = 0;
const genId = () => `id_${++idCounter}`;

// --- End-to-end lifecycle: this is the real "application boundary" test -

test("full lifecycle: create schedule, declare, settle, discount, credit note, apply credit, read model reflects all of it correctly", () => {
  // 1. Create the schedule (WP-2 wrapped with real id injection)
  const { schedule, periods: generatedPeriods } = schoolFeesService.createSchoolFeeSchedule({
    billerAccountId: "ba1",
    personId: "child1",
    schoolYearStart: "2026-06-01",
    schoolYearEnd: "2026-08-31",
    rateRules: [{ from: "2026-06", to: "2026-08", monthlyRate: 4500 }],
  }, genId);

  assert.equal(generatedPeriods.length, 3);
  let feeSchedules = [schedule];
  let feePeriods = generatedPeriods;
  let schoolCreditNotes = [];

  const june = feePeriods.find(p => p.label === "June 2026");
  const july = feePeriods.find(p => p.label === "July 2026");
  const august = feePeriods.find(p => p.label === "August 2026");

  // 2. Declare June as already-paid (simulating a mid-year schedule setup)
  feePeriods = schoolFeesService.declareStartingState(feePeriods, june.id, true);
  // 3. Declare July and August as unpaid
  feePeriods = schoolFeesService.declareStartingState(feePeriods, july.id, false);
  feePeriods = schoolFeesService.declareStartingState(feePeriods, august.id, false);

  // 4. Settle July in full
  const total = schoolFeesService.calculateSelectedTotal(feePeriods, [july.id]);
  assert.equal(total, 4500);
  feePeriods = schoolFeesService.settlePeriods(feePeriods, [july.id], 4500, "txn_july");

  // 5. Apply a discount to August
  feePeriods = schoolFeesService.discountPeriod(feePeriods, august.id, 500, "Sibling discount");

  // 6. Create a credit note (unrelated to any specific period yet) and apply
  //    part of it to whatever's left outstanding on August
  const note = schoolFeesService.createCreditNote(schedule.id, 1000, "School goodwill credit", genId);
  schoolCreditNotes = [note];
  const { updatedCreditNotes, updatedFeePeriods } = schoolFeesService.applyCredit(
    schoolCreditNotes, feePeriods, note.id, august.id, 500 // remaining outstanding on August: 4500-500=4000... apply less than that
  );
  schoolCreditNotes = updatedCreditNotes;
  feePeriods = updatedFeePeriods;

  // 7. Read model reflects everything correctly
  const readModel = schoolFeesService.getSchoolFeeReadModel(feeSchedules, feePeriods, schoolCreditNotes);
  assert.equal(readModel.length, 1);
  const entry = readModel[0];
  assert.equal(entry.schedule.id, schedule.id);
  assert.equal(entry.periods.length, 3);
  assert.equal(entry.creditNotes.length, 1);
  assert.equal(entry.periodsNeedingDeclaration.length, 0); // all three were declared

  // Gross is all 3 months regardless of settlement state.
  assert.equal(entry.summary.grossAnnualCommitment, 13500);
  // Paid: June (declared paid, 4500) + July (settled, 4500) = 9000.
  assert.equal(entry.summary.amountPaid, 9000);
  assert.equal(entry.summary.discounts, 500);
  assert.equal(entry.summary.appliedCredit, 500);
  assert.equal(entry.summary.availableCredit, 500); // 1000 note, 500 applied
  // Remaining: June=0 (paid), July=0 (settled), August = 4500-500(discount)-500(credit) = 3500.
  assert.equal(entry.summary.remainingObligation, 3500);

  // 8. Future Money projection reflects only August's real remaining amount.
  const commitments = schoolFeesService.getSchoolFeeCommitments(feePeriods);
  assert.equal(commitments.length, 1);
  assert.equal(commitments[0].sourceId, august.id);
  assert.equal(commitments[0].amount, 3500);
  assert.equal(commitments[0].category, "committedSpending");
  assert.equal(commitments[0].subCategory, "schoolFee");
});

// --- getSchoolFeeCommitments is a true passthrough, never a second calc -

test("getSchoolFeeCommitments produces the exact same output as calling futureMoney.js directly — proves no duplicate calculation exists", () => {
  const { periods } = schoolFeesService.createSchoolFeeSchedule({
    schoolYearStart: "2026-06-01", schoolYearEnd: "2026-06-30",
    rateRules: [{ from: "2026-06", to: "2026-06", monthlyRate: 4500 }],
  }, genId);
  const declared = schoolFeesService.declareStartingState(periods, periods[0].id, false);

  const viaService = schoolFeesService.getSchoolFeeCommitments(declared);
  const viaDirectImport = projectFeePeriodsToCommitments(declared);
  assert.deepEqual(viaService, viaDirectImport);
});

// --- Multi-year isolation holds at the service/read-model layer too ------

test("two school years created through the service stay fully isolated in the read model", () => {
  const year1 = schoolFeesService.createSchoolFeeSchedule({
    schoolYearStart: "2025-06-01", schoolYearEnd: "2025-06-30",
    rateRules: [{ from: "2025-06", to: "2025-06", monthlyRate: 4200 }],
  }, genId);
  const year2 = schoolFeesService.createSchoolFeeSchedule({
    schoolYearStart: "2026-06-01", schoolYearEnd: "2026-06-30",
    rateRules: [{ from: "2026-06", to: "2026-06", monthlyRate: 4500 }],
  }, genId);

  const feeSchedules = [year1.schedule, year2.schedule];
  let feePeriods = [...year1.periods, ...year2.periods];
  // Declare and fully settle year1's period only.
  feePeriods = schoolFeesService.declareStartingState(feePeriods, year1.periods[0].id, true);

  const readModel = schoolFeesService.getSchoolFeeReadModel(feeSchedules, feePeriods, []);
  const y1Entry = readModel.find(e => e.schedule.id === year1.schedule.id);
  const y2Entry = readModel.find(e => e.schedule.id === year2.schedule.id);

  assert.equal(y1Entry.summary.grossAnnualCommitment, 4200);
  assert.equal(y2Entry.summary.grossAnnualCommitment, 4500);
  assert.equal(y1Entry.periods.length, 1);
  assert.equal(y2Entry.periods.length, 1);
  assert.notEqual(y1Entry.periods[0].id, y2Entry.periods[0].id); // never share identity
});

// --- Real id injection actually flows through, not a placeholder --------

test("createSchoolFeeSchedule and createCreditNote use the real injected genId, not an internal fallback", () => {
  idCounter = 0; // reset for a deterministic check
  const { schedule } = schoolFeesService.createSchoolFeeSchedule({
    schoolYearStart: "2026-06-01", schoolYearEnd: "2026-06-30",
    rateRules: [{ from: "2026-06", to: "2026-06", monthlyRate: 4500 }],
  }, genId);
  assert.equal(schedule.id, "id_1");

  const note = schoolFeesService.createCreditNote("sched1", 300, "reason", genId);
  assert.equal(note.id, "id_2");
});

test("createSchoolFeeSchedule rejects a missing genId rather than silently generating an unstable id", () => {
  assert.throws(() => schoolFeesService.createSchoolFeeSchedule({
    schoolYearStart: "2026-06-01", schoolYearEnd: "2026-06-30",
    rateRules: [{ from: "2026-06", to: "2026-06", monthlyRate: 4500 }],
  }), /genId function is required/);
});

// --- Error propagation: the service layer doesn't swallow domain errors -

test("service layer propagates the same errors the underlying domain functions throw — no silent catching", () => {
  const { periods } = schoolFeesService.createSchoolFeeSchedule({
    schoolYearStart: "2026-06-01", schoolYearEnd: "2026-06-30",
    rateRules: [{ from: "2026-06", to: "2026-06", monthlyRate: 4500 }],
  }, genId);
  // Undeclared period — settling it should still throw the WP-3 gate error,
  // proving the service wrapper didn't add its own (different) validation
  // that could drift from the domain function's own rule.
  assert.throws(
    () => schoolFeesService.settlePeriods(periods, [periods[0].id], 4500, "txn1"),
    /has not been declared yet/
  );
});

test("applyCredit reports a clear error for an unknown note or period id, rather than a generic failure", () => {
  assert.throws(() => schoolFeesService.applyCredit([], [], "ghost-note", "p1", 100), /credit note ghost-note not found/);
  const note = schoolFeesService.createCreditNote("sched1", 300, "reason", genId);
  assert.throws(() => schoolFeesService.applyCredit([note], [], note.id, "ghost-period", 100), /period ghost-period not found/);
});
