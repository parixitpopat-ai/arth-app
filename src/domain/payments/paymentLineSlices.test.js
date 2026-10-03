import { test } from "node:test";
import assert from "node:assert/strict";
import { expandPaymentLines, getAccountAmounts } from "./paymentLineSlices.js";
import { getCardSummary } from "../cards/summaries.js";

const exp = (over = {}) => ({ id: 1, type: "expense", date: "2026-10-02", amount: 10000, accId: "cash1", ...over });
const split = exp({ paymentLines: [{ id: "a", method: "Cash", accId: "cash1", amount: 3000 }, { id: "b", method: "Card", accId: "cc1", amount: 7000 }] });

test("a multi-line expense becomes one slice per paying account, same transaction id/date", () => {
  const out = expandPaymentLines([split]);
  assert.deepEqual(out.map(t => [t.id, t.accId, t.amount, t.date]), [[1, "cash1", 3000, "2026-10-02"], [1, "cc1", 7000, "2026-10-02"]]);
  assert.equal(out.reduce((s, t) => s + t.amount, 0), 10000, "slices add back to the transaction total");
});

test("two lines on the same account are merged into one slice", () => {
  const t = exp({ paymentLines: [{ accId: "bank1", amount: 4000 }, { accId: "bank1", amount: 6000 }] });
  assert.deepEqual(getAccountAmounts(t), [{ accId: "bank1", amount: 10000 }]);
});

test("single-line, line-less, non-expense and non-adding-up transactions are returned untouched", () => {
  const single = exp({ paymentLines: [{ accId: "cash1", amount: 10000 }] });
  const none = exp();
  const income = { id: 2, type: "income", amount: 500, accId: "bank1", paymentLines: [{ accId: "a", amount: 200 }, { accId: "b", amount: 300 }] };
  const bad = exp({ paymentLines: [{ accId: "cash1", amount: 3000 }, { accId: "cc1", amount: 6000 }] });
  const missingAcc = exp({ paymentLines: [{ accId: "cash1", amount: 3000 }, { amount: 7000 }] });
  for (const t of [single, none, income, bad, missingAcc]) assert.equal(expandPaymentLines([t])[0], t);
  assert.equal(expandPaymentLines([bad]).length, 1);
});

test("the original transaction is not mutated and the input list is not rewritten", () => {
  const list = [split];
  expandPaymentLines(list);
  assert.equal(list[0], split);
  assert.equal(split.paymentLines.length, 2);
  assert.equal(split.amount, 10000);
});

test("a card's own figures only see its slice (the 7,000), not the whole payment", () => {
  const card = { id: "cc1", type: "cc", name: "HDFC", statementDay: 28, dueDay: 15, limit: 300000 };
  const toDateOnly = d => new Date(`${String(d).slice(0, 10)}T00:00:00`);
  const whole = getCardSummary(card, [card], [exp({ accId: "cc1" })], toDateOnly);
  const sliced = getCardSummary(card, [card], expandPaymentLines([split]), toDateOnly);
  assert.equal(sliced.totalOutstanding + sliced.currentCycleSpend, 7000, "only the card line is charged to the card");
  assert.equal(whole.totalOutstanding + whole.currentCycleSpend, 10000);
});
