import test from "node:test";
import assert from "node:assert/strict";
import { computeLineItemCategoryRollup, rollupToCatAllocations } from "../lineItemCategoryRollup.js";

// WP18c-fix (Pay Fees mixed category) — the owner's own example: Tuition + Registration (both
// uncategorized, fee-linked) + one unrelated categorized line, all three on one Transaction's
// lineItems[].
const mixedLineItems = () => [
  { id: "fee-term1-tuition", label: "Tuition", qty: 1, unitPrice: 18000, catId: null, subId: null, feePeriodId: "term1-tuition" },
  { id: "fee-term1-registration", label: "Registration", qty: 1, unitPrice: 2000, catId: null, subId: null, feePeriodId: "term1-registration" },
  { id: "extra-1", label: "Books", qty: 1, unitPrice: 1200, catId: "cat-books", subId: "sub-stationery" },
];

test("computeLineItemCategoryRollup: uncategorized fee lines contribute to neither catIds nor catAmounts", () => {
  const rollup = computeLineItemCategoryRollup(mixedLineItems());
  assert.deepEqual(rollup.catIds, ["cat-books"]);
  assert.equal(rollup.catId, "cat-books");
  assert.deepEqual(rollup.subIds, ["sub-stationery"]);
  assert.equal(rollup.catAmounts["cat-books"], 1200);
  assert.equal(rollup.uncategorizedCount, 2);
  assert.deepEqual(rollup.uncategorizedLabels.sort(), ["Registration", "Tuition"]);
});

test("computeLineItemCategoryRollup: catId is the largest-amount category when several are present", () => {
  const rollup = computeLineItemCategoryRollup([
    { id: "a", label: "A", qty: 1, unitPrice: 500, catId: "cat-small" },
    { id: "b", label: "B", qty: 1, unitPrice: 5000, catId: "cat-big" },
  ]);
  assert.equal(rollup.catId, "cat-big");
  assert.deepEqual(rollup.catIds, ["cat-big", "cat-small"]);
});

test("computeLineItemCategoryRollup: empty/missing lineItems yields an all-null/empty rollup", () => {
  const rollup = computeLineItemCategoryRollup([]);
  assert.equal(rollup.catId, null);
  assert.deepEqual(rollup.catIds, []);
  assert.equal(rollup.uncategorizedCount, 0);
  assert.deepEqual(computeLineItemCategoryRollup(undefined).catIds, []);
});

test("rollupToCatAllocations: pins the one real category to its own exact amount, excluding the uncategorized fee lines entirely", () => {
  const rollup = computeLineItemCategoryRollup(mixedLineItems());
  const allocations = rollupToCatAllocations(rollup);
  assert.deepEqual(allocations, { "cat-books": 1200 });
});

test("rollupToCatAllocations: returns null when nothing is categorized (never writes an empty {} that Path 1 would treat as 'explicit split of nothing')", () => {
  const rollup = computeLineItemCategoryRollup([
    { id: "fee-1", label: "Tuition", qty: 1, unitPrice: 18000, catId: null },
  ]);
  assert.equal(rollupToCatAllocations(rollup), null);
});

test("rollupToCatAllocations: splits exact dollar amounts across 2+ real categories too", () => {
  const rollup = computeLineItemCategoryRollup([
    { id: "a", label: "A", qty: 1, unitPrice: 300, catId: "cat-x" },
    { id: "b", label: "B", qty: 1, unitPrice: 700, catId: "cat-y" },
  ]);
  assert.deepEqual(rollupToCatAllocations(rollup), { "cat-y": 700, "cat-x": 300 });
});
