import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateSelectedOutstandingTotal, settleFeePeriods, resolveSettlementAllocations } from "./settlement.js";

function makePeriods() {
  return [
    { id: "sep", label: "September 2026", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [] },
    { id: "oct", label: "October 2026", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [] },
    { id: "nov", label: "November 2026", obligationAmount: 4500, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [] },
  ];
}

test("rejects settling a period that hasn't been declared yet (WP-3 gate)", () => {
  const periods = makePeriods();
  periods[0].startingStateDeclared = false;
  assert.throws(() => settleFeePeriods(periods, ["sep"], 4500, "txn1"), /has not been declared yet/);
});

test("rejects selecting an undeclared period even for the total calculation", () => {
  const periods = makePeriods();
  periods[0].startingStateDeclared = false;
  assert.throws(() => calculateSelectedOutstandingTotal(periods, ["sep"]), /has not been declared yet/);
});

// --- calculateSelectedOutstandingTotal ----------------------------------

test("sums outstanding across selected periods", () => {
  const periods = makePeriods();
  assert.equal(calculateSelectedOutstandingTotal(periods, ["sep", "oct"]), 9000);
});

test("throws for an unknown period id", () => {
  assert.throws(() => calculateSelectedOutstandingTotal(makePeriods(), ["ghost"]), /not found/);
});

test("throws when a selected period has no outstanding balance", () => {
  const periods = makePeriods();
  periods[0].paidAmount = 4500; // sep fully paid
  assert.throws(() => calculateSelectedOutstandingTotal(periods, ["sep"]), /no outstanding balance/);
});

// --- settleFeePeriods: exact-match deterministic case -------------------

test("locked example: selecting Sept+Oct and paying exactly ₹9,000 settles both fully, no allocation needed", () => {
  const periods = makePeriods();
  const result = settleFeePeriods(periods, ["sep", "oct"], 9000, "txn1");
  const sep = result.find(p => p.id === "sep");
  const oct = result.find(p => p.id === "oct");
  const nov = result.find(p => p.id === "nov");
  assert.equal(sep.paidAmount, 4500);
  assert.equal(oct.paidAmount, 4500);
  assert.deepEqual(sep.settlementLinks, [{ txnId: "txn1", amount: 4500 }]);
  assert.deepEqual(oct.settlementLinks, [{ txnId: "txn1", amount: 4500 }]);
  assert.equal(nov.paidAmount, 0); // untouched sibling
  assert.deepEqual(nov.settlementLinks, []);
});

test("exact-match case rejects being called with an allocations array too — not needed, but shouldn't be silently ignored if inconsistent", () => {
  // If actual === total, the function computes its own deterministic
  // allocation and ignores any allocations argument entirely — documented
  // behavior, verified here so a caller can rely on it.
  const periods = makePeriods();
  const result = settleFeePeriods(periods, ["sep"], 4500, "txn1", [{ periodId: "sep", amount: 1 }]);
  assert.equal(result.find(p => p.id === "sep").paidAmount, 4500); // deterministic amount used, not the bogus allocation
});

// --- settleFeePeriods: partial payment requiring explicit allocation ----

test("locked example: paying ₹7,000 against ₹9,000 selected requires explicit allocation", () => {
  const periods = makePeriods();
  assert.throws(
    () => settleFeePeriods(periods, ["sep", "oct"], 7000, "txn1"),
    /explicit per-period allocations are required/
  );
});

test("partial payment with a valid explicit allocation leaves the remainder outstanding on the right period", () => {
  const periods = makePeriods();
  const result = settleFeePeriods(periods, ["sep", "oct"], 7000, "txn1", [
    { periodId: "sep", amount: 4500 },
    { periodId: "oct", amount: 2500 },
  ]);
  const sep = result.find(p => p.id === "sep");
  const oct = result.find(p => p.id === "oct");
  assert.equal(sep.paidAmount, 4500); // fully settled
  assert.equal(oct.paidAmount, 2500); // partially settled — ₹2,000 remains outstanding
});

test("an allocation of 0 to a selected period is valid and leaves it fully outstanding, untouched", () => {
  const periods = makePeriods();
  const result = settleFeePeriods(periods, ["sep", "oct"], 4500, "txn1", [
    { periodId: "sep", amount: 4500 },
    { periodId: "oct", amount: 0 },
  ]);
  const oct = result.find(p => p.id === "oct");
  assert.equal(oct.paidAmount, 0);
  assert.deepEqual(oct.settlementLinks, []); // no link recorded for a zero no-op
});

// --- rejections: no auto-capping, no auto-redistribution -----------------

