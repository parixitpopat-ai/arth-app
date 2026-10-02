import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRenewalNoticeBill, applyRenewalNoticeToPolicy, describeRenewalDifference } from "./renewalNotice.js";

const policy = { id: "pol1", name: "HDFC Ergo Optima Secure", provider: "HDFC Ergo", premiumAmount: 24600, premiumFrequency: "annual", renewalDate: "2026-11-12" };

test("buildRenewalNoticeBill: F4's own example — amount differs from expected, document optional", () => {
  const bill = buildRenewalNoticeBill({ policy, amount: 26180, dueDate: "2026-11-12", documentBase64: null, today: "2026-10-02", id: "bill1" });
  assert.equal(bill.id, "bill1");
  assert.equal(bill.name, "HDFC Ergo Optima Secure Renewal");
  assert.equal(bill.amount, 26180);
  assert.equal(bill.dueDate, "2026-11-12");
  assert.equal(bill.status, "unpaid");
  assert.equal(bill.insurancePolicyId, "pol1");
  assert.equal(bill.isInsuranceRenewal, true);
  assert.equal(bill.imageBase64, null);
  assert.equal(bill.billerAccountId, null);
  // recurring so next year's premium can regenerate itself via the existing confirmMarkBillPaid
  // recurring-regeneration path, never via a second Expected->Bill promotion.
  assert.equal(bill.recurring, true);
  assert.equal(bill.frequency, "yearly");
});

test("buildRenewalNoticeBill: carries an uploaded notice document through unchanged", () => {
  const bill = buildRenewalNoticeBill({ policy, amount: 24600, dueDate: "2026-11-12", documentBase64: "data:image/png;base64,abc", today: "2026-10-02", id: "bill2" });
  assert.equal(bill.imageBase64, "data:image/png;base64,abc");
});

test("buildRenewalNoticeBill: maps every premium frequency to the Bill's own frequency vocabulary", () => {
  assert.equal(buildRenewalNoticeBill({ policy: { ...policy, premiumFrequency: "monthly" }, amount: 1, dueDate: "2026-01-01", today: "2026-01-01", id: "x" }).frequency, "monthly");
  assert.equal(buildRenewalNoticeBill({ policy: { ...policy, premiumFrequency: "quarterly" }, amount: 1, dueDate: "2026-01-01", today: "2026-01-01", id: "x" }).frequency, "quarterly");
  assert.equal(buildRenewalNoticeBill({ policy: { ...policy, premiumFrequency: "halfyearly" }, amount: 1, dueDate: "2026-01-01", today: "2026-01-01", id: "x" }).frequency, "halfyearly");
  assert.equal(buildRenewalNoticeBill({ policy: { ...policy, premiumFrequency: "annual" }, amount: 1, dueDate: "2026-01-01", today: "2026-01-01", id: "x" }).frequency, "yearly");
  assert.equal(buildRenewalNoticeBill({ policy: { ...policy, premiumFrequency: undefined }, amount: 1, dueDate: "2026-01-01", today: "2026-01-01", id: "x" }).frequency, "yearly");
});

test("applyRenewalNoticeToPolicy: replaces, never duplicates — sets linkedBillId, leaves everything else alone", () => {
  const bill = buildRenewalNoticeBill({ policy, amount: 26180, dueDate: "2026-11-12", today: "2026-10-02", id: "bill1" });
  const updated = applyRenewalNoticeToPolicy(policy, bill);
  assert.equal(updated.linkedBillId, "bill1");
  assert.equal(updated.renewalNoticeAddedDate, "2026-10-02");
  assert.equal(updated.name, policy.name);
  assert.equal(updated.id, policy.id);
  // the original policy object itself is never mutated
  assert.equal(policy.linkedBillId, undefined);
});

test("describeRenewalDifference: F4's own example — ₹1,580 more than expected", () => {
  assert.deepEqual(describeRenewalDifference(24600, 26180), { amount: 1580, direction: "more" });
});

test("describeRenewalDifference: entered less than expected", () => {
  assert.deepEqual(describeRenewalDifference(24600, 20000), { amount: 4600, direction: "less" });
});

test("describeRenewalDifference: null when amounts match exactly (never shown as a warning either way)", () => {
  assert.equal(describeRenewalDifference(24600, 24600), null);
});

test("describeRenewalDifference: null when there's no expected amount to compare against", () => {
  assert.equal(describeRenewalDifference(0, 24600), null);
  assert.equal(describeRenewalDifference(null, 24600), null);
});

test("describeRenewalDifference: rounds to the nearest rupee", () => {
  assert.deepEqual(describeRenewalDifference(100, 100.6), { amount: 1, direction: "more" });
});
