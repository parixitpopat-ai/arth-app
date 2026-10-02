import { test } from "node:test";
import assert from "node:assert/strict";
import { isEligibleForAddBill, buildWhichConnectionList } from "./whichConnection.js";

test("excludes Credit Card, Education, Prepaid/recharge and narrow-Membership types", () => {
  assert.equal(isEligibleForAddBill("Credit Card"), false);
  assert.equal(isEligibleForAddBill("School Fees"), false);
  assert.equal(isEligibleForAddBill("Education Fees"), false);
  assert.equal(isEligibleForAddBill("Mobile Prepaid"), false);
  assert.equal(isEligibleForAddBill("Fastag"), false);
  assert.equal(isEligibleForAddBill("Gym / Fitness"), false);
  assert.equal(isEligibleForAddBill("Club Membership"), false);
  assert.equal(isEligibleForAddBill("Society Maintenance"), false);
  assert.equal(isEligibleForAddBill("Rental"), false);
});

test("includes plain bills and, notably, Insurance", () => {
  assert.equal(isEligibleForAddBill("Electricity"), true);
  assert.equal(isEligibleForAddBill("Water"), true);
  assert.equal(isEligibleForAddBill("Broadband"), true);
  assert.equal(isEligibleForAddBill("Insurance"), true);
});

const conn = (over) => ({ id: over.id, billerType: over.billerType || "Electricity", categoryLabel: over.categoryLabel || "Electricity", name: over.name || over.id, hasOverdueOrDueBill: !!over.hasOverdueOrDueBill });

test("buildWhichConnectionList excludes ineligible connections entirely, even if 'recent'", () => {
  const connections = [conn({ id: "edu", billerType: "School Fees" }), conn({ id: "elec" })];
  const { recent, categories } = buildWhichConnectionList(connections, ["edu", "elec"]);
  assert.ok(!recent.some(c => c.id === "edu"));
  assert.ok(!categories.some(cat => cat.connections.some(c => c.id === "edu")));
});

test("buildWhichConnectionList caps recent at 3, most-recent-first", () => {
  const connections = ["a", "b", "c", "d"].map(id => conn({ id }));
  const { recent } = buildWhichConnectionList(connections, ["d", "c", "b", "a"]);
  assert.deepEqual(recent.map(c => c.id), ["d", "c", "b"]);
});

test("connections not in recentIds fall into the grouped categories list, not duplicated in recent", () => {
  const connections = [conn({ id: "a" }), conn({ id: "b", categoryLabel: "Water" })];
  const { recent, categories } = buildWhichConnectionList(connections, ["a"]);
  assert.deepEqual(recent.map(c => c.id), ["a"]);
  const allInCategories = categories.flatMap(cat => cat.connections.map(c => c.id));
  assert.deepEqual(allInCategories, ["b"]);
});
