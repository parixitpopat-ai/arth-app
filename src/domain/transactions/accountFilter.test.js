import test from "node:test";
import assert from "node:assert/strict";
import { accountIdSet, txnTouchesAccount, cardStatementPeriods } from "./accountFilter.js";

const accounts = [{ id: "cc1", type: "cc" }, { id: "bank1", type: "bank" }, { id: "upi1", type: "upi", linkedAccount: "cc1" }, { id: "upi2", type: "upi", linkedAccount: "bank1" }];
const addDay = (iso, n) => { const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)); return d.toISOString().slice(0, 10); };

test("a card's set includes the UPI handle linked to it, not another account's", () => {
  assert.deepEqual([...accountIdSet("cc1", accounts)].sort(), ["cc1", "upi1"]);
});
test("purchases, rail spend, card payments (either end), refunds and transfers all count", () => {
  const t = (o) => ({ id: "x", ...o });
  assert.equal(txnTouchesAccount(t({ type: "expense", accId: "cc1" }), "cc1", accounts), true);
  assert.equal(txnTouchesAccount(t({ type: "expense", accId: "upi1" }), "cc1", accounts), true);
  assert.equal(txnTouchesAccount(t({ type: "cc_payment", fromAccId: "bank1", toAccId: "cc1" }), "cc1", accounts), true);
  assert.equal(txnTouchesAccount(t({ type: "cc_payment", fromAccId: "bank1", toAccId: "cc1" }), "bank1", accounts), true);
  assert.equal(txnTouchesAccount(t({ type: "settlement_in", isRefund: true, accId: "cc1" }), "cc1", accounts), true);
  assert.equal(txnTouchesAccount(t({ type: "transfer", fromAccId: "cc1", toAccId: "bank1" }), "cc1", accounts), true);
});
test("other accounts do not count, and a part-paid expense counts for the account of one of its slices", () => {
  assert.equal(txnTouchesAccount({ type: "expense", accId: "bank1" }, "cc1", accounts), false);
  assert.equal(txnTouchesAccount({ type: "expense", accId: "bank1" }, "upi2", accounts), false);
  assert.equal(txnTouchesAccount({ type: "expense", accId: "bank1", paymentLines: [{ accId: "bank1", amount: 3000 }, { accId: "cc1", amount: 7000 }] }, "cc1", accounts), true);
  assert.equal(txnTouchesAccount(null, "cc1", accounts), false);
  assert.equal(txnTouchesAccount({ type: "expense" }, "cc1", accounts), false);
});
test("ids compare as text (a number id matches its string)", () => {
  assert.equal(txnTouchesAccount({ type: "expense", accId: 7 }, "7", [{ id: 7, type: "cc" }]), true);
});
test("statement periods: this card only, newest first, first day inside is the day after periodFrom", () => {
  const bills = [
    { id: "s1", isCcStatement: true, accId: "cc1", periodFrom: "2026-09-16", periodTo: "2026-10-16" },
    { id: "s2", isCcStatement: true, accId: "cc1", periodFrom: "2026-10-16", periodTo: "2026-11-16" },
    { id: "o", isCcStatement: true, accId: "cc9", periodFrom: "2026-10-16", periodTo: "2026-11-16" },
    { id: "n", accId: "cc1", periodFrom: "2026-10-16", periodTo: "2026-11-16" },
  ];
  const p = cardStatementPeriods(bills, "cc1", addDay);
  assert.deepEqual(p.map(x => [x.id, x.from, x.to, x.label]), [["s2", "2026-10-17", "2026-11-16", "17 Oct – 16 Nov"], ["s1", "2026-09-17", "2026-10-16", "17 Sep – 16 Oct"]]);
  assert.deepEqual(cardStatementPeriods([], "cc1", addDay), []);
});
test("a statement with no usable dates is skipped, and the list is capped", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: "s" + i, isCcStatement: true, accId: "cc1", periodFrom: `2026-0${(i % 9) + 1}-01`, periodTo: `2026-0${(i % 9) + 1}-28` }));
  assert.equal(cardStatementPeriods([...many, { id: "bad", isCcStatement: true, accId: "cc1" }], "cc1", addDay).length, 6);
});
