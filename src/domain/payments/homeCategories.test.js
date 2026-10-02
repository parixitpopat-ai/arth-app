import { test } from "node:test";
import assert from "node:assert/strict";
import { groupConnectionsByCategory, categoryForBillerType } from "./homeCategories.js";

test("groupConnectionsByCategory: categories with attention sort before categories without", () => {
  const cats = groupConnectionsByCategory([
    { id: "1", categoryLabel: "Water", name: "MMC Common", hasOverdueOrDueBill: false },
    { id: "2", categoryLabel: "Electricity", name: "Society Meter", hasOverdueOrDueBill: true },
    { id: "3", categoryLabel: "Electricity", name: "House Meter", hasOverdueOrDueBill: false },
  ]);
  assert.deepEqual(cats.map(c => c.label), ["Electricity", "Water"]);
  assert.equal(cats[0].needsAttention, true);
  assert.equal(cats[1].needsAttention, false);
});

test("groupConnectionsByCategory: categories with no attention sort alphabetically by label", () => {
  const cats = groupConnectionsByCategory([
    { id: "1", categoryLabel: "Water", name: "MMC Common", hasOverdueOrDueBill: false },
    { id: "2", categoryLabel: "Broadband & Recharges", name: "Jio Mobile", hasOverdueOrDueBill: false },
    { id: "3", categoryLabel: "Insurance", name: "HDFC Ergo", hasOverdueOrDueBill: false },
  ]);
  assert.deepEqual(cats.map(c => c.label), ["Broadband & Recharges", "Insurance", "Water"]);
});

test("groupConnectionsByCategory: a category is expanded on load only if a connection in it has an Overdue/Due bill", () => {
  const cats = groupConnectionsByCategory([
    { id: "1", categoryLabel: "Electricity", name: "Society Meter", hasOverdueOrDueBill: true },
    { id: "2", categoryLabel: "Water", name: "MMC Common", hasOverdueOrDueBill: false },
  ]);
  const electricity = cats.find(c => c.label === "Electricity");
  const water = cats.find(c => c.label === "Water");
  assert.equal(electricity.expanded, true);
  assert.equal(water.expanded, false);
});

test("groupConnectionsByCategory: within a category, connections needing attention sort first, then by name", () => {
  const cats = groupConnectionsByCategory([
    { id: "1", categoryLabel: "Electricity", name: "House Meter", hasOverdueOrDueBill: false },
    { id: "2", categoryLabel: "Electricity", name: "Office Meter", hasOverdueOrDueBill: false },
    { id: "3", categoryLabel: "Electricity", name: "Society Meter", hasOverdueOrDueBill: true },
  ]);
  const electricity = cats.find(c => c.label === "Electricity");
  assert.deepEqual(electricity.connections.map(c => c.name), ["Society Meter", "House Meter", "Office Meter"]);
});

test("groupConnectionsByCategory: count reflects every connection in the category", () => {
  const cats = groupConnectionsByCategory([
    { id: "1", categoryLabel: "Electricity", name: "A", hasOverdueOrDueBill: false },
    { id: "2", categoryLabel: "Electricity", name: "B", hasOverdueOrDueBill: false },
    { id: "3", categoryLabel: "Electricity", name: "C", hasOverdueOrDueBill: false },
  ]);
  assert.equal(cats.find(c => c.label === "Electricity").count, 3);
});

test("groupConnectionsByCategory: empty input yields no categories", () => {
  assert.deepEqual(groupConnectionsByCategory([]), []);
  assert.deepEqual(groupConnectionsByCategory(undefined), []);
});

test("categoryForBillerType: maps plain bill types to their own category", () => {
  assert.equal(categoryForBillerType("Electricity"), "Electricity");
  assert.equal(categoryForBillerType("Water"), "Water");
});

test("categoryForBillerType: bundles recharge/broadband types into Broadband & Recharges", () => {
  assert.equal(categoryForBillerType("Mobile Prepaid"), "Broadband & Recharges");
  assert.equal(categoryForBillerType("Broadband"), "Broadband & Recharges");
  assert.equal(categoryForBillerType("DTH"), "Broadband & Recharges");
});

test("categoryForBillerType: bundles membership types into Health & Fitness", () => {
  assert.equal(categoryForBillerType("Gym / Fitness"), "Health & Fitness");
  assert.equal(categoryForBillerType("Club Membership"), "Health & Fitness");
});

test("categoryForBillerType: School/Education Fees map to Education, Insurance to Insurance", () => {
  assert.equal(categoryForBillerType("School Fees"), "Education");
  assert.equal(categoryForBillerType("Education Fees"), "Education");
  assert.equal(categoryForBillerType("Insurance"), "Insurance");
});

test("categoryForBillerType: unknown type falls back to Other bills, never empty", () => {
  assert.equal(categoryForBillerType("Something New"), "Other bills");
  assert.equal(categoryForBillerType(undefined), "Other bills");
});
