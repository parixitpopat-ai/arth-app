import { test } from "node:test";
import assert from "node:assert/strict";
import { getInsuranceRenewalReminders } from "./renewalReminders.js";

test("getInsuranceRenewalReminders: an overdue policy with no linkedBillId is surfaced", () => {
  const insurancePolicies = [{ id: "p1", name: "LIC Jeevan Anand", premiumAmount: 18000, renewalDate: "2026-09-01", insuredPerson: "Parixit", linkedBillId: null }];
  const items = getInsuranceRenewalReminders({ insurancePolicies, today: "2026-09-28" });
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "LIC Jeevan Anand");
  assert.equal(items[0].amount, 18000);
  assert.equal(items[0].kind, "overdue");
  assert.equal(items[0].days, 27);
  assert.equal(items[0].sourceType, "insurance");
  assert.equal(items[0].policyId, "p1");
  assert.equal(items[0].forText, "Parixit");
  assert.equal(items[0].id, "insurance:p1");
});

test("getInsuranceRenewalReminders: renewing within forwardDays is surfaced as 'renewing'", () => {
  const insurancePolicies = [{ id: "p1", name: "Car Policy", premiumAmount: 6000, renewalDate: "2026-10-02", linkedBillId: null }];
  const items = getInsuranceRenewalReminders({ insurancePolicies, today: "2026-09-28" });
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "renewing");
  assert.equal(items[0].days, 4);
});

test("getInsuranceRenewalReminders: a policy with a linkedBillId is skipped — its Bill already surfaces it, never shown twice", () => {
  const insurancePolicies = [{ id: "p1", name: "Legacy policy", premiumAmount: 5000, renewalDate: "2026-09-01", linkedBillId: "bill1" }];
  assert.deepEqual(getInsuranceRenewalReminders({ insurancePolicies, today: "2026-09-28" }), []);
});

test("getInsuranceRenewalReminders: an archived policy is skipped", () => {
  const insurancePolicies = [{ id: "p1", name: "Old policy", premiumAmount: 5000, renewalDate: "2026-09-01", linkedBillId: null, status: "archived" }];
  assert.deepEqual(getInsuranceRenewalReminders({ insurancePolicies, today: "2026-09-28" }), []);
});

test("getInsuranceRenewalReminders: due further out than forwardDays is omitted", () => {
  const insurancePolicies = [{ id: "p1", name: "Far off", premiumAmount: 5000, renewalDate: "2026-12-01", linkedBillId: null }];
  assert.deepEqual(getInsuranceRenewalReminders({ insurancePolicies, today: "2026-09-28" }), []);
});

test("getInsuranceRenewalReminders: no policies is a safe no-op", () => {
  assert.deepEqual(getInsuranceRenewalReminders({ insurancePolicies: [], today: "2026-09-28" }), []);
  assert.deepEqual(getInsuranceRenewalReminders({ insurancePolicies: null, today: "2026-09-28" }), []);
});
