import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getCardSummary } from "./summaries.js";
import { getCardUsage } from "./usage.js";
import { expandPaymentLines } from "../payments/paymentLineSlices.js";

// Fixed "today" = 20 Oct 2026. Statement day 15 => last statement 15 Oct, previous 15 Sep.
// Billed window: 16 Sep..15 Oct. Unbilled window: after 15 Oct.
beforeEach(() => mock.timers.enable({ apis: ["Date"], now: new Date(2026, 9, 20, 12, 0, 0) }));
afterEach(() => mock.timers.reset());

const toDateOnly = v => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
const card = { id: "cc", type: "cc", statementDate: 15, dueDate: 5, limit: 10000 };
const upi = { id: "upi", type: "upi", linkedAccount: "cc" };
const accounts = [card, upi, { id: "bank", type: "bank" }];
const summary = txns => getCardSummary(card, accounts, expandPaymentLines(txns), toDateOnly);
const exp = (id, date, amount, accId = "cc", extra = {}) => ({ id, type: "expense", date, amount, accId, ...extra });

test("billed = charges in the last statement window; unbilled = charges after it", () => {
  const s = summary([exp(1, "2026-09-20", 1000), exp(2, "2026-10-18", 500)]);
  assert.equal(s.totalOutstanding, 1000);
  assert.equal(s.currentCycleSpend, 500);
});

test("charges on or before the previous statement date belong to an older, already-issued statement", () => {
  const s = summary([exp(1, "2026-09-15", 700), exp(2, "2026-10-15", 300)]);
  assert.equal(s.totalOutstanding, 300); // 15 Sep excluded, 15 Oct (statement day) included
  assert.equal(s.currentCycleSpend, 0);
});

test("a payment after the statement date reduces billed, not unbilled", () => {
  const pay = { id: 9, type: "cc_payment", date: "2026-10-17", amount: 400, fromAccId: "bank", toAccId: "cc" };
  const s = summary([exp(1, "2026-09-20", 1000), exp(2, "2026-10-18", 500), pay]);
  assert.equal(s.totalOutstanding, 600);
  assert.equal(s.currentCycleSpend, 500);
});

test("a payment before the statement date does not reduce the statement it preceded", () => {
  const early = { id: 9, type: "cc_payment", date: "2026-10-10", amount: 400, fromAccId: "bank", toAccId: "cc" };
  assert.equal(summary([exp(1, "2026-09-20", 1000), early]).totalOutstanding, 1000);
});

test("an in-cycle refund lowers billed; billed never goes below zero", () => {
  const refund = { id: 8, type: "settlement_in", isRefund: true, date: "2026-09-25", amount: 100, accId: "cc" };
  assert.equal(summary([exp(1, "2026-09-20", 1000), refund]).totalOutstanding, 900);
  assert.equal(summary([exp(1, "2026-09-20", 50), refund]).totalOutstanding, 0);
});

test("a UPI account linked to the card counts as card spend", () => {
  const s = summary([exp(1, "2026-09-20", 200, "upi"), exp(2, "2026-10-18", 80, "upi")]);
  assert.equal(s.totalOutstanding, 200);
  assert.equal(s.currentCycleSpend, 80);
});

test("a multi-method expense charges only the card's own slice", () => {
  const t = exp(1, "2026-09-20", 1000, "cc", { paymentLines: [{ accId: "cc", amount: 600, method: "card" }, { accId: "bank", amount: 400, method: "bank" }] });
  assert.equal(summary([t]).totalOutstanding, 600);
});

test("an investment on the card counts as billed before the statement date and unbilled after it", () => {
  const inv = (id, date, amount = 1000) => ({ id, type: "investment", date, amount, accId: "cc" });
  const before = summary([inv(1, "2026-09-20")]);
  assert.equal(before.totalOutstanding, 1000);
  assert.equal(before.currentCycleSpend, 0);
  const after = summary([inv(2, "2026-10-18")]);
  assert.equal(after.totalOutstanding, 0);
  assert.equal(after.currentCycleSpend, 1000);
});

test("statement-date transition: a charge is in exactly one of billed / unbilled", () => {
  // statement day = 15 Oct. Previous statement = 15 Sep.
  const cases = [
    ["2026-09-15", 0, 0], // on the previous statement date: belongs to the statement before (already issued)
    ["2026-09-16", 1000, 0], // first day of the billed window
    ["2026-10-15", 1000, 0], // statement day itself: billed
    ["2026-10-16", 0, 1000], // day after: unbilled
    ["2026-10-20", 0, 1000], // today: unbilled
  ];
  for (const type of ["expense", "investment", "cc_emi"]) {
    for (const [date, billed, unbilled] of cases) {
      const s = summary([{ id: 1, type, date, amount: 1000, accId: "cc" }]);
      assert.equal(s.totalOutstanding, billed, `${type} ${date} billed`);
      assert.equal(s.currentCycleSpend, unbilled, `${type} ${date} unbilled`);
    }
  }
});

test("an investment keeps its type and does not reach other card figures: usage adds billed + unbilled once", () => {
  const txns = [{ id: 1, type: "investment", date: "2026-09-20", amount: 1000, accId: "cc" }, { id: 2, type: "investment", date: "2026-10-18", amount: 500, accId: "cc" }];
  const s = summary(txns);
  assert.equal(txns[0].type, "investment");
  const u = getCardUsage({ limit: card.limit, billedOutstanding: s.totalOutstanding, unbilled: s.currentCycleSpend });
  assert.equal(u.used, 1500);
});

test("utilisation uses billed + unbilled together", () => {
  const s = summary([exp(1, "2026-09-20", 1000), exp(2, "2026-10-18", 500)]);
  const u = getCardUsage({ limit: card.limit, billedOutstanding: s.totalOutstanding, unbilled: s.currentCycleSpend });
  assert.equal(u.used, 1500);
  assert.equal(u.available, 8500);
  assert.equal(u.utilisationPct, 15);
  assert.equal(u.overLimit, false);
});
