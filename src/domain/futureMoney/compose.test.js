import { test } from "node:test";
import assert from "node:assert/strict";
import { composeFutureMoneyCommitments } from "./compose.js";

function billEvent(overrides = {}) {
  return {
    sourceType: "bill", sourceId: "bill1", category: "committedSpending",
    subCategory: "scheduledObligation", name: "Electricity Bill",
    amount: 2400, date: "2026-09-03", status: "unpaid", recurs: false,
    ...overrides,
  };
}

function sipEvent(overrides = {}) {
  return {
    sourceType: "recurringSchedule", sourceId: "sched1", category: "committedSaving",
    subCategory: undefined, name: "Mutual Fund SIP",
    amount: 5000, date: "2026-09-05", status: "active", recurs: true,
    ...overrides,
  };
}

function feePeriodEvent(overrides = {}) {
  return {
    sourceType: "feePeriod", sourceId: "period1", category: "committedSpending",
    subCategory: "schoolFee", name: "September 2026",
    amount: 4500, date: "2026-09-01", status: "unpaid", recurs: false,
    ...overrides,
  };
}

// --- merge ------------------------------------------------------------

test("merges getCommitments() output with an additional School Fees source", () => {
  const commitmentsResult = { committedSpending: [billEvent()], committedSaving: [sipEvent()] };
  const result = composeFutureMoneyCommitments(commitmentsResult, [[feePeriodEvent()]]);
  assert.equal(result.committedSpending.length, 2);
  assert.equal(result.committedSaving.length, 1);
  assert.deepEqual(result.committedSpending.map(e => e.sourceId).sort(), ["bill1", "period1"]);
});

test("supports more than one additional source at once", () => {
  const commitmentsResult = { committedSpending: [billEvent()], committedSaving: [] };
  const secondFutureSource = [feePeriodEvent({ sourceId: "period2", sourceType: "someOtherAdapter" })];
  const result = composeFutureMoneyCommitments(commitmentsResult, [[feePeriodEvent()], secondFutureSource]);
  assert.equal(result.committedSpending.length, 3);
});

// --- Debt Service: present in shape, never fabricated --------------------

test("debtService is always present in the output shape, and always empty since no adapter exists yet", () => {
  const result = composeFutureMoneyCommitments({ committedSpending: [billEvent()], committedSaving: [] }, [[feePeriodEvent()]]);
  assert.deepEqual(result.debtService, []);
});

test("debtService stays empty even with no sources at all", () => {
  const result = composeFutureMoneyCommitments(null, []);
  assert.deepEqual(result.debtService, []);
});

// --- ordering ---------------------------------------------------------

test("preserves order: getCommitments() entries first, then additional sources in the order given, each internally in input order", () => {
  const commitmentsResult = { committedSpending: [billEvent({ sourceId: "b1" }), billEvent({ sourceId: "b2" })], committedSaving: [] };
  const schoolFeeSource = [feePeriodEvent({ sourceId: "p1" }), feePeriodEvent({ sourceId: "p2" })];
  const result = composeFutureMoneyCommitments(commitmentsResult, [schoolFeeSource]);
  assert.deepEqual(result.committedSpending.map(e => e.sourceId), ["b1", "b2", "p1", "p2"]);
});

// --- deduplication -------------------------------------------------------

test("deduplicates by (sourceType, sourceId) — first occurrence wins, later duplicate dropped", () => {
  const duplicateEvent = billEvent({ sourceId: "bill1", amount: 999999 }); // same sourceType+sourceId as the canonical one, different amount
  const commitmentsResult = { committedSpending: [billEvent({ sourceId: "bill1", amount: 2400 })], committedSaving: [] };
  const result = composeFutureMoneyCommitments(commitmentsResult, [[duplicateEvent]]);
  assert.equal(result.committedSpending.length, 1); // not 2
  assert.equal(result.committedSpending[0].amount, 2400); // the first (canonical) one survived, not the duplicate
});

