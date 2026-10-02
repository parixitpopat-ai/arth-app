// domain/insights/spending.test.js
// Characterization + unit tests for buildCategorySeries and buildSubcategoryBreakdown,
// promoted here from src/screens/BudgetInsights.test.js (WP8) — same discipline as
// domain/allocations/*.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCategorySeries, buildSubcategoryBreakdown, getCategorySpendBreakdown, getTopMerchants } from "./spending.js";
import { getCategoryAttributedTotal } from "../allocations/adapter.js";

// ============================================================
// Category View trailing window
// ============================================================

function txn(date, catId, amt) {
  return { type: "expense", date, catId, amount: amt, people: {} };
}

test("category window: 6+ months of real data → exactly 6 periods shown", () => {
  const txns = [
    txn("2026-03-05", "cat1", 100),
    txn("2026-04-05", "cat1", 100),
    txn("2026-05-05", "cat1", 100),
    txn("2026-06-05", "cat1", 100),
    txn("2026-07-05", "cat1", 100),
    txn("2026-08-05", "cat1", 100),
  ];
  const series = buildCategorySeries("cat1", "2026-08", txns);
  assert.equal(series.length, 6);
  assert.equal(series[series.length - 1].key, "2026-08"); // anchor is last (most recent)
});

test("category window: fewer than 6 months of data → only available periods shown, no padding", () => {
  const txns = [
    txn("2026-06-10", "cat1", 50),
    txn("2026-07-10", "cat1", 75),
    txn("2026-08-10", "cat1", 90),
  ];
  const series = buildCategorySeries("cat1", "2026-08", txns);
  assert.equal(series.length, 3, "should show only 3 periods, not 6 zero-padded ones");
  assert.deepEqual(series.map(r => r.key), ["2026-06", "2026-07", "2026-08"]);
});

test("category window: no fabricated zero-history periods before earliest real data", () => {
  const txns = [txn("2026-07-01", "other_cat", 500)];
  const series = buildCategorySeries("cat1", "2026-08", txns);
  assert.equal(series.length, 2);
  assert.equal(series[0].attributedTotal, 0); // legitimate zero, not fabricated
});

test("category window: zero transactions anywhere → only the anchor period shown", () => {
  const series = buildCategorySeries("cat1", "2026-08", []);
  assert.equal(series.length, 1);
  assert.equal(series[0].key, "2026-08");
});

test("category window: selected period always remains the end/anchor period", () => {
  const txns = [
    txn("2026-01-05", "cat1", 10), txn("2026-02-05", "cat1", 10),
    txn("2026-03-05", "cat1", 10), txn("2026-04-05", "cat1", 10),
    txn("2026-05-05", "cat1", 10), txn("2026-06-05", "cat1", 10),
    txn("2026-07-05", "cat1", 10), txn("2026-08-05", "cat1", 10),
  ];
  const series = buildCategorySeries("cat1", "2026-05", txns);
  assert.equal(series[series.length - 1].key, "2026-05", "anchor must be the viewed period, not the latest data");
  assert.equal(series.length, 5, "earliest household data is 2026-01, so window stops there: 01,02,03,04,05");
});

// ============================================================
// Subcategory breakdown
// ============================================================

const CATEGORY = {
  id: "cat_food",
  name: "Food",
  subs: [
    { id: "sub_groceries", name: "Groceries" },
    { id: "sub_dining", name: "Dining Out" },
  ],
};

function expTxn(overrides) {
  return { id: `t${Math.random()}`, type: "expense", date: "2026-08-10", catId: "cat_food", ...overrides };
}

test("subcategory: single-tag transaction attributes fully and unambiguously to that subcategory", () => {
  const txns = [expTxn({ id: "t1", amount: 500, subIds: ["sub_groceries"] })];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const groceries = b.subcategories.find(s => s.subId === "sub_groceries");
  assert.equal(groceries.attributedAmount, 500);
  assert.equal(groceries.singleTagCount, 1);
  assert.equal(groceries.multiTagCount, 0);
  assert.equal(b.multiTagAmount, 0);
});

test("subcategory: multi-tag transaction contributes NO amount to any subcategory row, held in multiTag bucket, counted (not amounted) on both", () => {
  const txns = [expTxn({ id: "t1", amount: 900, subIds: ["sub_groceries", "sub_dining"] })];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const groceries = b.subcategories.find(s => s.subId === "sub_groceries");
  const dining = b.subcategories.find(s => s.subId === "sub_dining");
  assert.equal(groceries.attributedAmount, 0, "no fabricated split — groceries gets zero, not half");
  assert.equal(dining.attributedAmount, 0, "no fabricated split — dining gets zero, not half");
  assert.equal(groceries.multiTagCount, 1);
  assert.equal(dining.multiTagCount, 1);
  assert.equal(b.multiTagAmount, 900);
  assert.equal(b.multiTagCount, 1);
});

test("subcategory: transaction tagged to the category but with zero subcategories goes to 'untagged', not dropped, not assigned to a sub", () => {
  const txns = [expTxn({ id: "t1", amount: 300, subIds: [] })];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  assert.equal(b.untaggedAmount, 300);
  assert.equal(b.untaggedCount, 1);
  b.subcategories.forEach(s => assert.equal(s.attributedAmount, 0));
});

test("subcategory: mode:owes portion excluded from attribution, same rule as category-level (CR-ACC-BUD-001)", () => {
  const txns = [expTxn({
    id: "t1", amount: 1000, subIds: ["sub_groceries"],
    people: { p1: { amount: 400, mode: "owes" } },
  })];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const groceries = b.subcategories.find(s => s.subId === "sub_groceries");
  assert.equal(groceries.attributedAmount, 600, "1000 - 400 owed-back = 600 is actually 'my' spend");
});

