// domain/obligations/contribution.test.js
//
// WP-OBL-01 — pure unit tests, no mocking framework, no React, plain
// objects throughout. Style matches domain/schoolFees/settlement.test.js
// and creditNotes.test.js.

import test from "node:test";
import assert from "node:assert/strict";
import {
  ContributionValidationError,
  createContribution,
  withNewContribution,
  withoutContribution,
  getContributionsForObligation,
  getContributionsForTransaction,
  getTotalContributed,
  hasProtectedContributions,
} from "./contribution.js";

// A tiny, deterministic fake genId for assertions that care about the id
// value itself; most tests use a simple counter to avoid collisions.
function makeGenId(prefix = "c") {
  let n = 0;
  return () => `${prefix}${++n}`;
}

const VALID_INPUT = {
  obligationType: "schoolFeePeriod",
  obligationId: "period-may-2026",
  txnId: "txn-1",
  amount: 2000,
  txnAmount: 2000,
};

// --- createContribution: happy path ---

test("createContribution: valid input produces a record with all expected fields", () => {
  const genId = makeGenId();
  const c = createContribution(VALID_INPUT, genId);
  assert.equal(c.id, "c1");
  assert.equal(c.obligationType, "schoolFeePeriod");
  assert.equal(c.obligationId, "period-may-2026");
  assert.equal(c.txnId, "txn-1");
  assert.equal(c.amount, 2000);
  assert.equal(typeof c.createdAt, "number");
});

test("createContribution: amount may equal txnAmount exactly (whole transaction to one obligation)", () => {
  const genId = makeGenId();
  const c = createContribution({ ...VALID_INPUT, amount: 2000, txnAmount: 2000 }, genId);
  assert.equal(c.amount, 2000);
});

test("createContribution: amount may be less than txnAmount (partial contribution from a larger transaction — School's own multi-period evidence)", () => {
  const genId = makeGenId();
  const c = createContribution({ ...VALID_INPUT, amount: 500, txnAmount: 9000 }, genId);
  assert.equal(c.amount, 500);
});

test("createContribution: does not mutate the input object", () => {
  const genId = makeGenId();
  const input = { ...VALID_INPUT };
  const snapshot = JSON.stringify(input);
  createContribution(input, genId);
  assert.equal(JSON.stringify(input), snapshot);
});

test("createContribution: calls genId exactly once per call", () => {
  let calls = 0;
  const genId = () => { calls++; return "x1"; };
  createContribution(VALID_INPUT, genId);
  assert.equal(calls, 1);
});

// --- createContribution: required-field validation ---

test("createContribution: rejects missing obligationType", () => {
  const genId = makeGenId();
  assert.throws(() => createContribution({ ...VALID_INPUT, obligationType: "" }, genId), ContributionValidationError);
  assert.throws(() => createContribution({ ...VALID_INPUT, obligationType: undefined }, genId), ContributionValidationError);
});

test("createContribution: rejects missing obligationId", () => {
  const genId = makeGenId();
  assert.throws(() => createContribution({ ...VALID_INPUT, obligationId: "" }, genId), ContributionValidationError);
});

test("createContribution: rejects missing txnId", () => {
  const genId = makeGenId();
  assert.throws(() => createContribution({ ...VALID_INPUT, txnId: null }, genId), ContributionValidationError);
});

test("createContribution: rejects a whitespace-only reference string", () => {
  const genId = makeGenId();
  assert.throws(() => createContribution({ ...VALID_INPUT, obligationId: "   " }, genId), ContributionValidationError);
});

// --- createContribution: amount validation ---

test("createContribution: rejects zero amount", () => {
  const genId = makeGenId();
  assert.throws(() => createContribution({ ...VALID_INPUT, amount: 0 }, genId), ContributionValidationError);
});

test("createContribution: rejects negative amount", () => {
  const genId = makeGenId();
  assert.throws(() => createContribution({ ...VALID_INPUT, amount: -500 }, genId), ContributionValidationError);
});

