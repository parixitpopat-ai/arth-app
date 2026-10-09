import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAccountBalance, isLinkedPaymentMethod, getLinkedMethodIds, getParentAccountId } from "./accountBalance.js";

const inRange = (d, start, end) => (!start || d >= start) && (!end || d <= end);
const bank = { id: "b1", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01" };
const upiOnBank = { id: "u1", type: "upi", linkedAccount: "b1" };
const debit = { id: "d1", type: "debit", linkedBank: "b1" };
const card = { id: "cc1", type: "cc", limit: 100000 };
const upiOnCard = { id: "u2", type: "upi", linkedAccount: "cc1" };
const wallet = { id: "w1", type: "upi", openingBalance: 0 };
const cash = { id: "c1", type: "cash", openingBalance: 2000, openingBalanceDate: "2026-01-01" };
const accounts = [bank, upiOnBank, debit, card, upiOnCard, wallet, cash];
const bal = (accId, txns, accs = accounts) => computeAccountBalance({ accId, accounts: accs, txns, isDateInRange: inRange });
const total = (txns, accs = accounts) => accs.reduce((s, a) => s + bal(a.id, txns, accs), 0);
const exp = (id, amount, accId, extra = {}) => ({ id, type: "expense", amount, date: "2026-10-02", accId, ...extra });

test("UPI funded by the bank: the bank is debited once and the UPI shows no balance of its own", () => {
  const t = [exp(1, 500, "u1")];
  assert.equal(bal("b1", t), 9500);
  assert.equal(bal("u1", t), 0);
  assert.equal(total(t), 9500 + 2000); // bank + cash; nothing double-counted
});

test("debit card linked to the bank behaves the same", () => {
  const t = [exp(1, 300, "d1")];
  assert.equal(bal("b1", t), 9700);
  assert.equal(bal("d1", t), 0);
});

test("UPI linked to a credit card: no cash moves until the card bill is paid", () => {
  const t = [exp(1, 300, "u2")];
  assert.equal(total(t), 12000);
  assert.equal(bal("cc1", t), 0);
});

test("paying the card bill debits the paying bank once", () => {
  const t = [exp(1, 300, "u2"), { id: 2, type: "cc_payment", amount: 300, date: "2026-10-20", fromAccId: "b1", toAccId: "cc1" }];
  assert.equal(bal("b1", t), 9700);
  assert.equal(total(t), 9700 + 2000);
});

test("a UPI not linked to anything is a standalone wallet and keeps its own balance", () => {
  const t = [{ id: 1, type: "income", amount: 800, date: "2026-10-01", accId: "w1" }, exp(2, 100, "w1")];
  assert.equal(bal("w1", t), 700);
  assert.equal(total(t), 10000 + 2000 + 700);
});

test("a UPI whose parent account was deleted becomes a standalone wallet (no hidden money)", () => {
  const orphan = { id: "u3", type: "upi", linkedAccount: "gone" };
  assert.equal(isLinkedPaymentMethod(orphan, [orphan]), false);
  assert.equal(getParentAccountId(orphan, [orphan]), null);
  assert.equal(bal("u3", [exp(1, 50, "u3")], [orphan]), -50);
});

test("linked methods are found from the parent", () => {
  assert.deepEqual(getLinkedMethodIds("b1", accounts).sort(), ["d1", "u1"]);
  assert.deepEqual(getLinkedMethodIds("cc1", accounts), ["u2"]);
});

test("transfer, investment, loan given and income/settlement all move cash once", () => {
  const t = [
    { id: 1, type: "transfer", amount: 1000, date: "2026-10-02", fromAccId: "b1", toAccId: "c1" },
    { id: 2, type: "investment", amount: 700, date: "2026-10-02", accId: "u1" },
    { id: 3, type: "transfer", amount: 5000, date: "2026-10-02", fromAccId: "b1", toAccId: null, isLoanDisbursal: true },
    { id: 4, type: "income", amount: 3000, date: "2026-10-02", accId: "b1" },
    { id: 5, type: "settlement_in", amount: 400, date: "2026-10-02", accId: "c1" },
  ];
  assert.equal(bal("b1", t), 10000 - 1000 - 700 - 5000 + 3000);
  assert.equal(bal("c1", t), 2000 + 1000 + 400);
});

test("a multi-method payment hits each paying account for its own line", () => {
  const t = [exp(1, 1000, "u1", { paymentLines: [{ accId: "u1", amount: 600, method: "upi" }, { accId: "c1", amount: 400, method: "cash" }] })];
  assert.equal(bal("b1", t), 9400);
  assert.equal(bal("c1", t), 1600);
});

test("end date limits the balance (balance-checkpoint use)", () => {
  const t = [exp(1, 500, "u1", { date: "2026-10-02" }), exp(2, 200, "u1", { date: "2026-10-10" })];
  assert.equal(computeAccountBalance({ accId: "b1", accounts, txns: t, endDate: "2026-10-05", isDateInRange: inRange }), 9500);
});

test("credit-card accounts have no cash balance", () => {
  assert.equal(bal("cc1", [exp(1, 999, "cc1")]), 0);
});
