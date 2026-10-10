import { test } from "node:test";
import assert from "node:assert/strict";
import { computePeriodAmount, generateDueStatements, isEmptyStatementBill, getPendingStatementChecks } from "./statementBills.js";

const toDateOnly = value => {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

const card = { id: "cc1", name: "HDFC Regalia", statementDate: 15, dueDate: 5 };
const accounts = [card];

test("computePeriodAmount nets charges minus in-period refunds, boundary-inclusive on `to`", () => {
  const txns = [
    { type: "expense", accId: "cc1", date: "2026-08-16", amount: 1000 },
    { type: "expense", accId: "cc1", date: "2026-09-15", amount: 2000 },
    { type: "expense", accId: "cc1", date: "2026-08-15", amount: 500 }, // excluded: on `from`
    { type: "expense", accId: "cc1", date: "2026-09-16", amount: 999 }, // excluded: after `to`
    { type: "settlement_in", accId: "cc1", isRefund: true, date: "2026-09-01", amount: 300 },
  ];
  const amt = computePeriodAmount(card, accounts, txns, toDateOnly("2026-08-15"), toDateOnly("2026-09-15"), toDateOnly);
  assert.equal(amt, 1000 + 2000 - 300);
});

test("generateDueStatements: first-ever generation produces exactly the most recently closed cycle", () => {
  const txns = [{ type: "expense", accId: "cc1", date: "2026-08-20", amount: 5000 }];
  const refDate = new Date(2026, 8, 20); // 20 Sep 2026 -> last closed cycle is 16 Aug - 15 Sep
  const out = generateDueStatements({ card, accounts, txns, bills: [], toDateOnly, refDate });
  assert.equal(out.length, 1);
  assert.equal(out[0].periodFrom, "2026-08-15");
  assert.equal(out[0].periodTo, "2026-09-15");
  assert.equal(out[0].arthAmount, 5000);
  assert.equal(out[0].verification, "needs_verification");
  assert.equal(out[0].status, "unpaid");
  assert.equal(out[0].dueDate, "2026-10-05");
});

test("generateDueStatements is idempotent once the cycle is already generated", () => {
  const refDate = new Date(2026, 8, 20);
  const first = generateDueStatements({ card, accounts, txns: [], bills: [], toDateOnly, refDate });
  const second = generateDueStatements({ card, accounts, txns: [], bills: first, toDateOnly, refDate });
  assert.equal(second.length, 0);
});

test("generateDueStatements never generates the still-open current cycle", () => {
  const refDate = new Date(2026, 8, 20); // mid-cycle, next close is 15 Oct
  const bills = generateDueStatements({ card, accounts, txns: [], bills: [], toDateOnly, refDate });
  assert.ok(bills.every(b => b.periodTo <= "2026-09-15"));
  assert.ok(bills.every(b => b.periodTo !== "2026-10-15"));
});

test("generateDueStatements walks forward through multiple closed cycles if several elapsed unseen", () => {
  const refDate = new Date(2026, 10, 20); // 20 Nov 2026 -> two cycles closed since 15 Sep: 15 Oct, 15 Nov
  const priorBill = { isCcStatement: true, accId: "cc1", periodFrom: "2026-08-15", periodTo: "2026-09-15" };
  const txns = [{ id: 1, type: "expense", amount: 500, date: "2026-10-01", accId: "cc1" }, { id: 2, type: "expense", amount: 700, date: "2026-11-01", accId: "cc1" }];
  const out = generateDueStatements({ card, accounts, txns, bills: [priorBill], toDateOnly, refDate });
  assert.equal(out.length, 2);
  assert.equal(out[0].periodFrom, "2026-09-15");
  assert.equal(out[0].periodTo, "2026-10-15");
  assert.equal(out[1].periodFrom, "2026-10-15");
  assert.equal(out[1].periodTo, "2026-11-15");
});

// ---- no transactions, no bill ----
const spend = (id, amount, date) => ({ id, type: "expense", amount, date, accId: "cc1" });

test("no transactions in the cycle: no bill is generated, so nothing can go overdue", () => {
  const refDate = new Date(2026, 9, 10); // 10 Oct: the 15 Aug-15 Sep cycle closed with nothing on the card
  assert.deepEqual(generateDueStatements({ card, accounts, txns: [], bills: [], toDateOnly, refDate }), []);
});

test("only the cycles that have charges get a bill; an empty one in between is skipped", () => {
  const refDate = new Date(2026, 10, 20);
  const priorBill = { isCcStatement: true, accId: "cc1", periodFrom: "2026-08-15", periodTo: "2026-09-15" };
  const out = generateDueStatements({ card, accounts, txns: [spend(1, 900, "2026-11-02")], bills: [priorBill], toDateOnly, refDate });
  assert.deepEqual(out.map(b => b.periodTo), ["2026-11-15"]);
  assert.equal(out[0].amount, 900);
});

test("an entry added later into an empty closed cycle produces that cycle's bill on the next run", () => {
  const refDate = new Date(2026, 9, 10);
  assert.equal(generateDueStatements({ card, accounts, txns: [], bills: [], toDateOnly, refDate }).length, 0);
  const out = generateDueStatements({ card, accounts, txns: [spend(1, 1200, "2026-09-01")], bills: [], toDateOnly, refDate });
  assert.equal(out.length, 1);
  assert.equal(out[0].periodTo, "2026-09-15");
  assert.equal(out[0].amount, 1200);
});

test("isEmptyStatementBill: only an unpaid, zero, unverified statement; a bank amount makes it real", () => {
  const base = { isCcStatement: true, status: "unpaid", arthAmount: 0, amount: 0, bankAmount: null, adjustments: [] };
  assert.equal(isEmptyStatementBill(base), true);
  assert.equal(isEmptyStatementBill({ ...base, bankAmount: 0, verification: "matched" }), true);
  assert.equal(isEmptyStatementBill({ ...base, bankAmount: 1500, verification: "mismatch" }), false);
  assert.equal(isEmptyStatementBill({ ...base, amount: 800, arthAmount: 800 }), false);
  assert.equal(isEmptyStatementBill({ ...base, status: "paid" }), false);
  assert.equal(isEmptyStatementBill({ ...base, isCcStatement: false }), false);
});

test("getPendingStatementChecks: asks once the statement day has passed with nothing on the card, until answered", () => {
  const ccAccounts = [{ ...card, type: "cc" }];
  const args = { accounts: ccAccounts, txns: [], bills: [], toDateOnly, today: "2026-10-10" };
  const p = getPendingStatementChecks(args);
  assert.equal(p.length, 1);
  assert.deepEqual([p[0].cardId, p[0].from, p[0].to], ["cc1", "2026-08-15", "2026-09-15"]);
  const answered = [{ ...card, type: "cc", statementChecks: { "2026-09-15": "none" } }];
  assert.equal(getPendingStatementChecks({ ...args, accounts: answered }).length, 0);
  const snoozed = [{ ...card, type: "cc", statementChecks: { "2026-09-15": "snooze:2026-10-10" } }];
  assert.equal(getPendingStatementChecks({ ...args, accounts: snoozed }).length, 0);
  assert.equal(getPendingStatementChecks({ ...args, accounts: snoozed, today: "2026-10-11" }).length, 1);
});

test("getPendingStatementChecks: not asked when the cycle has charges (it gets a bill) or already has one", () => {
  const args = { accounts: [{ ...card, type: "cc" }], txns: [spend(1, 300, "2026-09-01")], bills: [], toDateOnly, today: "2026-10-10" };
  assert.equal(getPendingStatementChecks(args).length, 0);
  const bill = { isCcStatement: true, accId: "cc1", periodTo: "2026-09-15" };
  assert.equal(getPendingStatementChecks({ ...args, txns: [], bills: [bill] }).length, 0);
});

test("getPendingStatementChecks: not asked about a cycle that closed before the card was added", () => {
  const late = [{ ...card, type: "cc", openingBalanceDate: "2026-10-01" }];
  assert.equal(getPendingStatementChecks({ accounts: late, txns: [], bills: [], toDateOnly, today: "2026-10-10" }).length, 0);
});
