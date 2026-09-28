import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPolicyToCommitment, projectPoliciesToCommitments } from "./futureMoney.js";

test("mapPolicyToCommitment: a policy 90 days out with no linkedBillId is projected, no forward cap applied", () => {
  const policy = { id: "p1", name: "Star Health", premiumAmount: 15000, renewalDate: "2026-12-27", linkedBillId: null };
  const commitment = mapPolicyToCommitment(policy);
  assert.equal(commitment.sourceType, "insurancePolicy");
  assert.equal(commitment.sourceId, "p1");
  assert.equal(commitment.category, "committedSpending");
  assert.equal(commitment.name, "Star Health");
  assert.equal(commitment.amount, 15000);
  assert.equal(commitment.date, "2026-12-27");
  assert.equal(commitment.status, "unpaid");
});

test("mapPolicyToCommitment: a policy with a linkedBillId is skipped — its Bill already projects it, never shown twice", () => {
  assert.equal(mapPolicyToCommitment({ id: "p1", name: "Legacy", premiumAmount: 5000, renewalDate: "2026-09-01", linkedBillId: "bill1" }), null);
});

test("mapPolicyToCommitment: an archived policy is skipped", () => {
  assert.equal(mapPolicyToCommitment({ id: "p1", name: "Old", premiumAmount: 5000, renewalDate: "2026-09-01", linkedBillId: null, status: "archived" }), null);
});

test("mapPolicyToCommitment: a policy with no renewalDate is skipped, never guessed", () => {
  assert.equal(mapPolicyToCommitment({ id: "p1", name: "Incomplete", premiumAmount: 5000, linkedBillId: null }), null);
});

test("projectPoliciesToCommitments: silently drops linked/archived policies, keeps the rest", () => {
  const insurancePolicies = [
    { id: "p1", name: "New", premiumAmount: 5000, renewalDate: "2026-12-01", linkedBillId: null },
    { id: "p2", name: "Legacy", premiumAmount: 6000, renewalDate: "2026-11-01", linkedBillId: "bill1" },
  ];
  const items = projectPoliciesToCommitments(insurancePolicies);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceId, "p1");
});

test("projectPoliciesToCommitments: no policies is a safe no-op", () => {
  assert.deepEqual(projectPoliciesToCommitments([]), []);
  assert.deepEqual(projectPoliciesToCommitments(null), []);
});
