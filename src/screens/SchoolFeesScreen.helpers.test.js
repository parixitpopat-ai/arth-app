// src/screens/SchoolFeesScreen.helpers.test.js
//
// PPL-006 WP-4 — tests for resolveSchoolAttribution, the pure decision
// logic behind AddSchoolYearModal's new Person/biller-account picker.
// Same discipline as BudgetInsights.test.js: tests the exported pure
// function directly, no React/DOM harness.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSchoolAttribution, isBillerAccountSharedAcrossSchedules, attemptSchoolAttributionChange } from "./SchoolFeesScreen.helpers.js";

let idCounter = 0;
const genId = () => `id_${++idCounter}`;

test("no personId (falsy) — returns the exact pre-WP-4 shape: both ids null, nothing to create", () => {
  const result = resolveSchoolAttribution({
    personId: null, schoolName: "Springdale Academy", startDate: "2026-06-01",
    billerAccounts: [], schoolRelationships: [], genId,
  });
  assert.deepEqual(result, { billerAccountId: null, newBillerAccount: null, newRelationship: null });
});

test("empty-string personId is treated the same as null — the picker's 'not linked' sentinel", () => {
  const result = resolveSchoolAttribution({
    personId: "", schoolName: "Springdale Academy", startDate: "2026-06-01",
    billerAccounts: [], schoolRelationships: [], genId,
  });
  assert.equal(result.billerAccountId, null);
});

test("a person selected, no existing School Fees biller account for them — creates both a new biller account and a new relationship", () => {
  const result = resolveSchoolAttribution({
    personId: "vyom_id", schoolName: "Springdale Academy", startDate: "2026-06-01",
    billerAccounts: [], schoolRelationships: [], genId,
  });
  assert.ok(result.newBillerAccount);
  assert.equal(result.newBillerAccount.type, "School Fees");
  assert.equal(result.newBillerAccount.name, "Springdale Academy");
  assert.equal(result.newBillerAccount.attributedTo, "vyom_id");
  assert.equal(result.newBillerAccount.attributeType, "person");
  assert.ok(result.newRelationship);
  assert.equal(result.newRelationship.billerAccountId, result.newBillerAccount.id);
  assert.equal(result.newRelationship.personId, "vyom_id");
  assert.equal(result.billerAccountId, result.newBillerAccount.id);
});

test("a person selected, a School Fees biller account already attributed to them exists — reuses it, does not create a duplicate", () => {
  const existingAccount = { id: "ba1", type: "School Fees", attributeType: "person", attributedTo: "vyom_id", name: "Springdale Academy" };
  const result = resolveSchoolAttribution({
    personId: "vyom_id", schoolName: "Springdale Academy (different typed name)", startDate: "2027-06-01",
    billerAccounts: [existingAccount], schoolRelationships: [], genId,
  });
  assert.equal(result.newBillerAccount, null); // no duplicate created
  assert.equal(result.billerAccountId, "ba1");
  assert.ok(result.newRelationship); // relationship still needed — first time this pairing is linked
  assert.equal(result.newRelationship.billerAccountId, "ba1");
});

test("a person selected, both the biller account AND a current relationship for that pairing already exist — reuses both, creates nothing", () => {
  const existingAccount = { id: "ba1", type: "School Fees", attributeType: "person", attributedTo: "vyom_id", name: "Springdale Academy" };
  const existingRel = { id: "rel1", billerAccountId: "ba1", personId: "vyom_id", status: "active", statusHistory: [] };
  const result = resolveSchoolAttribution({
    personId: "vyom_id", schoolName: "Springdale Academy", startDate: "2027-06-01",
    billerAccounts: [existingAccount], schoolRelationships: [existingRel], genId,
  });
  assert.deepEqual(result, { billerAccountId: "ba1", newBillerAccount: null, newRelationship: null });
});

