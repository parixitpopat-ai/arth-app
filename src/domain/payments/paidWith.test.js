import { test } from "node:test";
import assert from "node:assert/strict";
import { sumPaymentLines, paidWithDifference, isPaidWithBalanced, blankPaymentLine, PAYMENT_METHODS } from "./paidWith.js";

test("sumPaymentLines adds every line's amount", () => {
  assert.equal(sumPaymentLines([{ amount: 35000 }, { amount: 6800 }]), 41800);
});

test("sumPaymentLines treats missing/blank amounts as 0", () => {
  assert.equal(sumPaymentLines([{ amount: "" }, { amount: 100 }]), 100);
});

test("paidWithDifference is positive when under-assigned, negative when over", () => {
  assert.equal(paidWithDifference([{ amount: 35000 }, { amount: 5000 }], 41800), 1800);
  assert.equal(paidWithDifference([{ amount: 35000 }, { amount: 10000 }], 41800), -3200);
});

test("isPaidWithBalanced is false until every line has method+account+amount and the sum matches exactly", () => {
  const total = 41800;
  assert.equal(isPaidWithBalanced([], total), false);
  assert.equal(isPaidWithBalanced([{ method: "UPI", accId: "a1", amount: 35000 }, { method: "Cash", accId: "a2", amount: 5000 }], total), false, "under by 1800");
  assert.equal(isPaidWithBalanced([{ method: "UPI", accId: "a1", amount: 35000 }, { method: "Cash", accId: "a2", amount: 6800 }], total), true);
});

test("isPaidWithBalanced rejects a line missing its account even if the sum happens to match", () => {
  assert.equal(isPaidWithBalanced([{ method: "UPI", accId: "", amount: 41800 }], 41800), false);
});

test("blankPaymentLine uses the injected id generator and defaults to the first method", () => {
  const line = blankPaymentLine(() => "fixed-id");
  assert.equal(line.id, "fixed-id");
  assert.equal(line.method, PAYMENT_METHODS[0]);
  assert.equal(line.accId, "");
});
