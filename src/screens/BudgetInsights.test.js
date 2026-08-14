// src/screens/BudgetInsights.test.js
// Characterization + unit tests for the Category window fix (Decision 1)
// and the new Person View calculations (Decision 2). Tests the exported
// pure functions directly — no React/DOM harness needed, same discipline
// as domain/allocations/*.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCategorySeries, classifyPersonStatus, buildPersonRows, buildSubcategoryBreakdown } from "./BudgetInsights.helpers.js";
import { getCategoryAttributedTotal } from "../../domain/allocations/adapter.js";

// ============================================================
// Decision 1 — Category View trailing window
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
  // Household's earliest transaction is 2026-06 — only 3 real months exist by August
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
  const txns = [txn("2026-07-01", "other_cat", 500)]; // household has data, but not for THIS category
  const series = buildCategorySeries("cat1", "2026-08", txns);
  // earliest household data is 2026-07, so window = [2026-07, 2026-08], both real periods
  // (2026-07's row for cat1 is a legitimate zero — household existed, category had no spend —
  // NOT a fabricated pre-history zero)
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
  const series = buildCategorySeries("cat1", "2026-05", txns); // viewing a PAST period, not the latest
  assert.equal(series[series.length - 1].key, "2026-05", "anchor must be the viewed period, not the latest data");
  assert.equal(series.length, 5, "earliest household data is 2026-01, so window stops there: 01,02,03,04,05");
});

// ============================================================
// Decision 2 — Person View status classification
// ============================================================

test("person status: zero budget — distinct 'no budget set' state, not run through health thresholds", () => {
  const r = classifyPersonStatus(0, 500);
  assert.equal(r.hasBudget, false);
  assert.equal(r.status, "no_budget");
});

test("person status: zero spend, real budget — within budget", () => {
  const r = classifyPersonStatus(10000, 0);
  assert.equal(r.hasBudget, true);
  assert.equal(r.status, "onTrack");
  assert.equal(r.variance, 10000);
});

test("person status: partial spend, comfortably under — within budget", () => {
  const r = classifyPersonStatus(10000, 4000);
  assert.equal(r.status, "onTrack");
  assert.equal(r.variance, 6000);
});

test("person status: partial spend, close to threshold — approaching budget", () => {
  const r = classifyPersonStatus(10000, 9200); // 8% remaining, matches getBudgetHealthStatus's <10 rule
  assert.equal(r.status, "close");
});

test("person status: exactly at budget — treated as over (variance 0, isOver per getBudgetVariance's variance<0 rule is false, but margin is 0% which is <10 → close)", () => {
  const r = classifyPersonStatus(10000, 10000);
  assert.equal(r.variance, 0);
  assert.equal(r.isOver, false); // getBudgetVariance: isOver = variance < 0, and 0 is not < 0
  assert.equal(r.status, "close"); // 0% margin falls under the <10 "close" rule, not a separate "exactly at" state
});

test("person status: over budget — over budget", () => {
  const r = classifyPersonStatus(10000, 13000);
  assert.equal(r.isOver, true);
  assert.equal(r.status, "over");
});

test("buildPersonRows: uses canonical adapter functions only, filters to relevant people, sorts by spend desc", () => {
  const people = [
    { id: "p1", name: "Alice", spendBudget: 10000, spendBudgetOverrides: {} },
    { id: "p2", name: "Bob", spendBudget: 5000, spendBudgetOverrides: {} },
    { id: "p3", name: "Carol", spendBudget: 0, spendBudgetOverrides: {} }, // no budget, no spend — should be excluded
  ];
  const periodTxns = [
    { type: "expense", date: "2026-08-05", people: { p1: { amount: 3000, mode: "spent_on" } } },
    { type: "expense", date: "2026-08-06", people: { p2: { amount: 6000, mode: "spent_on" } } },
  ];
  const rows = buildPersonRows(people, periodTxns, "2026-08");
  assert.equal(rows.length, 2, "Carol excluded — zero budget AND zero spend");
  assert.equal(rows[0].person.id, "p2", "Bob spent more (₹6000), sorted first");
  assert.equal(rows[0].actual, 6000);
  assert.equal(rows[0].status, "over"); // 6000 > 5000
  assert.equal(rows[1].person.id, "p1");
  assert.equal(rows[1].actual, 3000);
  assert.equal(rows[1].status, "onTrack"); // 3000 of 10000, 70% margin
});

test("buildPersonRows: respects mode:spent_on vs mode:owes exclusion (CR-ACC-BUD-001)", () => {
  const people = [{ id: "p1", name: "Alice", spendBudget: 10000, spendBudgetOverrides: {} }];
  const periodTxns = [
    { type: "expense", date: "2026-08-05", people: { p1: { amount: 3000, mode: "spent_on" } } },
    { type: "expense", date: "2026-08-06", people: { p1: { amount: 9000, mode: "owes" } } }, // receivable, must be excluded
  ];
  const rows = buildPersonRows(people, periodTxns, "2026-08");
  assert.equal(rows[0].actual, 3000, "the mode:owes 9000 must NOT be counted — receivable, not spend");
});
// Appended to src/screens/BudgetInsights.test.js

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

