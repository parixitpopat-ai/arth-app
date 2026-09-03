// src/screens/SchoolFeesScreen.helpers.test.js
//
// PPL-006 WP-4 — tests for resolveSchoolAttribution, the pure decision
// logic behind AddSchoolYearModal's new Person/biller-account picker.
// Same discipline as BudgetInsights.test.js: tests the exported pure
// function directly, no React/DOM harness.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSchoolAttribution } from "./SchoolFeesScreen.helpers.js";

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
