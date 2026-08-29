import { test } from "node:test";
import assert from "node:assert/strict";
import {
  declareFeePeriodStartingState,
  getPeriodsNeedingDeclaration,
  editFeePeriodObligationAmount,
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

test("rejects editing a period that already has a payment applied", () => {
  const period = makePeriod({ paidAmount: 4500 });
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
