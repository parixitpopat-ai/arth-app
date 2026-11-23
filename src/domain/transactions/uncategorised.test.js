import test from "node:test";
import assert from "node:assert/strict";
import { uncategorisedExpenseIds } from "./uncategorised.js";

test("expenses with no category are found; categorised, itemised-with-category, income, refunds and strange input are not", () => {
  const txns = [
    { id: 1, type: "expense" }, { id: 2, type: "expense", catId: "food" }, { id: 3, type: "expense", catIds: ["a"] }, { id: 4, type: "income" },
    { id: 5, type: "expense", catIds: [] }, { id: 6, type: "expense", catId: null, items: [{ catId: "x" }] }, { id: 7, type: "expense", isRefund: true },
    { id: 8, type: "expense", items: [{ name: "a" }] }, null, { type: "expense" },
  ];
  assert.deepEqual(uncategorisedExpenseIds(txns), [1, 5, 8]);
  assert.deepEqual(uncategorisedExpenseIds(undefined), []);
});