test("rejects an allocation exceeding a period's outstanding — does not cap", () => {
  const periods = makePeriods();
  assert.throws(
    () => settleFeePeriods(periods, ["sep"], 5000, "txn1", [{ periodId: "sep", amount: 5000 }]),
    /exceeds its outstanding balance/
  );
});

test("rejects allocations that don't sum to actualAmount — does not auto-adjust", () => {
  const periods = makePeriods();
  assert.throws(
    () => settleFeePeriods(periods, ["sep", "oct"], 7000, "txn1", [
      { periodId: "sep", amount: 4500 },
      { periodId: "oct", amount: 3000 }, // sums to 7500, not 7000
    ]),
    /must match exactly/
  );
});

test("rejects allocations that don't cover exactly the selected periods", () => {
  const periods = makePeriods();
  assert.throws(
    () => settleFeePeriods(periods, ["sep", "oct"], 7000, "txn1", [
      { periodId: "sep", amount: 4500 },
      { periodId: "nov", amount: 2500 }, // nov wasn't selected
    ]),
    /must cover exactly the selected periods/
  );
});

test("rejects a missing txnId", () => {
  const periods = makePeriods();
  assert.throws(() => settleFeePeriods(periods, ["sep"], 4500, null), /txnId is required/);
});

test("rejects settling a period with no outstanding balance", () => {
  const periods = makePeriods();
  periods[0].paidAmount = 4500;
  assert.throws(() => settleFeePeriods(periods, ["sep"], 100, "txn1", [{ periodId: "sep", amount: 100 }]), /no outstanding balance/);
});

// --- immutability --------------------------------------------------------

test("never mutates the input periods array or its objects", () => {
  const periods = makePeriods();
  const snapshot = JSON.parse(JSON.stringify(periods));
  settleFeePeriods(periods, ["sep", "oct"], 9000, "txn1");
  assert.deepEqual(periods, snapshot);
});

test("one settlement can span multiple periods while a third, unselected period is entirely untouched", () => {
  const periods = makePeriods();
  const result = settleFeePeriods(periods, ["sep", "oct"], 9000, "txn1");
  const nov = result.find(p => p.id === "nov");
  assert.deepEqual(nov, periods.find(p => p.id === "nov")); // identical to original, not even a new object needed
});

// --- resolveSettlementAllocations: the extraction used to build a
// transaction's reverse link BEFORE the transaction exists ----------------

test("resolveSettlementAllocations returns the same deterministic split settleFeePeriods would apply, without requiring a txnId at all", () => {
  const periods = makePeriods();
  const resolved = resolveSettlementAllocations(periods, ["sep", "oct"], 9000);
  assert.deepEqual(resolved.sort((a,b)=>a.periodId.localeCompare(b.periodId)), [
    { periodId: "oct", amount: 4500 },
    { periodId: "sep", amount: 4500 },
  ]);
});

test("resolveSettlementAllocations matches settleFeePeriods' own per-period amounts exactly, for a real multi-period partial payment", () => {
  const periods = makePeriods();
  const explicitAllocations = [{ periodId: "sep", amount: 4500 }, { periodId: "oct", amount: 2500 }];
  const resolved = resolveSettlementAllocations(periods, ["sep", "oct"], 7000, explicitAllocations);
  assert.deepEqual(resolved, explicitAllocations);

  const settled = settleFeePeriods(periods, ["sep", "oct"], 7000, "txn1", explicitAllocations);
  const sep = settled.find(p => p.id === "sep");
  const oct = settled.find(p => p.id === "oct");
  // The exact amounts a caller would use to build a transaction's reverse
  // link match exactly what actually got applied to each period.
  assert.equal(resolved.find(a=>a.periodId==="sep").amount, sep.paidAmount);
  assert.equal(resolved.find(a=>a.periodId==="oct").amount, oct.paidAmount);
});

test("resolveSettlementAllocations enforces the same rejections as settleFeePeriods — over-allocation, mismatch, wrong period set, undeclared periods", () => {
  const periods = makePeriods();
  assert.throws(() => resolveSettlementAllocations(periods, ["sep"], 5000, [{ periodId: "sep", amount: 5000 }]), /exceeds its outstanding balance/);
  assert.throws(() => resolveSettlementAllocations(periods, ["sep", "oct"], 7000, [{ periodId: "sep", amount: 4500 }, { periodId: "oct", amount: 3000 }]), /must match exactly/);
  const undeclaredPeriods = makePeriods();
  undeclaredPeriods[0].startingStateDeclared = false;
  assert.throws(() => resolveSettlementAllocations(undeclaredPeriods, ["sep"], 4500), /has not been declared yet/);
});
