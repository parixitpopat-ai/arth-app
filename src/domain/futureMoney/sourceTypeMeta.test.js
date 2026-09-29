import { test } from "node:test";
import assert from "node:assert/strict";
import { getSourceTypeLabel, getDisplayStatus, getSplitLabel, isEstimatedOccurrence } from "./sourceTypeMeta.js";
import { STATUS } from "../../constants/theme.js";

test("getSourceTypeLabel returns the handoff's exact seven labels", () => {
  assert.equal(getSourceTypeLabel("bill"), "Bill");
  assert.equal(getSourceTypeLabel("ccStatement"), "Card statement");
  assert.equal(getSourceTypeLabel("recurringSchedule"), "Scheduled");
  assert.equal(getSourceTypeLabel("feePeriod"), "School fee");
  assert.equal(getSourceTypeLabel("debt"), "Loan");
  assert.equal(getSourceTypeLabel("membership"), "Membership");
  assert.equal(getSourceTypeLabel("insurancePolicy"), "Insurance");
});

test("getSourceTypeLabel falls back to the raw sourceType for anything unknown, never throws", () => {
  assert.equal(getSourceTypeLabel("somethingNew"), "somethingNew");
  assert.equal(getSourceTypeLabel(undefined), "");
});

test("getDisplayStatus returns STATUS token keys matching the handoff's Next 30 days mock exactly", () => {
  assert.equal(getDisplayStatus("bill"), "due");
  assert.equal(getDisplayStatus("ccStatement"), "due");
  assert.equal(getDisplayStatus("membership"), "expected");
  assert.equal(getDisplayStatus("debt"), "scheduled");
  assert.equal(getDisplayStatus("recurringSchedule"), "scheduled");
  assert.equal(getDisplayStatus("feePeriod"), "unpaid");
  assert.equal(getDisplayStatus("insurancePolicy"), "scheduled");
});

test("getDisplayStatus's keys all resolve in the shared STATUS token table", () => {
  for (const sourceType of ["bill", "ccStatement", "membership", "debt", "recurringSchedule", "feePeriod", "insurancePolicy"]) {
    const key = getDisplayStatus(sourceType);
    assert.ok(STATUS[key], `STATUS.${key} must exist for sourceType ${sourceType}`);
  }
});

test("getSplitLabel maps the three canonical categories to Spending/Saving/Debt", () => {
  assert.equal(getSplitLabel("committedSpending"), "Spending");
  assert.equal(getSplitLabel("committedSaving"), "Saving");
  assert.equal(getSplitLabel("debtService"), "Debt");
  assert.equal(getSplitLabel("somethingElse"), "Spending");
});

test("isEstimatedOccurrence: membership is always an estimate, in every section", () => {
  assert.equal(isEstimatedOccurrence("membership", "next30"), true);
  assert.equal(isEstimatedOccurrence("membership", "everyMonth"), true);
  assert.equal(isEstimatedOccurrence("membership", "monthBucket"), true);
});

test("isEstimatedOccurrence: bill/ccStatement/feePeriod are real in next30, estimates once projected", () => {
  for (const sourceType of ["bill", "ccStatement", "feePeriod"]) {
    assert.equal(isEstimatedOccurrence(sourceType, "next30"), false, `${sourceType} in next30`);
    assert.equal(isEstimatedOccurrence(sourceType, "everyMonth"), true, `${sourceType} in everyMonth`);
    assert.equal(isEstimatedOccurrence(sourceType, "monthBucket"), true, `${sourceType} in monthBucket`);
  }
});

test("isEstimatedOccurrence: debt, recurringSchedule and insurancePolicy are fixed by contract, never an estimate", () => {
  for (const sourceType of ["debt", "recurringSchedule", "insurancePolicy"]) {
    assert.equal(isEstimatedOccurrence(sourceType, "next30"), false, `${sourceType} in next30`);
    assert.equal(isEstimatedOccurrence(sourceType, "everyMonth"), false, `${sourceType} in everyMonth`);
    assert.equal(isEstimatedOccurrence(sourceType, "monthBucket"), false, `${sourceType} in monthBucket`);
  }
});