test("createContribution: rejects non-finite amount (NaN, Infinity)", () => {
  const genId = makeGenId();
  assert.throws(() => createContribution({ ...VALID_INPUT, amount: NaN }, genId), ContributionValidationError);
  assert.throws(() => createContribution({ ...VALID_INPUT, amount: Infinity }, genId), ContributionValidationError);
});

test("createContribution: rejects zero/negative/non-finite txnAmount", () => {
  const genId = makeGenId();
  assert.throws(() => createContribution({ ...VALID_INPUT, txnAmount: 0 }, genId), ContributionValidationError);
  assert.throws(() => createContribution({ ...VALID_INPUT, txnAmount: -100 }, genId), ContributionValidationError);
  assert.throws(() => createContribution({ ...VALID_INPUT, txnAmount: NaN }, genId), ContributionValidationError);
});

test("createContribution: rejects amount exceeding txnAmount — the one structural (non-policy) invariant", () => {
  const genId = makeGenId();
  assert.throws(
    () => createContribution({ ...VALID_INPUT, amount: 3000, txnAmount: 2000 }, genId),
    ContributionValidationError
  );
});

test("createContribution: rejects a missing genId function, matching createSchoolCreditNote's identical precedent", () => {
  assert.throws(() => createContribution(VALID_INPUT, undefined), ContributionValidationError);
  assert.throws(() => createContribution(VALID_INPUT, "not-a-function"), ContributionValidationError);
});

// --- THE OVERPAYMENT BOUNDARY — proving OBL-001 Q1 is genuinely left open here ---

test("OBL-001 Q1 BOUNDARY: createContribution has no obligation-amount parameter at all — it cannot check overpayment against an obligation's remaining balance, by construction", () => {
  // There is no coreAmount / remaining / alreadyContributed input anywhere
  // in the accepted shape. This test exists to fail loudly if a future
  // change silently adds such a parameter without a corresponding update
  // to OBL-001 — the absence itself is the thing being asserted.
  const genId = makeGenId();
  const c = createContribution(VALID_INPUT, genId);
  const acceptedKeys = Object.keys(c).sort();
  assert.deepEqual(acceptedKeys, ["amount", "createdAt", "id", "obligationId", "obligationType", "txnId"].sort());
});

test("OBL-001 Q1 BOUNDARY: withNewContribution does not reject a Contribution that would, in aggregate, exceed a hypothetical obligation's own total — proving no overpayment policy is silently enforced", () => {
  const genId = makeGenId();
  // Simulate an obligation whose real core amount is 1000, already fully
  // contributed once, then contributed again — a real over-allocation
  // relative to the obligation, exactly the case OBL-001 Q1 leaves open.
  let contributions = [];
  contributions = withNewContribution(
    contributions,
    { obligationType: "bill", obligationId: "bill-1", txnId: "txn-a", amount: 1000, txnAmount: 1000 },
    genId
  );
  // This second contribution would push the obligation's total to 1500
  // against a presumed coreAmount of 1000 — School would reject this,
  // Person/Group would allow it as an advance. This module enforces
  // neither: it must succeed, because it has no obligation-amount context
  // to reject it with.
  assert.doesNotThrow(() =>
    withNewContribution(
      contributions,
      { obligationType: "bill", obligationId: "bill-1", txnId: "txn-b", amount: 500, txnAmount: 500 },
      genId
    )
  );
});

// --- withNewContribution ---

test("withNewContribution: appends to an existing array", () => {
  const genId = makeGenId();
  const prev = [{ id: "existing", obligationType: "bill", obligationId: "b1", txnId: "t0", amount: 100, createdAt: 1 }];
  const next = withNewContribution(prev, VALID_INPUT, genId);
  assert.equal(next.length, 2);
  assert.equal(next[0].id, "existing");
  assert.equal(next[1].obligationId, "period-may-2026");
});

test("withNewContribution: handles an empty or missing prior array", () => {
  const genId = makeGenId();
  assert.equal(withNewContribution([], VALID_INPUT, genId).length, 1);
  assert.equal(withNewContribution(undefined, VALID_INPUT, genId).length, 1);
  assert.equal(withNewContribution(null, VALID_INPUT, genId).length, 1);
});

