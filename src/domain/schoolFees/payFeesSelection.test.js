import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultLineAmount,
  validatePayFeesLineAmount,
  sumPayFeesTotal,
  toSettlementAllocations,
  validateExtraLine,
  buildPayFeesLineItems,
} from "./payFeesSelection.js";

const period = (over = {}) => ({
  id: "p1", obligationAmount: 12000, paidAmount: 6000, discountAmount: 0, writeOffAmount: 0,
  appliedCreditAmount: 0, startingStateDeclared: true, ...over,
});

test("defaultLineAmount is the full remaining balance", () => {
  assert.equal(defaultLineAmount(period()), 6000);
});

test("defaultLineAmount is 0 for an undeclared period", () => {
  assert.equal(defaultLineAmount(period({ startingStateDeclared: false })), 0);
});

test("validatePayFeesLineAmount accepts ₹1 up to the remaining balance", () => {
  assert.equal(validatePayFeesLineAmount(period(), 1), null);
  assert.equal(validatePayFeesLineAmount(period(), 6000), null);
});

test("validatePayFeesLineAmount rejects 0, negative, and over-the-remaining amounts", () => {
  assert.ok(validatePayFeesLineAmount(period(), 0));
  assert.ok(validatePayFeesLineAmount(period(), -5));
  assert.ok(validatePayFeesLineAmount(period(), 6001));
});

test("sumPayFeesTotal adds ticked lines and extra 'not listed' lines together", () => {
  const total = sumPayFeesTotal([{ amount: 18000 }, { amount: 6000 }], [{ amount: 1200 }]);
  assert.equal(total, 25200);
});

test("toSettlementAllocations drops zero/omitted lines, keeping only periodId+amount", () => {
  const out = toSettlementAllocations([{ periodId: "a", amount: 18000 }, { periodId: "b", amount: 0 }]);
  assert.deepEqual(out, [{ periodId: "a", amount: 18000 }]);
});

test("validateExtraLine requires a name, a positive amount, and (WP18c-fix) a real category", () => {
  assert.ok(validateExtraLine("", 1200, "cat-misc"));
  assert.ok(validateExtraLine("Books", 0, "cat-misc"));
  assert.ok(validateExtraLine("Books", 1200, null), "no longer valid without a real category");
  assert.ok(validateExtraLine("Books", 1200, ""));
  assert.equal(validateExtraLine("Books", 1200, "cat-misc"), null);
});

// WP18c-fix (Pay Fees mixed category) — buildPayFeesLineItems
test("buildPayFeesLineItems: fee lines are uncategorized and carry a feePeriodId; the extra line carries its own real category and no feePeriodId", () => {
  const items = buildPayFeesLineItems(
    [
      { periodId: "term1-tuition", label: "Tuition", amount: 18000 },
      { periodId: "term1-registration", label: "Registration", amount: 2000 },
    ],
    [{ id: "extra-1", name: "Books", amount: 1200, catId: "cat-books", subId: "sub-stationery" }]
  );
  assert.equal(items.length, 3);
  const tuition = items.find(i => i.feePeriodId === "term1-tuition");
  const registration = items.find(i => i.feePeriodId === "term1-registration");
  const books = items.find(i => i.label === "Books");
  assert.ok(tuition && registration && books);
  assert.equal(tuition.unitPrice, 18000);
  assert.equal(tuition.catId, null);
  assert.equal(registration.unitPrice, 2000);
  assert.equal(registration.catId, null);
  assert.equal(books.unitPrice, 1200);
  assert.equal(books.catId, "cat-books");
  assert.equal(books.subId, "sub-stationery");
  assert.equal(books.feePeriodId, undefined);
});

test("buildPayFeesLineItems: total across lineItems equals the sum of every input line", () => {
  const items = buildPayFeesLineItems(
    [{ periodId: "p1", label: "Tuition", amount: 18000 }, { periodId: "p2", label: "Registration", amount: 2000 }],
    [{ id: "e1", name: "Books", amount: 1200, catId: "cat-books" }]
  );
  const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  assert.equal(total, 21200);
});

test("buildPayFeesLineItems: no ticked lines and no extra lines yields an empty array", () => {
  assert.deepEqual(buildPayFeesLineItems([], []), []);
  assert.deepEqual(buildPayFeesLineItems(undefined, undefined), []);
});