test("a School Fees biller account exists but attributed to a DIFFERENT person — not matched, a new one is created for this person", () => {
  const otherPersonsAccount = { id: "ba1", type: "School Fees", attributeType: "person", attributedTo: "rahul_id", name: "Some Other School" };
  const result = resolveSchoolAttribution({
    personId: "vyom_id", schoolName: "Springdale Academy", startDate: "2026-06-01",
    billerAccounts: [otherPersonsAccount], schoolRelationships: [], genId,
  });
  assert.ok(result.newBillerAccount);
  assert.notEqual(result.billerAccountId, "ba1");
  assert.equal(result.newBillerAccount.attributedTo, "vyom_id");
});

test("a biller account of a DIFFERENT type attributed to this person (e.g. Insurance) is not matched — School Fees only", () => {
  const insuranceAccount = { id: "ba1", type: "Insurance", attributeType: "person", attributedTo: "vyom_id", name: "LIC" };
  const result = resolveSchoolAttribution({
    personId: "vyom_id", schoolName: "Springdale Academy", startDate: "2026-06-01",
    billerAccounts: [insuranceAccount], schoolRelationships: [], genId,
  });
  assert.ok(result.newBillerAccount);
  assert.notEqual(result.billerAccountId, "ba1");
});

test("genId is required whenever a personId is provided — same discipline as createSchoolRelationship", () => {
  assert.throws(
    () => resolveSchoolAttribution({ personId: "vyom_id", schoolName: "X", startDate: "2026-06-01", billerAccounts: [], schoolRelationships: [] }),
    /genId is required/
  );
});

test("works correctly for the __me__ sentinel, same as any other person id", () => {
  const result = resolveSchoolAttribution({
    personId: "__me__", schoolName: "Springdale Academy", startDate: "2026-06-01",
    billerAccounts: [], schoolRelationships: [], genId,
  });
  assert.equal(result.newBillerAccount.attributedTo, "__me__");
  assert.equal(result.newRelationship.personId, "__me__");
});

test("never mutates the input collections", () => {
  const billerAccounts = [{ id: "ba1", type: "School Fees", attributeType: "person", attributedTo: "vyom_id", name: "Springdale Academy" }];
  const schoolRelationships = [];
  const baSnapshot = JSON.parse(JSON.stringify(billerAccounts));
  const srSnapshot = JSON.parse(JSON.stringify(schoolRelationships));
  resolveSchoolAttribution({ personId: "vyom_id", schoolName: "X", startDate: "2026-06-01", billerAccounts, schoolRelationships, genId });
  assert.deepEqual(billerAccounts, baSnapshot);
  assert.deepEqual(schoolRelationships, srSnapshot);
});

// --- PPL-006 WP-6: isBillerAccountSharedAcrossSchedules ---------------------

test("isBillerAccountSharedAcrossSchedules: false when no feeSchedules reference this billerAccountId", () => {
  assert.equal(isBillerAccountSharedAcrossSchedules("ba1", [], undefined), false);
});

test("isBillerAccountSharedAcrossSchedules: false when exactly one schedule references it (the common case)", () => {
  const feeSchedules = [{ id: "sched1", billerAccountId: "ba1" }];
  assert.equal(isBillerAccountSharedAcrossSchedules("ba1", feeSchedules, undefined), false);
});

test("isBillerAccountSharedAcrossSchedules: true when two DIFFERENT schedules reference it", () => {
  const feeSchedules = [{ id: "sched1", billerAccountId: "ba1" }, { id: "sched2", billerAccountId: "ba1" }];
  assert.equal(isBillerAccountSharedAcrossSchedules("ba1", feeSchedules, undefined), true);
});

test("isBillerAccountSharedAcrossSchedules: excludeScheduleId correctly excludes the schedule being edited — one other schedule left over still counts as shared", () => {
  const feeSchedules = [{ id: "sched1", billerAccountId: "ba1" }, { id: "sched2", billerAccountId: "ba1" }];
  assert.equal(isBillerAccountSharedAcrossSchedules("ba1", feeSchedules, "sched1"), true);
});

test("isBillerAccountSharedAcrossSchedules: excluding the ONLY schedule that references it leaves nothing — not shared", () => {
  const feeSchedules = [{ id: "sched1", billerAccountId: "ba1" }];
  assert.equal(isBillerAccountSharedAcrossSchedules("ba1", feeSchedules, "sched1"), false);
});

