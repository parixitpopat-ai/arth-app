import { test } from "node:test";
import assert from "node:assert/strict";
import { billPaymentLabel, suggestBillPaymentVendors } from "./billVendorSuggestions.js";

const forHome = () => "Home";

test("label reads '<bill> Bill Payment for <For>' without doubling the word Bill", () => {
  assert.equal(billPaymentLabel("Electricity", "Home"), "Electricity Bill Payment for Home");
  assert.equal(billPaymentLabel("Electricity Bill", "Home"), "Electricity Bill Payment for Home");
  assert.equal(billPaymentLabel("Airtel Fiber", "Aarav"), "Airtel Fiber Bill Payment for Aarav");
});

test("an unassigned or missing For is left out of the label", () => {
  assert.equal(billPaymentLabel("Electricity", "Unassigned"), "Electricity Bill Payment");
  assert.equal(billPaymentLabel("Electricity", ""), "Electricity Bill Payment");
  assert.equal(billPaymentLabel("", "Home"), "");
});

test("typing part of a bill name offers its label; unpaid bills come first and duplicates collapse", () => {
  const bills = [
    { id: 1, name: "Electricity", status: "paid" },
    { id: 2, name: "Electricity", status: "unpaid" },
    { id: 3, name: "Electric Scooter EMI", status: "unpaid" },
    { id: 4, name: "Water", status: "unpaid" },
  ];
  assert.deepEqual(suggestBillPaymentVendors({ query: "elec", bills, getForLabel: forHome }),
    ["Electricity Bill Payment for Home", "Electric Scooter EMI Bill Payment for Home"]);
  assert.deepEqual(suggestBillPaymentVendors({ query: "water", bills, getForLabel: forHome }), ["Water Bill Payment for Home"]);
});

test("card statements, cancelled bills and nameless bills are never offered; empty query offers nothing", () => {
  const bills = [
    { id: 1, name: "HDFC Statement", status: "unpaid", isCcStatement: true },
    { id: 2, name: "Old Gym", status: "cancelled" },
    { id: 3, name: "", status: "unpaid" },
  ];
  assert.deepEqual(suggestBillPaymentVendors({ query: "hdfc", bills, getForLabel: forHome }), []);
  assert.deepEqual(suggestBillPaymentVendors({ query: "gym", bills, getForLabel: forHome }), []);
  assert.deepEqual(suggestBillPaymentVendors({ query: "", bills: [{ id: 9, name: "Water", status: "unpaid" }], getForLabel: forHome }), []);
});

test("the limit caps the list", () => {
  const bills = ["Gas", "Garbage", "Garden", "Garage"].map((name, i) => ({ id: i, name, status: "unpaid" }));
  assert.equal(suggestBillPaymentVendors({ query: "ga", bills, getForLabel: forHome, limit: 2 }).length, 2);
});
