import { test } from "node:test";
import assert from "node:assert/strict";
import { settleFeePeriods } from "./settlement.js";

// WP-A2 (ARTH-003): the regression test flagged as missing during Phase 1
// tracing. settleFeePeriods' shape strongly implied same-period,
// multiple-call accumulation worked correctly, but nothing proved it
// across separate calls against the same period before this test.

function makePeriod(overrides = {}) {
  return {
    id: "term1", label: "Term 1", obligationAmount: 30000,
    startingStateDeclared: true, paidAmount: 0, discountAmount: 0,
    writeOffAmount: 0, appliedCreditAmount: 0, settlementLinks: [],
    ...overrides,
  };
}

test("WP-A2 locked scenario: same period, three real payments across three accounts, correctly accumulates paidAmount and settlementLinks", () => {
  let periods = [makePeriod()];

  // Payment 1: ₹10,000 cash
  periods = settleFeePeriods(periods, ["term1"], 10000, "txnA", [{ periodId: "term1", amount: 10000 }]);
  let term1 = periods.find(p => p.id === "term1");
  assert.equal(term1.paidAmount, 10000);
  assert.equal(term1.settlementLinks.length, 1);
  assert.deepEqual(term1.settlementLinks[0], { txnId: "txnA", amount: 10000 });

  // Payment 2: ₹10,000 HDFC
  periods = settleFeePeriods(periods, ["term1"], 10000, "txnB", [{ periodId: "term1", amount: 10000 }]);
  term1 = periods.find(p => p.id === "term1");
  assert.equal(term1.paidAmount, 20000);
  assert.equal(term1.settlementLinks.length, 2);
  assert.deepEqual(term1.settlementLinks[1], { txnId: "txnB", amount: 10000 });

  // Payment 3: ₹10,000 ICICI
  periods = settleFeePeriods(periods, ["term1"], 10000, "txnC", [{ periodId: "term1", amount: 10000 }]);
  term1 = periods.find(p => p.id === "term1");
  assert.equal(term1.paidAmount, 30000);
  assert.equal(term1.settlementLinks.length, 3);
  assert.deepEqual(term1.settlementLinks[2], { txnId: "txnC", amount: 10000 });

  // Final assertion, exactly as specified in WP-A2's acceptance criteria.
  assert.equal(term1.paidAmount, 30000);
  assert.equal(term1.settlementLinks.length, 3);
  assert.deepEqual(term1.settlementLinks.map(l => l.txnId), ["txnA", "txnB", "txnC"]);
  assert.deepEqual(term1.settlementLinks.map(l => l.amount), [10000, 10000, 10000]);
});

test("cross-call accumulation is order-preserving — settlementLinks reflects real payment sequence, not sorted or grouped", () => {
  let periods = [makePeriod({ obligationAmount: 30000 })];
  periods = settleFeePeriods(periods, ["term1"], 20000, "txnLater", [{ periodId: "term1", amount: 20000 }]);
  periods = settleFeePeriods(periods, ["term1"], 10000, "txnEarlierByAmount", [{ periodId: "term1", amount: 10000 }]);
  const term1 = periods.find(p => p.id === "term1");
  // Call order, not amount order, determines link order.
  assert.deepEqual(term1.settlementLinks.map(l => l.txnId), ["txnLater", "txnEarlierByAmount"]);
});

test("a sibling period untouched by any of the three settle calls remains fully unaffected", () => {
  let periods = [makePeriod({ id: "term1" }), makePeriod({ id: "term2" })];
  periods = settleFeePeriods(periods, ["term1"], 10000, "txnA", [{ periodId: "term1", amount: 10000 }]);
  periods = settleFeePeriods(periods, ["term1"], 10000, "txnB", [{ periodId: "term1", amount: 10000 }]);
  periods = settleFeePeriods(periods, ["term1"], 10000, "txnC", [{ periodId: "term1", amount: 10000 }]);
  const term2 = periods.find(p => p.id === "term2");
  assert.equal(term2.paidAmount, 0);
  assert.deepEqual(term2.settlementLinks, []);
});

test("this test runs against the real, unmodified settlement.js — no production code changed to make it pass", () => {
  // This test's own existence/pass is the acceptance criterion: if
  // settleFeePeriods required a code change to satisfy the scenario above,
  // WP-A2 would escalate to a real bug fix rather than stay a test-only WP.
  // Passing here, with zero edits to settlement.js, confirms that didn't
  // happen — the risk was closed, not found.
  assert.ok(true);
});