test("subcategory: refund reduces the attributed amount via net-of-refund, same as category-level", () => {
  const txns = [
    expTxn({ id: "t1", amount: 1000, subIds: ["sub_dining"] }),
    { id: "t2", type: "settlement_in", againstTxnId: "t1", amount: 300, date: "2026-08-15" },
  ];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const dining = b.subcategories.find(s => s.subId === "sub_dining");
  assert.equal(dining.attributedAmount, 700, "1000 - 300 refund = 700");
});

test("subcategory: group-collective amount excluded from personal attribution, same as category-level", () => {
  const txns = [expTxn({
    id: "t1", amount: 1000, subIds: ["sub_groceries"],
    trackingMode: "split", groupCollectiveAmount: 600,
  })];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const groceries = b.subcategories.find(s => s.subId === "sub_groceries");
  assert.equal(groceries.attributedAmount, 400, "1000 - 600 group-collective = 400 is my personal share");
});

test("subcategory: only transactions in the passed periodTxns are counted (caller controls the period filter, same contract as category attribution)", () => {
  const augTxn = expTxn({ id: "t1", date: "2026-08-10", amount: 500, subIds: ["sub_groceries"] });
  const julTxn = expTxn({ id: "t2", date: "2026-07-10", amount: 999, subIds: ["sub_groceries"] });
  const periodTxns = [augTxn];
  const allTxns = [augTxn, julTxn];
  const b = buildSubcategoryBreakdown(CATEGORY, periodTxns, allTxns);
  const groceries = b.subcategories.find(s => s.subId === "sub_groceries");
  assert.equal(groceries.attributedAmount, 500, "July transaction must not leak into the August breakdown");
});

test("subcategory: categoryTotal matches getCategoryAttributedTotal exactly (proves the per-txn replication is faithful, not a new calculation)", () => {
  const txns = [
    expTxn({ id: "t1", amount: 500, subIds: ["sub_groceries"] }),
    expTxn({ id: "t2", amount: 900, subIds: ["sub_groceries", "sub_dining"] }),
    expTxn({ id: "t3", amount: 300, subIds: [] }),
    expTxn({ id: "t4", amount: 1000, subIds: ["sub_dining"], people: { p1: { amount: 400, mode: "owes" } } }),
  ];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const canonical = getCategoryAttributedTotal(txns, "cat_food", { allTransactions: txns });
  assert.equal(b.categoryTotal, canonical, "must match the real canonical function exactly");

  const subSum = b.subcategories.reduce((s, r) => s + r.attributedAmount, 0);
  const accountingIdentity = subSum + b.untaggedAmount + b.multiTagAmount;
  assert.equal(accountingIdentity, b.categoryTotal, "sub totals + untagged + multiTag must equal category total exactly");
});

test("subcategory: sum of individual subcategory rows is LESS than category total whenever a multi-tag transaction exists — never falsely additive", () => {
  const txns = [
    expTxn({ id: "t1", amount: 500, subIds: ["sub_groceries"] }),
    expTxn({ id: "t2", amount: 900, subIds: ["sub_groceries", "sub_dining"] }),
  ];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const subSum = b.subcategories.reduce((s, r) => s + r.attributedAmount, 0);
  assert.equal(subSum, 500, "only the single-tag transaction's amount is in subcategory rows");
  assert.equal(b.categoryTotal, 1400);
  assert.ok(subSum < b.categoryTotal, "subcategory rows must NOT sum to the category total when a multi-tag transaction exists");
});

// ============================================================
// WP8 — new aggregations
// ============================================================

test("getCategorySpendBreakdown: ranks categories by attributed spend, omits zero-spend categories", () => {
  const cats = [{ id: "food", name: "Food" }, { id: "rent", name: "Rent" }, { id: "unused", name: "Unused" }];
  const txns = [
    { type: "expense", date: "2026-08-05", catId: "food", amount: 500, people: {} },
    { type: "expense", date: "2026-08-06", catId: "rent", amount: 2000, people: {} },
  ];
  const rows = getCategorySpendBreakdown(txns, cats, txns);
  assert.equal(rows.length, 2, "unused category with no spend is omitted, not shown as zero");
  assert.equal(rows[0].category.id, "rent");
  assert.equal(rows[0].amount, 2000);
});

test("getTopMerchants: delegates to getFrequentVendors, no independent calculation", () => {
  const txns = [
    { type: "expense", date: "2026-08-01", merchant: "Amazon", amount: 500 },
    { type: "expense", date: "2026-08-02", merchant: "Amazon", amount: 300 },
    { type: "expense", date: "2026-08-03", merchant: "Swiggy", amount: 200 },
  ];
  const rows = getTopMerchants(txns, 5);
  assert.equal(rows[0].merchant, "Amazon");
  assert.equal(rows[0].count, 2);
  assert.equal(rows[0].totalSpend, 800);
});

test("subcategory: an Education payment tagged to several subcategories is a multi-tag bucket, never credited wholly to one subcategory", () => {
  const EDU = { id: "education", name: "Education", subs: [{ id: "edu_school_fees", name: "School Fees" }, { id: "edu_registration", name: "Registration Fees" }, { id: "edu_uniform", name: "Uniform" }] };
  const txns = [{ id: "e1", type: "expense", date: "2026-08-10", catId: "education", catIds: ["education"], amount: 25000, subIds: ["edu_school_fees", "edu_registration", "edu_uniform"] }];
  const b = buildSubcategoryBreakdown(EDU, txns, txns);
  assert.equal(b.subcategories.find(s => s.subId === "edu_school_fees").attributedAmount, 0);
  assert.equal(b.multiTagAmount, 25000);
  assert.equal(b.multiTagCount, 1);
});
