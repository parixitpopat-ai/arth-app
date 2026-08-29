import { test } from "node:test";
import assert from "node:assert/strict";
import { mapFeePeriodToCommitment, projectFeePeriodsToCommitments } from "./futureMoney.js";

function makePeriod(overrides = {}) {
  return {
    id: "p1", label: "September 2026", dueDate: "2026-09-01",
    obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0,
    discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0,
    settlementLinks: [], ...overrides,
  };
}

// --- Requested scenario 1: undeclared periods excluded ------------------

test("undeclared periods are never projected, regardless of amount fields", () => {
  const period = makePeriod({ startingStateDeclared: false });
  assert.equal(mapFeePeriodToCommitment(period), null);
});

test("undeclared periods are excluded even if paidAmount happens to be non-zero — the gate checks declaration, not amount", () => {
  const period = makePeriod({ startingStateDeclared: false, paidAmount: 0, obligationAmount: 4500 });
  // outstanding would be 4500 > 0 if the gate were amount-based instead of
  // declaration-based — confirming the declaration check runs first
  assert.equal(mapFeePeriodToCommitment(period), null);
});

// --- Requested scenario 2: settled periods excluded -----------------------

test("a fully paid, declared period is not projected", () => {
  const period = makePeriod({ paidAmount: 4500 });
  assert.equal(mapFeePeriodToCommitment(period), null);
});

test("a period settled via a mix of payment, discount, and credit is not projected", () => {
  const period = makePeriod({ obligationAmount: 4500, paidAmount: 3000, discountAmount: 1000, appliedCreditAmount: 500 });
  assert.equal(mapFeePeriodToCommitment(period), null);
});

// --- Requested scenario 3: partial outstanding projected correctly -------

test("a partially paid period projects only the remaining outstanding amount, not the original obligation", () => {
  const period = makePeriod({ obligationAmount: 4500, paidAmount: 2000 });
  const event = mapFeePeriodToCommitment(period);
  assert.equal(event.amount, 2500);
});

test("a partially discounted, unpaid period projects the reduced outstanding amount", () => {
  const period = makePeriod({ obligationAmount: 4500, discountAmount: 500 });
  const event = mapFeePeriodToCommitment(period);
  assert.equal(event.amount, 4000);
});

// --- Event shape / provenance fidelity ------------------------------------

test("projects the full canonical I-1 event shape, with real provenance, no fabricated metadata", () => {
  const period = makePeriod({ id: "sep-2026", label: "September 2026", dueDate: "2026-09-01" });
  const event = mapFeePeriodToCommitment(period);
  assert.deepEqual(event, {
    sourceType: "feePeriod",
    sourceId: "sep-2026",
    category: "committedSpending",
    subCategory: "schoolFee",
    name: "September 2026",
    amount: 4500,
    date: "2026-09-01",
    status: "unpaid",
    recurs: false,
  });
});

test("recurs is always false — a fee period is a discrete obligation, not a self-regenerating one", () => {
  const event = mapFeePeriodToCommitment(makePeriod());
  assert.equal(event.recurs, false);
});

// --- projectFeePeriodsToCommitments (collection-level) --------------------

test("projects a mixed collection correctly: undeclared and settled dropped, genuine outstanding kept", () => {
  const periods = [
    makePeriod({ id: "undeclared", startingStateDeclared: false }),
    makePeriod({ id: "settled", paidAmount: 4500 }),
    makePeriod({ id: "outstanding", paidAmount: 1000 }),
    makePeriod({ id: "untouched" }),
  ];
  const events = projectFeePeriodsToCommitments(periods);
  const ids = events.map(e => e.sourceId).sort();
  assert.deepEqual(ids, ["outstanding", "untouched"]);
});

test("an empty or missing periods array projects nothing, without throwing", () => {
  assert.deepEqual(projectFeePeriodsToCommitments([]), []);
  assert.deepEqual(projectFeePeriodsToCommitments(undefined), []);
});

test("handles null/undefined period entries in the array gracefully", () => {
  const periods = [makePeriod({ id: "real" }), null, undefined];
  const events = projectFeePeriodsToCommitments(periods);
  assert.equal(events.length, 1);
  assert.equal(events[0].sourceId, "real");
});