test("withNewContribution: does not mutate the prior array", () => {
  const genId = makeGenId();
  const prev = [{ id: "existing", obligationType: "bill", obligationId: "b1", txnId: "t0", amount: 100, createdAt: 1 }];
  const prevSnapshot = JSON.stringify(prev);
  withNewContribution(prev, VALID_INPUT, genId);
  assert.equal(JSON.stringify(prev), prevSnapshot);
});

test("withNewContribution: invalid input throws and leaves the array completely unaffected (no partial write)", () => {
  const genId = makeGenId();
  const prev = [{ id: "existing", obligationType: "bill", obligationId: "b1", txnId: "t0", amount: 100, createdAt: 1 }];
  assert.throws(() => withNewContribution(prev, { ...VALID_INPUT, amount: -1 }, genId), ContributionValidationError);
  // prev itself must still be exactly one entry — the throw happened before
  // any array was ever constructed or returned.
  assert.equal(prev.length, 1);
});

// --- withoutContribution ---

test("withoutContribution: removes the matching record, leaves others untouched", () => {
  const contributions = [
    { id: "c1", obligationType: "bill", obligationId: "b1", txnId: "t1", amount: 100, createdAt: 1 },
    { id: "c2", obligationType: "bill", obligationId: "b1", txnId: "t2", amount: 200, createdAt: 2 },
  ];
  const next = withoutContribution(contributions, "c1");
  assert.equal(next.length, 1);
  assert.equal(next[0].id, "c2");
});

test("withoutContribution: a not-found id returns the array unchanged (tolerant removal, matching this codebase's own filter-based delete convention)", () => {
  const contributions = [{ id: "c1", obligationType: "bill", obligationId: "b1", txnId: "t1", amount: 100, createdAt: 1 }];
  const next = withoutContribution(contributions, "does-not-exist");
  assert.equal(next.length, 1);
  assert.equal(next[0].id, "c1");
});

test("withoutContribution: handles empty/missing input gracefully", () => {
  assert.deepEqual(withoutContribution([], "c1"), []);
  assert.deepEqual(withoutContribution(undefined, "c1"), []);
});

test("withoutContribution: does not mutate the input array", () => {
  const contributions = [{ id: "c1", obligationType: "bill", obligationId: "b1", txnId: "t1", amount: 100, createdAt: 1 }];
  const snapshot = JSON.stringify(contributions);
  withoutContribution(contributions, "c1");
  assert.equal(JSON.stringify(contributions), snapshot);
});

// --- Query direction 1: obligation -> contributions ---

test("getContributionsForObligation: returns only entries for the exact (obligationType, obligationId) pair", () => {
  const contributions = [
    { id: "c1", obligationType: "bill", obligationId: "b1", txnId: "t1", amount: 100, createdAt: 1 },
    { id: "c2", obligationType: "bill", obligationId: "b2", txnId: "t2", amount: 200, createdAt: 2 },
    { id: "c3", obligationType: "schoolFeePeriod", obligationId: "b1", txnId: "t3", amount: 300, createdAt: 3 },
  ];
  const result = getContributionsForObligation(contributions, "bill", "b1");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "c1");
});

test("getContributionsForObligation: preserves source array order (matches School's own tested order-preservation precedent for the equivalent concept)", () => {
  const contributions = [
    { id: "c1", obligationType: "bill", obligationId: "b1", txnId: "t1", amount: 100, createdAt: 1 },
    { id: "c2", obligationType: "bill", obligationId: "b1", txnId: "t2", amount: 200, createdAt: 2 },
    { id: "c3", obligationType: "bill", obligationId: "b1", txnId: "t3", amount: 300, createdAt: 3 },
  ];
  const result = getContributionsForObligation(contributions, "bill", "b1");
  assert.deepEqual(result.map(c => c.id), ["c1", "c2", "c3"]);
});