test("isBillerAccountSharedAcrossSchedules: schedules referencing a DIFFERENT billerAccountId don't count", () => {
  const feeSchedules = [{ id: "sched1", billerAccountId: "ba2" }, { id: "sched2", billerAccountId: "ba3" }];
  assert.equal(isBillerAccountSharedAcrossSchedules("ba1", feeSchedules, undefined), false);
});

// --- PPL-006 WP-6: attemptSchoolAttributionChange ---------------------------

test("attemptSchoolAttributionChange: no-op when target equals current — nothing to end, nothing to create", () => {
  const result = attemptSchoolAttributionChange({
    billerAccountId: "ba1", currentPersonId: "vyom_id", targetPersonId: "vyom_id", startDate: "2026-06-01",
    feeSchedules: [], schoolRelationships: [], genId,
  });
  assert.deepEqual(result, { ok: true, error: null, attributedTo: "vyom_id", attributeType: "person", endedRelationship: null, newOrReusedRelationship: null });
});

test("attemptSchoolAttributionChange: null-to-null (both unattributed) is also a no-op", () => {
  const result = attemptSchoolAttributionChange({
    billerAccountId: "ba1", currentPersonId: null, targetPersonId: null, startDate: "2026-06-01",
    feeSchedules: [], schoolRelationships: [], genId,
  });
  assert.deepEqual(result, { ok: true, error: null, attributedTo: null, attributeType: null, endedRelationship: null, newOrReusedRelationship: null });
});

