import { test } from "node:test";
import assert from "node:assert/strict";
import { getAvailableCash, getEffectiveBalance, isValidCheckpoint } from "./availableCash.js";

const inRange = (d, s, e) => (!s || d >= s) && (!e || d <= e);
const bank = { id: "b1", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01" };
const upi = { id: "u1", type: "upi", linkedAccount: "b1" };
const cash = { id: "c1", type: "cash", openingBalance: 500, openingBalanceDate: "2026-01-01" };
const card = { id: "cc1", type: "cc", limit: 100000 };
const accounts = [bank, upi, cash, card];
const exp = (id, amount, date, accId, extra = {}) => ({ id, type: "expense", amount, date, accId, ...extra });
const avail = (txns, checkpoints = {}, accs = accounts) => getAvailableCash({ accounts: accs, txns, checkpoints, isDateInRange: inRange });

test("no checkpoint: the computed balances", () => {
  assert.equal(avail([exp(1, 500, "2026-10-02", "u1")]), 9500 + 500);
});

test("checkpoint replaces what was computed up to its date, then later movements count once", () => {
  const txns = [exp(1, 1000, "2026-09-20", "b1"), exp(2, 300, "2026-10-05", "u1")];
  const cp = { b1: { date: "2026-10-01", amount: 12000 } }; // bank said 12,000 on 1 Oct (computed was 9,000)
  assert.equal(getEffectiveBalance({ accId: "b1", accounts, txns, checkpoints: cp, isDateInRange: inRange }), 12000 - 300);
  assert.equal(avail(txns, cp), 12000 - 300 + 500);
});

test("movements before the checkpoint are not counted again", () => {
  const txns = [exp(1, 1000, "2026-09-20", "b1")];
  assert.equal(avail(txns, { b1: { date: "2026-10-01", amount: 7000 } }), 7000 + 500);
});

test("an invalid checkpoint is ignored", () => {
  assert.equal(isValidCheckpoint({ date: "", amount: 5 }), false);
  assert.equal(isValidCheckpoint({ date: "2026-10-01", amount: "abc" }), false);
  assert.equal(isValidCheckpoint({ date: "2026-10-01", amount: 0 }), true);
  assert.equal(avail([], { b1: { date: "", amount: 99999 } }), 10000 + 500);
});

test("a card purchase moves no cash; paying the card bill debits the bank once", () => {
  const purchase = exp(1, 3000, "2026-10-02", "cc1");
  assert.equal(avail([purchase]), 10500);
  const pay = { id: 2, type: "cc_payment", amount: 3000, date: "2026-10-20", fromAccId: "b1", toAccId: "cc1" };
  assert.equal(avail([purchase, pay]), 10500 - 3000);
});

test("investments and loans given are cash outflows; income received counts, expected income does not", () => {
  const txns = [
    { id: 1, type: "investment", amount: 700, date: "2026-10-02", accId: "b1" },
    { id: 2, type: "transfer", amount: 5000, date: "2026-10-03", fromAccId: "b1", toAccId: null, isLoanDisbursal: true },
    { id: 3, type: "income", amount: 80000, date: "2026-10-04", accId: "b1" },
  ];
  assert.equal(avail(txns), 10000 - 700 - 5000 + 80000 + 500);
});

test("investment accounts are excluded when the caller says so", () => {
  const inv = { id: "i1", type: "bank", openingBalance: 99999, openingBalanceDate: "2026-01-01", isInvestment: true };
  const r = getAvailableCash({ accounts: [bank, inv], txns: [], checkpoints: {}, isDateInRange: inRange, isInvestmentAccount: a => Boolean(a.isInvestment) });
  assert.equal(r, 10000);
});
