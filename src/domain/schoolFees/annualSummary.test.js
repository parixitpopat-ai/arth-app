import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateAnnualSummary } from "./annualSummary.js";

function period(overrides = {}) {
  return {
    id: "p1", scheduleId: "sched1", obligationAmount: 4500,
    startingStateDeclared: true, paidAmount: 0, discountAmount: 0,
    writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [],
    ...overrides,
  };
}

function creditNote(overrides = {}) {
  return { id: "cn1", scheduleId: "sched1", amount: 300, applications: [], ...overrides };
}

// --- Requested scenario 4: gross commitment unaffected by payments ------

test("gross annual commitment is unaffected by any amount of payment", () => {
  const periods = [
    period({ id: "p1", obligationAmount: 4500, paidAmount: 4500 }), // fully paid
    period({ id: "p2", obligationAmount: 4500, paidAmount: 0 }),    // untouched
  ];
  const summary = calculateAnnualSummary("sched1", periods, []);
  assert.equal(summary.grossAnnualCommitment, 9000); // unchanged regardless of paidAmount
});

test("gross annual commitment is unaffected by discounts, write-offs, or credit", () => {
  const periods = [
    period({ id: "p1", obligationAmount: 4500, discountAmount: 1000, writeOffAmount: 500, appliedCreditAmount: 300 }),
  ];
  const summary = calculateAnnualSummary("sched1", periods, []);
  assert.equal(summary.grossAnnualCommitment, 4500); // original obligation, never rewritten
});

// --- Requested scenario 5: remaining obligation excludes undeclared -----

test("gross annual commitment includes undeclared periods; remaining obligation does not", () => {
  const periods = [
    period({ id: "declared", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0 }),
    period({ id: "undeclared", obligationAmount: 4500, startingStateDeclared: false }),
  ];
  const summary = calculateAnnualSummary("sched1", periods, []);
  assert.equal(summary.grossAnnualCommitment, 9000); // both periods count
  assert.equal(summary.remainingObligation, 4500);   // only the declared one counts
});

test("remaining obligation is a direct sum, not a residual of gross minus other sums — proven by an undeclared period with a large obligation", () => {
  const periods = [
    period({ id: "declared", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 4500 }), // settled, contributes 0
    period({ id: "undeclared", obligationAmount: 100000, startingStateDeclared: false }), // huge, but undeclared
  ];
  const summary = calculateAnnualSummary("sched1", periods, []);
  // A naive `gross - paid - discounts - writeoffs - credit` would compute
  // 104500 - 4500 - 0 - 0 - 0 = 100000, silently attributing the
  // undeclared period's full amount as "remaining." The correct answer is 0.
  assert.equal(summary.remainingObligation, 0);
});

test("undeclared periods never contribute to amountPaid, discounts, writeOffs, or appliedCredit", () => {
  // Even if an undeclared period somehow had non-zero amounts (shouldn't
  // happen given WP-3's own guards, but this function must not trust that
  // — it must actively exclude undeclared periods from every settlement sum
  // regardless of what their fields contain).
  const periods = [
    period({ id: "undeclared", startingStateDeclared: false, paidAmount: 999, discountAmount: 999, writeOffAmount: 999, appliedCreditAmount: 999 }),
  ];
  const summary = calculateAnnualSummary("sched1", periods, []);
  assert.equal(summary.amountPaid, 0);
  assert.equal(summary.discounts, 0);
  assert.equal(summary.writeOffs, 0);
  assert.equal(summary.appliedCredit, 0);
});

// --- Available credit, applied credit, future cash requirement ----------

test("available credit reflects unapplied balance across the schedule's credit notes", () => {
  const notes = [creditNote({ amount: 300, applications: [{ periodId: "p1", amount: 100 }] })];
  const summary = calculateAnnualSummary("sched1", [], notes);
  assert.equal(summary.availableCredit, 200);
});

test("future cash requirement equals remaining obligation", () => {
  const periods = [period({ obligationAmount: 4500, paidAmount: 1000 })];
  const summary = calculateAnnualSummary("sched1", periods, []);
  assert.equal(summary.futureCashRequirement, summary.remainingObligation);
  assert.equal(summary.futureCashRequirement, 3500);
});

// --- Requested scenario 7: multiple school years remain isolated --------

test("two different schedules' periods and credit notes never bleed into each other's totals", () => {
  const periods = [
    period({ id: "y1-p1", scheduleId: "year1", obligationAmount: 4500, paidAmount: 4500 }),
    period({ id: "y2-p1", scheduleId: "year2", obligationAmount: 5000, paidAmount: 0 }),
  ];
  const notes = [
    creditNote({ id: "y1-cn", scheduleId: "year1", amount: 300, applications: [] }),
    creditNote({ id: "y2-cn", scheduleId: "year2", amount: 700, applications: [] }),
  ];

  const year1 = calculateAnnualSummary("year1", periods, notes);
  const year2 = calculateAnnualSummary("year2", periods, notes);

  assert.equal(year1.grossAnnualCommitment, 4500);
  assert.equal(year1.availableCredit, 300);
  assert.equal(year1.remainingObligation, 0);

  assert.equal(year2.grossAnnualCommitment, 5000);
  assert.equal(year2.availableCredit, 700);
  assert.equal(year2.remainingObligation, 5000);

  // Explicitly confirm no cross-contamination in either direction.
  assert.notEqual(year1.grossAnnualCommitment, year2.grossAnnualCommitment);
  assert.notEqual(year1.availableCredit, year2.availableCredit);
});

test("a schedule with no periods or credit notes yet returns all zeros, not an error", () => {
  const summary = calculateAnnualSummary("brand-new-schedule", [], []);
  assert.deepEqual(summary, {
    grossAnnualCommitment: 0, amountPaid: 0, discounts: 0, writeOffs: 0,
    availableCredit: 0, appliedCredit: 0, remainingObligation: 0, futureCashRequirement: 0,
  });
});

test("requires a scheduleId", () => {
  assert.throws(() => calculateAnnualSummary(null, [], []), /scheduleId is required/);
});