test("attemptSchoolAttributionChange: SHARED account refuses the change entirely, regardless of direction", () => {
  const feeSchedules = [{ id: "sched1", billerAccountId: "ba1" }, { id: "sched2", billerAccountId: "ba1" }];
  const result = attemptSchoolAttributionChange({
    billerAccountId: "ba1", currentPersonId: "vyom_id", targetPersonId: "rahul_id", excludeScheduleId: "sched1", startDate: "2026-06-01",
    feeSchedules, schoolRelationships: [], genId,
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /shared/i);
  assert.equal(result.endedRelationship, null);
  assert.equal(result.newOrReusedRelationship, null);
});

test("attemptSchoolAttributionChange: NOT shared — reassigning to a new person ends the old relationship and creates a new one", () => {
  const existingRel = { id: "rel1", billerAccountId: "ba1", personId: "vyom_id", status: "active", statusHistory: [{ status: "active", effectiveDate: "2025-06-01", timestamp: 1 }] };
  const result = attemptSchoolAttributionChange({
    billerAccountId: "ba1", currentPersonId: "vyom_id", targetPersonId: "rahul_id", startDate: "2026-06-01",
    feeSchedules: [{ id: "sched1", billerAccountId: "ba1" }], schoolRelationships: [existingRel], genId,
  });
  assert.equal(result.ok, true);
  assert.equal(result.attributedTo, "rahul_id");
  assert.equal(result.attributeType, "person");
  assert.ok(result.endedRelationship);
  assert.equal(result.endedRelationship.id, "rel1");
  assert.equal(result.endedRelationship.status, "ended");
  assert.ok(result.newOrReusedRelationship);
  assert.equal(result.newOrReusedRelationship.personId, "rahul_id");
  assert.equal(result.newOrReusedRelationship.billerAccountId, "ba1");
});

test("attemptSchoolAttributionChange: unlinking (target null) ends the current relationship, returns null attribution, creates nothing new", () => {
  const existingRel = { id: "rel1", billerAccountId: "ba1", personId: "vyom_id", status: "active", statusHistory: [{ status: "active", effectiveDate: "2025-06-01", timestamp: 1 }] };
  const result = attemptSchoolAttributionChange({
    billerAccountId: "ba1", currentPersonId: "vyom_id", targetPersonId: null, startDate: "2026-06-01",
    feeSchedules: [{ id: "sched1", billerAccountId: "ba1" }], schoolRelationships: [existingRel], genId,
  });
  assert.equal(result.ok, true);
  assert.equal(result.attributedTo, null);
  assert.equal(result.attributeType, null);
  assert.ok(result.endedRelationship);
  assert.equal(result.endedRelationship.status, "ended");
  assert.equal(result.newOrReusedRelationship, null);
});

test("attemptSchoolAttributionChange: linking for the first time (current null, target real) — no relationship to end, one created", () => {
  const result = attemptSchoolAttributionChange({
    billerAccountId: "ba1", currentPersonId: null, targetPersonId: "vyom_id", startDate: "2026-06-01",
    feeSchedules: [{ id: "sched1", billerAccountId: "ba1" }], schoolRelationships: [], genId,
  });
  assert.equal(result.ok, true);
  assert.equal(result.attributedTo, "vyom_id");
  assert.equal(result.endedRelationship, null);
  assert.ok(result.newOrReusedRelationship);
});

test("attemptSchoolAttributionChange: re-linking to a person with an EXISTING CURRENT relationship for this account reuses it — does not create a duplicate", () => {
  const currentRel = { id: "rel1", billerAccountId: "ba1", personId: "rahul_id", status: "active", statusHistory: [{ status: "active", effectiveDate: "2025-06-01", timestamp: 1 }] };
  const result = attemptSchoolAttributionChange({
    billerAccountId: "ba1", currentPersonId: null, targetPersonId: "rahul_id", startDate: "2026-06-01",
    feeSchedules: [{ id: "sched1", billerAccountId: "ba1" }], schoolRelationships: [currentRel], genId,
  });
  assert.equal(result.ok, true);
  assert.equal(result.attributedTo, "rahul_id");
  assert.equal(result.newOrReusedRelationship, null); // reused, nothing new to append
  assert.equal(result.endedRelationship, null); // currentPersonId was null — nothing to end
});

test("attemptSchoolAttributionChange: re-linking to a person whose relationship for this account is ENDED creates a genuinely NEW one — never resurrects the ended one", () => {
  const endedRel = { id: "rel1", billerAccountId: "ba1", personId: "rahul_id", status: "ended", statusHistory: [
    { status: "active", effectiveDate: "2024-06-01", timestamp: 1 },
    { status: "ended", effectiveDate: "2025-04-30", timestamp: 2, reason: "left" },
  ] };
  const result = attemptSchoolAttributionChange({
    billerAccountId: "ba1", currentPersonId: null, targetPersonId: "rahul_id", startDate: "2026-06-01",
    feeSchedules: [{ id: "sched1", billerAccountId: "ba1" }], schoolRelationships: [endedRel], genId,
  });
  assert.equal(result.ok, true);
  assert.ok(result.newOrReusedRelationship);
  assert.notEqual(result.newOrReusedRelationship.id, "rel1"); // a fresh relationship, not the ended one
});

test("attemptSchoolAttributionChange: billerAccountId is required", () => {
  assert.throws(
    () => attemptSchoolAttributionChange({ billerAccountId: null, currentPersonId: null, targetPersonId: "vyom_id", startDate: "2026-06-01", feeSchedules: [], schoolRelationships: [], genId }),
    /billerAccountId is required/
  );
});

test("attemptSchoolAttributionChange: never mutates the input collections", () => {
  const existingRel = { id: "rel1", billerAccountId: "ba1", personId: "vyom_id", status: "active", statusHistory: [{ status: "active", effectiveDate: "2025-06-01", timestamp: 1 }] };
  const feeSchedules = [{ id: "sched1", billerAccountId: "ba1" }];
  const schoolRelationships = [existingRel];
  const fsSnapshot = JSON.parse(JSON.stringify(feeSchedules));
  const srSnapshot = JSON.parse(JSON.stringify(schoolRelationships));
  attemptSchoolAttributionChange({ billerAccountId: "ba1", currentPersonId: "vyom_id", targetPersonId: "rahul_id", startDate: "2026-06-01", feeSchedules, schoolRelationships, genId });
  assert.deepEqual(feeSchedules, fsSnapshot);
  assert.deepEqual(schoolRelationships, srSnapshot);
});
