// FIN-TRUTH-001 close-out: one card-EMI scenario reconciled across cash, card, obligations and Money Required.
// Fact set: a phone bought on a 6-month EMI plan (installment 2,000) on card cc1 (statement day 15, due day 5),
// a 1,500 expense and a 700 investment charged to the card after the last statement, and a bank with 50,000.
// Today = 20 Oct 2026, so the last statement is 15 Oct (bills 16 Sep-15 Oct, due 5 Nov).
import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getCardSummary } from "./summaries.js";
import { getCardUsage } from "./usage.js";
import { getCommitments } from "../bills/commitments.js";
import { composeFutureMoneyCommitments } from "../futureMoney/compose.js";
import { projectLoansToDebtServiceEvents } from "../debt/futureMoney.js";
import { getMoneyRequiredForPeriod } from "../futureMoney/moneyRequired.js";
import { computeAccountBalance } from "../accounts/accountBalance.js";
import { expandPaymentLines } from "../payments/paymentLineSlices.js";

const setToday = (y, m, d) => { mock.timers.reset(); mock.timers.enable({ apis: ["Date"], now: new Date(y, m - 1, d, 12) }); };
beforeEach(() => setToday(2026, 10, 20));
afterEach(() => mock.timers.reset());

const toDateOnly = v => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
const inRange = (d, s, e) => (!s || d >= s) && (!e || d <= e);
const bank = { id: "b1", type: "bank", name: "Bank", openingBalance: 50000, openingBalanceDate: "2026-01-01" };
const card = { id: "cc1", type: "cc", name: "HDFC", limit: 100000, statementDate: 15, dueDate: 5 };
const accounts = [bank, card];
const loan = { id: "L1", direction: "taken", name: "Phone EMI", ccEmiPlanId: "P1", linkedCardId: "cc1", emiAmount: 2000, outstanding: 10000, status: "active" };
const emi = (id, date) => ({ id, type: "cc_emi", ccEmiPlanId: "P1", amount: 2000, date, accId: "cc1" });
const spend = { id: "e1", type: "expense", amount: 1500, date: "2026-10-18", accId: "cc1" };
const invest = { id: "i1", type: "investment", amount: 700, date: "2026-10-19", accId: "cc1" };
const pay = { id: "p1", type: "cc_payment", amount: 2000, date: "2026-10-25", fromAccId: "b1", toAccId: "cc1" };

const measures = txns => {
  const ex = expandPaymentLines(txns);
  const summary = getCardSummary(card, accounts, ex, toDateOnly);
  const today = new Date();
  const commitments = getCommitments([], [], accounts, ex, [], toDateOnly, getCardSummary, {}, today, null);
  const debt = projectLoansToDebtServiceEvents([loan], accounts, ex, toDateOnly, today);
  const futureMoney = composeFutureMoneyCommitments(commitments, [debt]);
  const cash = accounts.reduce((s, a) => s + computeAccountBalance({ accId: a.id, accounts, txns, isDateInRange: inRange }), 0);
  return { summary, futureMoney, debt, cash, usage: getCardUsage({ limit: card.limit, billedOutstanding: summary.totalOutstanding, unbilled: summary.currentCycleSpend }) };
};

test("installment 1 is on the issued statement; later charges are unbilled; cash has not moved", () => {
  const m = measures([emi("m1", "2026-09-20"), spend, invest]);
  assert.equal(m.summary.totalOutstanding, 2000); // billed: the EMI installment only
  assert.equal(m.summary.currentCycleSpend, 2200); // unbilled: expense + investment
  assert.equal(m.usage.used, 4200); // billed + unbilled, once each
  assert.equal(m.cash, 50000); // nothing leaves the bank until the card bill is paid
});

test("Money Required counts the statement once and the NEXT installment once - never installment 1 twice", () => {
  const m = measures([emi("m1", "2026-09-20"), spend, invest]);
  assert.equal(m.futureMoney.committedSpending.length, 1);
  assert.equal(m.futureMoney.committedSpending[0].amount, 2000); // statement (billed only; unbilled is not yet required)
  assert.equal(m.debt.length, 1);
  assert.equal(m.debt[0].date, "2026-12-05"); // installment already on the issued statement -> following cycle
  assert.equal(getMoneyRequiredForPeriod({ futureMoney: m.futureMoney }).total, 4000); // all open commitments (Outlook)
  assert.equal(getMoneyRequiredForPeriod({ futureMoney: m.futureMoney, today: "2026-10-20", horizonDays: 30 }).total, 2000); // Home: statement only, EMI is 46 days away
});

test("paying the statement debits the bank once and clears billed; the next EMI stays a commitment", () => {
  setToday(2026, 10, 26);
  const m = measures([emi("m1", "2026-09-20"), spend, invest, pay]);
  assert.equal(m.summary.totalOutstanding, 0);
  assert.equal(m.summary.currentCycleSpend, 2200);
  assert.equal(m.cash, 48000);
  assert.equal(getMoneyRequiredForPeriod({ futureMoney: m.futureMoney }).total, 2000); // only the next EMI
});

test("an installment charged after the statement is unbilled and projected once as the upcoming EMI", () => {
  const m = measures([emi("m2", "2026-10-18")]);
  assert.equal(m.summary.totalOutstanding, 0);
  assert.equal(m.summary.currentCycleSpend, 2000); // unbilled
  assert.equal(m.futureMoney.committedSpending.length, 0); // no statement due yet
  assert.equal(m.debt[0].date, "2026-11-05"); // still to be billed -> due on the current cycle's due date
  assert.equal(getMoneyRequiredForPeriod({ futureMoney: m.futureMoney }).total, 2000); // counted once, not also as unbilled
});
