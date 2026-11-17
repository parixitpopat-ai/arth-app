import test from "node:test";
import assert from "node:assert/strict";
import { refundTargets } from "./refundTarget.js";

const row = (date, amountPaise, desc = "AMAZON INDIA CYBS SI MUMBAI IN") => ({ date, amountPaise, desc });
const ex = (id, date, amount, merchant, accId = "cc1", extra = {}) => ({ id, type: "expense", date, amount, merchant, desc: merchant, accId, ...extra });
const find = (r, txns) => refundTargets({ row: r, transactions: txns, accountIds: ["cc1"] });

test("the user's case: a credit of 1,752.75 on 12-11 and an Amazon purchase of 1,752.75 on 12-11 -> that purchase", () => {
  const c = find(row("2026-11-12", 175275), [ex("a", "2026-11-12", 1752.75, "Amazon")]);
  assert.equal(c.length, 1); assert.equal(c[0].txn.id, "a"); assert.equal(c[0].exact, true); assert.equal(c[0].sameShop, true);
});
test("only purchases on THIS card (and its linked handle); a purchase on another account is ignored", () => {
  assert.equal(find(row("2026-11-12", 175275), [ex("a", "2026-11-12", 1752.75, "Amazon", "bank1")]).length, 0);
  assert.equal(refundTargets({ row: row("2026-11-12", 175275), transactions: [ex("a", "2026-11-12", 1752.75, "Amazon", "upi1")], accountIds: ["cc1", "upi1"] }).length, 1);
});
test("the purchase must be before the refund (a few days' slack) and within about six months", () => {
  assert.equal(find(row("2026-11-12", 175275), [ex("a", "2026-11-14", 1752.75, "Amazon")]).length, 1);   // 2 days after: slack
  assert.equal(find(row("2026-11-12", 175275), [ex("a", "2026-11-20", 1752.75, "Amazon")]).length, 0);
  assert.equal(find(row("2026-11-12", 175275), [ex("a", "2026-04-01", 1752.75, "Amazon")]).length, 0);
});
test("same amount but another shop is still proposed (exact amount), a part-refund only for the same shop", () => {
  assert.equal(find(row("2026-11-12", 175275, "CREDIT VOUCHER"), [ex("a", "2026-11-01", 1752.75, "Some Store")]).length, 1);
  assert.equal(find(row("2026-11-12", 50000, "AMAZON INDIA"), [ex("a", "2026-11-01", 1752.75, "Amazon")])[0].exact, false);
  assert.equal(find(row("2026-11-12", 50000, "CREDIT VOUCHER"), [ex("a", "2026-11-01", 1752.75, "Some Store")]).length, 0);
});
test("a purchase already fully refunded is not proposed again; one part-refunded only has what is left", () => {
  const p = ex("a", "2026-11-01", 1000, "Amazon");
  const done = { id: "r", type: "settlement_in", isRefund: true, againstTxnId: "a", amount: 1000, accId: "cc1", date: "2026-11-05" };
  assert.equal(find(row("2026-11-12", 100000), [p, done]).length, 0);
  const part = { ...done, amount: 400 };
  assert.equal(find(row("2026-11-12", 60000, "AMAZON"), [p, part])[0].remainingPaise, 60000);
  assert.equal(find(row("2026-11-12", 70000, "AMAZON"), [p, part]).length, 0);
});
test("best first: exact + same shop, then exact, then closer date; at most 3", () => {
  const c = find(row("2026-11-12", 175275), [ex("far", "2026-09-01", 1752.75, "Amazon"), ex("near", "2026-11-10", 1752.75, "Amazon"), ex("other", "2026-11-11", 1752.75, "Elsewhere"), ex("x", "2026-11-09", 1752.75, "Amazon")]);
  assert.deepEqual(c.map(x => x.txn.id), ["near", "x", "far"]);
});
test("a charge row (not a credit) gets nothing, and the inputs are not changed", () => {
  const txns = [ex("a", "2026-11-12", 1752.75, "Amazon")]; const copy = JSON.stringify(txns);
  assert.deepEqual(find(row("2026-11-12", -175275), txns), []);
  find(row("2026-11-12", 175275), txns); assert.equal(JSON.stringify(txns), copy);
});