test("getContributionsForObligation: returns an empty array when nothing matches, not an error", () => {
  assert.deepEqual(getContributionsForObligation([], "bill", "b1"), []);
  assert.deepEqual(getContributionsForObligation(undefined, "bill", "b1"), []);
});

// --- Query direction 2: transaction -> obligation(s) ---

test("getContributionsForTransaction: returns only entries for the exact txnId", () => {
  const contributions = [
    { id: "c1", obligationType: "bill", obligationId: "b1", txnId: "t1", amount: 100, createdAt: 1 },
    { id: "c2", obligationType: "bill", obligationId: "b2", txnId: "t1", amount: 200, createdAt: 2 },
    { id: "c3", obligationType: "bill", obligationId: "b3", txnId: "t2", amount: 300, createdAt: 3 },
  ];
  const result = getContributionsForTransaction(contributions, "t1");
  assert.equal(result.length, 2);
});

test("getContributionsForTransaction: one real transaction CAN appear against more than one obligation at once — confirmed evidence from OBL-001 Section 5 (School's multi-period settlement), not an assumption this module limits", () => {
  const contributions = [
    { id: "c1", obligationType: "schoolFeePeriod", obligationId: "may-2026", txnId: "txn-shared", amount: 4500, createdAt: 1 },
    { id: "c2", obligationType: "schoolFeePeriod", obligationId: "june-2026", txnId: "txn-shared", amount: 4500, createdAt: 2 },
  ];
  const result = getContributionsForTransaction(contributions, "txn-shared");
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(c => c.obligationId).sort(), ["june-2026", "may-2026"]);
});

test("getContributionsForTransaction: returns an empty array when nothing matches, not an error", () => {
  assert.deepEqual(getContributionsForTransaction([], "t1"), []);
  assert.deepEqual(getContributionsForTransaction(undefined, "t1"), []);
});

// --- getTotalContributed ---

test("getTotalContributed: sums every Contribution's amount for one obligation", () => {
  const contributions = [
    { id: "c1", obligationType: "schoolFeePeriod", obligationId: "may-2026", txnId: "t1", amount: 2000, createdAt: 1 },
    { id: "c2", obligationType: "schoolFeePeriod", obligationId: "may-2026", txnId: "t2", amount: 2000, createdAt: 2 },
    { id: "c3", obligationType: "schoolFeePeriod", obligationId: "may-2026", txnId: "t3", amount: 500, createdAt: 3 },
  ];
  assert.equal(getTotalContributed(contributions, "schoolFeePeriod", "may-2026"), 4500);
});

test("getTotalContributed: ignores contributions belonging to a different obligation", () => {
  const contributions = [
    { id: "c1", obligationType: "bill", obligationId: "b1", txnId: "t1", amount: 100, createdAt: 1 },
    { id: "c2", obligationType: "bill", obligationId: "b2", txnId: "t2", amount: 9999, createdAt: 2 },
  ];
  assert.equal(getTotalContributed(contributions, "bill", "b1"), 100);
});

test("getTotalContributed: zero for an obligation with no contributions, not an error", () => {
  assert.equal(getTotalContributed([], "bill", "b1"), 0);
  assert.equal(getTotalContributed(undefined, "bill", "b1"), 0);
});

// --- hasProtectedContributions ---

test("hasProtectedContributions: false when no Contribution exists for this obligation", () => {
  assert.equal(hasProtectedContributions([], "bill", "b1"), false);
});

test("hasProtectedContributions: true as soon as one real Contribution exists", () => {
  const contributions = [{ id: "c1", obligationType: "bill", obligationId: "b1", txnId: "t1", amount: 1, createdAt: 1 }];
  assert.equal(hasProtectedContributions(contributions, "bill", "b1"), true);
});

test("hasProtectedContributions: does not consider a different obligation's contributions", () => {
  const contributions = [{ id: "c1", obligationType: "bill", obligationId: "b2", txnId: "t1", amount: 1, createdAt: 1 }];
  assert.equal(hasProtectedContributions(contributions, "bill", "b1"), false);
});