test("does not deduplicate genuinely distinct events with different sourceIds, even if other fields match", () => {
  const commitmentsResult = { committedSpending: [billEvent({ sourceId: "bill1" })], committedSaving: [] };
  const similarButDistinct = feePeriodEvent({ sourceId: "bill1_lookalike", name: "Electricity Bill", amount: 2400 });
  const result = composeFutureMoneyCommitments(commitmentsResult, [[similarButDistinct]]);
  assert.equal(result.committedSpending.length, 2); // both kept — different sourceId
});

test("a malformed event (missing sourceType/sourceId/category) is safely skipped, not thrown", () => {
  const commitmentsResult = { committedSpending: [billEvent()], committedSaving: [] };
  const malformed = [{ name: "broken, no sourceType or sourceId" }, null, undefined];
  assert.doesNotThrow(() => composeFutureMoneyCommitments(commitmentsResult, [malformed]));
  const result = composeFutureMoneyCommitments(commitmentsResult, [malformed]);
  assert.equal(result.committedSpending.length, 1); // only the valid one kept
});

// --- empty sources ------------------------------------------------------

test("handles a completely empty/missing getCommitments() result", () => {
  const result = composeFutureMoneyCommitments(null, [[feePeriodEvent()]]);
  assert.equal(result.committedSpending.length, 1);
  assert.deepEqual(result.committedSaving, []);
});

test("handles no additional sources at all", () => {
  const commitmentsResult = { committedSpending: [billEvent()], committedSaving: [sipEvent()] };
  const result = composeFutureMoneyCommitments(commitmentsResult);
  assert.equal(result.committedSpending.length, 1);
  assert.equal(result.committedSaving.length, 1);
});

test("handles everything empty — returns valid, empty structure, never throws", () => {
  const result = composeFutureMoneyCommitments(null, []);
  assert.deepEqual(result, { committedSpending: [], committedSaving: [], debtService: [] });
});

test("handles an additional source that is itself an empty array", () => {
  const commitmentsResult = { committedSpending: [billEvent()], committedSaving: [] };
  const result = composeFutureMoneyCommitments(commitmentsResult, [[]]);
  assert.equal(result.committedSpending.length, 1);
});

// --- provenance preservation ----------------------------------------------

test("every field on a composed event is exactly what the source produced — nothing added, removed, or altered", () => {
  const original = feePeriodEvent();
  const result = composeFutureMoneyCommitments(null, [[original]]);
  assert.deepEqual(result.committedSpending[0], original);
});

test("sourceType and sourceId survive composition unchanged for every event, across both canonical and additional sources", () => {
  const bill = billEvent({ sourceId: "bill1" });
  const sip = sipEvent({ sourceId: "sched1" });
  const fee = feePeriodEvent({ sourceId: "period1" });
  const result = composeFutureMoneyCommitments({ committedSpending: [bill], committedSaving: [sip] }, [[fee]]);

  const spendingBill = result.committedSpending.find(e => e.sourceId === "bill1");
  assert.equal(spendingBill.sourceType, "bill");
  const spendingFee = result.committedSpending.find(e => e.sourceId === "period1");
  assert.equal(spendingFee.sourceType, "feePeriod");
  const saving = result.committedSaving.find(e => e.sourceId === "sched1");
  assert.equal(saving.sourceType, "recurringSchedule");
});

test("composition never mutates the input arrays or objects", () => {
  const commitmentsResult = { committedSpending: [billEvent()], committedSaving: [sipEvent()] };
  const schoolFeeSource = [feePeriodEvent()];
  // Compare against independently-constructed fresh fixtures, not a JSON
  // round-trip snapshot — JSON.stringify silently drops keys whose value
  // is `undefined` (sipEvent() legitimately has subCategory: undefined,
  // matching the real I-1 shape), which would make a JSON-based snapshot
  // a false negative here even when nothing was actually mutated.
  const expectedCommitments = { committedSpending: [billEvent()], committedSaving: [sipEvent()] };
  const expectedSchoolFee = [feePeriodEvent()];
  composeFutureMoneyCommitments(commitmentsResult, [schoolFeeSource]);
  assert.deepEqual(commitmentsResult, expectedCommitments);
  assert.deepEqual(schoolFeeSource, expectedSchoolFee);
});