// --- 1. Single-subcategory transaction ---
test("subcategory: single-tag transaction attributes fully and unambiguously to that subcategory", () => {
  const txns = [expTxn({ id: "t1", amount: 500, subIds: ["sub_groceries"] })];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const groceries = b.subcategories.find(s => s.subId === "sub_groceries");
  assert.equal(groceries.attributedAmount, 500);
  assert.equal(groceries.singleTagCount, 1);
  assert.equal(groceries.multiTagCount, 0);
  assert.equal(b.multiTagAmount, 0);
});

// --- 2. Multiple-subcategory transaction ---
test("subcategory: multi-tag transaction contributes NO amount to any subcategory row, held in multiTag bucket, counted (not amounted) on both", () => {
  const txns = [expTxn({ id: "t1", amount: 900, subIds: ["sub_groceries", "sub_dining"] })];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const groceries = b.subcategories.find(s => s.subId === "sub_groceries");
  const dining = b.subcategories.find(s => s.subId === "sub_dining");
  assert.equal(groceries.attributedAmount, 0, "no fabricated split — groceries gets zero, not half");
  assert.equal(dining.attributedAmount, 0, "no fabricated split — dining gets zero, not half");
  assert.equal(groceries.multiTagCount, 1, "still identifiable as referencing this subcategory");
  assert.equal(dining.multiTagCount, 1);
  assert.equal(b.multiTagAmount, 900, "the full amount lives in the multiTag bucket, not fabricated per-sub");
  assert.equal(b.multiTagCount, 1);
});

// --- 3. Transaction with no subcategory ---
test("subcategory: transaction tagged to the category but with zero subcategories goes to 'untagged', not dropped, not assigned to a sub", () => {
  const txns = [expTxn({ id: "t1", amount: 300, subIds: [] })];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  assert.equal(b.untaggedAmount, 300);
  assert.equal(b.untaggedCount, 1);
  b.subcategories.forEach(s => assert.equal(s.attributedAmount, 0));
});

// --- 4. mode:"owes" exclusion ---
test("subcategory: mode:owes portion excluded from attribution, same rule as category-level (CR-ACC-BUD-001)", () => {
  const txns = [expTxn({
    id: "t1", amount: 1000, subIds: ["sub_groceries"],
    people: { p1: { amount: 400, mode: "owes" } }, // receivable — excluded
  })];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const groceries = b.subcategories.find(s => s.subId === "sub_groceries");
  assert.equal(groceries.attributedAmount, 600, "1000 - 400 owed-back = 600 is actually 'my' spend");
});

// --- 5. Refunds ---
test("subcategory: refund reduces the attributed amount via net-of-refund, same as category-level", () => {
  const txns = [
    expTxn({ id: "t1", amount: 1000, subIds: ["sub_dining"] }),
    { id: "t2", type: "settlement_in", againstTxnId: "t1", amount: 300, date: "2026-08-15" },
  ];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const dining = b.subcategories.find(s => s.subId === "sub_dining");
  assert.equal(dining.attributedAmount, 700, "1000 - 300 refund = 700");
});

// --- 6. Group-collective / group-allocation behavior ---
test("subcategory: group-collective amount excluded from personal attribution, same as category-level", () => {
  const txns = [expTxn({
    id: "t1", amount: 1000, subIds: ["sub_groceries"],
    trackingMode: "split", groupCollectiveAmount: 600,
  })];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const groceries = b.subcategories.find(s => s.subId === "sub_groceries");
  assert.equal(groceries.attributedAmount, 400, "1000 - 600 group-collective = 400 is my personal share");
});

// --- 7. Period filtering ---
test("subcategory: only transactions in the passed periodTxns are counted (caller controls the period filter, same contract as category attribution)", () => {
  const augTxn = expTxn({ id: "t1", date: "2026-08-10", amount: 500, subIds: ["sub_groceries"] });
  const julTxn = expTxn({ id: "t2", date: "2026-07-10", amount: 999, subIds: ["sub_groceries"] });
  const periodTxns = [augTxn]; // caller already filtered to August
  const allTxns = [augTxn, julTxn]; // full history, for refund lookups only
  const b = buildSubcategoryBreakdown(CATEGORY, periodTxns, allTxns);
  const groceries = b.subcategories.find(s => s.subId === "sub_groceries");
  assert.equal(groceries.attributedAmount, 500, "July transaction must not leak into the August breakdown");
});

// --- 8. Reconciliation against the parent Category total ---
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
  assert.equal(accountingIdentity, b.categoryTotal, "sub totals + untagged + multiTag must equal category total exactly — no money lost, none invented");
});

// --- Explicit non-additive proof (the specific thing this decision guards against) ---
test("subcategory: sum of individual subcategory rows is LESS than category total whenever a multi-tag transaction exists — never falsely additive", () => {
  const txns = [
    expTxn({ id: "t1", amount: 500, subIds: ["sub_groceries"] }),
    expTxn({ id: "t2", amount: 900, subIds: ["sub_groceries", "sub_dining"] }), // multi-tag
  ];
  const b = buildSubcategoryBreakdown(CATEGORY, txns, txns);
  const subSum = b.subcategories.reduce((s, r) => s + r.attributedAmount, 0);
  assert.equal(subSum, 500, "only the single-tag transaction's amount is in subcategory rows");
  assert.equal(b.categoryTotal, 1400);
  assert.ok(subSum < b.categoryTotal, "subcategory rows must NOT sum to the category total when a multi-tag transaction exists");
});
