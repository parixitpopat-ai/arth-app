import test from "node:test";
import assert from "node:assert/strict";
import { evaluateObservedBalance, OBSERVATION_OUTCOME } from "../evaluateObservedBalance.js";

test("no checkpoint, observed matches (within threshold) -> MATCHES", () => {
  const result = evaluateObservedBalance({ effectiveBalance: 5000, existingCheckpoint: null, observedBalance: 5000.005 });
  assert.equal(result.outcome, OBSERVATION_OUTCOME.MATCHES);
});

test("no checkpoint, observed differs beyond threshold -> NO_CHECKPOINT, correct diff", () => {
  const result = evaluateObservedBalance({ effectiveBalance: 5000, existingCheckpoint: null, observedBalance: 5300 });
  assert.equal(result.outcome, OBSERVATION_OUTCOME.NO_CHECKPOINT);
  assert.equal(result.diff, 300);
});

test("existing checkpoint, observed matches effectiveBalance -> MATCHES, not RECONCILED_DISCREPANCY", () => {
  const result = evaluateObservedBalance({
    effectiveBalance: 5200, // already includes the reconciliation gap
    existingCheckpoint: { amount: 5200, date: "2026-08-01" },
    observedBalance: 5200,
  });
  assert.equal(result.outcome, OBSERVATION_OUTCOME.MATCHES);
});

test("existing checkpoint, observed differs from effectiveBalance -> RECONCILED_DISCREPANCY, never NO_CHECKPOINT", () => {
  const result = evaluateObservedBalance({
    effectiveBalance: 5200,
    existingCheckpoint: { amount: 5200, date: "2026-08-01" },
    observedBalance: 5500,
  });
  assert.equal(result.outcome, OBSERVATION_OUTCOME.RECONCILED_DISCREPANCY);
  assert.equal(result.diff, 300);
});

test("comparison baseline is always effectiveBalance, regardless of checkpoint presence — this is the core bug fix", () => {
  // Same observed value, same effectiveBalance, only checkpoint presence differs.
  const withoutCheckpoint = evaluateObservedBalance({ effectiveBalance: 5200, existingCheckpoint: null, observedBalance: 5500 });
  const withCheckpoint = evaluateObservedBalance({ effectiveBalance: 5200, existingCheckpoint: { amount: 5200, date: "2026-08-01" }, observedBalance: 5500 });
  assert.equal(withoutCheckpoint.diff, withCheckpoint.diff, "the diff itself must be identical — only the outcome category differs based on checkpoint presence");
  assert.equal(withoutCheckpoint.baseline, withCheckpoint.baseline);
});

test("a checkpoint object with no date is treated as no checkpoint at all (matches accountReconciliationGap's own !checkpoint?.date guard)", () => {
  const result = evaluateObservedBalance({ effectiveBalance: 5000, existingCheckpoint: { amount: 5000 }, observedBalance: 5300 });
  assert.equal(result.outcome, OBSERVATION_OUTCOME.NO_CHECKPOINT);
});

test("custom threshold is respected", () => {
  const result = evaluateObservedBalance({ effectiveBalance: 5000, existingCheckpoint: null, observedBalance: 5050, threshold: 100 });
  assert.equal(result.outcome, OBSERVATION_OUTCOME.MATCHES);
});

test("negative diff (observed is lower than effective) is handled identically to positive", () => {
  const result = evaluateObservedBalance({ effectiveBalance: 5000, existingCheckpoint: null, observedBalance: 4700 });
  assert.equal(result.outcome, OBSERVATION_OUTCOME.NO_CHECKPOINT);
  assert.equal(result.diff, -300);
});

test("pure — never mutates any input object", () => {
  const checkpoint = { amount: 5200, date: "2026-08-01" };
  const frozen = JSON.stringify(checkpoint);
  evaluateObservedBalance({ effectiveBalance: 5200, existingCheckpoint: checkpoint, observedBalance: 5500 });
  assert.equal(JSON.stringify(checkpoint), frozen);
});
