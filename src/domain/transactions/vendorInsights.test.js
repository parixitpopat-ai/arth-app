// WP-B-1 regression tests.

import test from "node:test";
import assert from "node:assert";
import { getTxnsForVendor, getVendorAggregate, getFrequentVendors, getFrequentItemsForVendor } from "./vendorInsights.js";

const sampleTxns = [
  { id: "t1", type: "expense", merchant: "Amazon", date: "2026-09-10", amount: 1028,
    lineItems: [
      { label: "Aashirvaad Atta", qty: 1, unitPrice: 520, amount: 520, catId: "groceries", subId: "g1" },
      { label: "Shampoo", qty: 1, unitPrice: 350, amount: 350, catId: "lifestyle", subId: "l3" },
      { label: "Toothpaste", qty: 1, unitPrice: 158, amount: 158, catId: "lifestyle", subId: "l3" },
    ] },
  { id: "t2", type: "expense", merchant: "amazon", date: "2026-09-12", amount: 552,
    lineItems: [
      { label: "Milk", qty: 4, unitPrice: 32, amount: 128, catId: "groceries", subId: "g4" },
      { label: "Shampoo", qty: 1, unitPrice: 350, amount: 350, catId: "lifestyle", subId: "l3" },
      { label: "atta", qty: 1, unitPrice: 74, amount: 74, catId: "groceries", subId: "g1" },
    ] },
  { id: "t3", type: "expense", merchant: "Swiggy", date: "2026-09-11", amount: 420, catId: "food", catIds: ["food"] },
  { id: "t4", type: "expense", merchant: "", date: "2026-09-13", amount: 32,
    lineItems: [{ label: "Milk", qty: 1, unitPrice: 32, amount: 32, catId: "groceries", subId: "g4" }] },
];

test("getTxnsForVendor: case-insensitive match, most-recent-first", () => {
  const result = getTxnsForVendor(sampleTxns, "AMAZON");
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "t2");
  assert.equal(result[1].id, "t1");
});

test("getTxnsForVendor: blank/missing merchant returns empty, never matches item-only txns", () => {
  assert.deepEqual(getTxnsForVendor(sampleTxns, ""), []);
  assert.deepEqual(getTxnsForVendor(sampleTxns, "   "), []);
});

test("getVendorAggregate: totals, category spend, and item frequency across case-variant merchant names", () => {
  const agg = getVendorAggregate(sampleTxns, "Amazon");
  assert.equal(agg.transactionCount, 2);
  assert.equal(agg.totalSpend, 1028 + 552);
  assert.equal(agg.categorySpend.groceries, 520 + 128 + 74);
  // FIX: Toothpaste is also catId:"lifestyle" — category-level spend correctly includes it
  // regardless of item label. The Shampoo-only total (700) is checked separately below at the
  // ITEM level (same-label only), which is a different, correct assertion.
  assert.equal(agg.categorySpend.lifestyle, 350 + 350 + 158);
  const shampoo = agg.items.find(i => i.label.toLowerCase() === "shampoo");
  assert.equal(shampoo.count, 2);
  assert.equal(shampoo.totalSpend, 700);
});

test("getVendorAggregate: non-itemized transaction still contributes to categorySpend via its own catIds", () => {
  const agg = getVendorAggregate(sampleTxns, "Swiggy");
  assert.equal(agg.transactionCount, 1);
  assert.equal(agg.totalSpend, 420);
  assert.equal(agg.categorySpend.food, 420);
  assert.deepEqual(agg.items, []);
});

test("getVendorAggregate: unknown vendor returns a well-formed empty result, not an error", () => {
  const agg = getVendorAggregate(sampleTxns, "NoSuchVendor");
  assert.equal(agg.transactionCount, 0);
  assert.equal(agg.totalSpend, 0);
  assert.deepEqual(agg.categorySpend, {});
  assert.deepEqual(agg.items, []);
});

test("getFrequentVendors: ranked by count, excludes blank-merchant (item-only) transactions", () => {
  const vendors = getFrequentVendors(sampleTxns, 10);
  const names = vendors.map(v => v.merchant.toLowerCase());
  assert.ok(names.includes("amazon"));
  assert.ok(names.includes("swiggy"));
  assert.equal(names.includes(""), false);
  const amazon = vendors.find(v => v.merchant.toLowerCase() === "amazon");
  assert.equal(amazon.count, 2);
  assert.equal(amazon.totalSpend, 1028 + 552);
});

test("getFrequentVendors: respects the limit parameter", () => {
  const vendors = getFrequentVendors(sampleTxns, 1);
  assert.equal(vendors.length, 1);
  assert.equal(vendors[0].merchant.toLowerCase(), "amazon");
});

test("getFrequentItemsForVendor: ranks by frequency, most-recent unit price/qty wins (not summed/averaged)", () => {
  const items = getFrequentItemsForVendor(sampleTxns, "Amazon", 10);
  const shampoo = items.find(i => i.label.toLowerCase() === "shampoo");
  assert.equal(shampoo.count, 2);
  assert.equal(shampoo.lastUnitPrice, 350);
});

test("getFrequentItemsForVendor: item never purchased at this vendor is absent, not fabricated", () => {
  const items = getFrequentItemsForVendor(sampleTxns, "Swiggy", 10);
  assert.deepEqual(items, []);
});

test("getFrequentItemsForVendor: unknown vendor returns empty array, not an error", () => {
  assert.deepEqual(getFrequentItemsForVendor(sampleTxns, "NoSuchVendor", 10), []);
});
