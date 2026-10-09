import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMonthCalendar, getDayEntries, formatCellAmount, calendarKind } from "./calendarSummary.js";
import { getHouseholdAttributedTotal } from "../../../domain/allocations/adapter.js";

const M = "2026-10";
const exp = (id, amount, date, extra = {}) => ({ id, type: "expense", amount, date, ...extra });
const cal = (txns, extra = {}) => buildMonthCalendar({ txns, monthKey: M, today: "2026-10-09", ...extra });
const day = (c, d) => c.days[d - 1];

test("month geometry: October 2026 starts on Thursday (Monday-first grid) and has 31 days", () => {
  const c = cal([]);
  assert.equal(c.daysInMonth, 31);
  assert.equal(c.startOffset, 3); // Mon, Tue, Wed blank
  assert.equal(day(c, 9).isToday, true);
  assert.equal(day(c, 10).isFuture, true);
});

test("a day's spent is my share; income counts only income transactions", () => {
  const c = cal([
    exp("a", 1000, "2026-10-03", { people: { p1: { mode: "owes", amount: 400 } } }),
    exp("b", 200, "2026-10-03"),
    { id: "i", type: "income", amount: 85000, date: "2026-10-01" },
  ]);
  assert.equal(day(c, 3).spent, 800); // 600 + 200
  assert.equal(day(c, 1).income, 85000);
  assert.equal(c.spentTotal, 800);
  assert.equal(c.incomeTotal, 85000);
});

test("a refund lowers the original expense's day and is not income", () => {
  const t = [exp("a", 1000, "2026-10-03"), { id: "r", type: "settlement_in", isRefund: true, againstTxnId: "a", amount: 300, date: "2026-10-12" }];
  const c = cal(t);
  assert.equal(day(c, 3).spent, 700);
  assert.equal(day(c, 12).income, 0);
  assert.equal(day(c, 12).otherCount, 1);
});

test("a friend's repayment, a transfer, an investment, a card payment and a loan given are listed but never spent or income", () => {
  const t = [
    exp("a", 1000, "2026-10-03", { people: { p1: { mode: "owes", amount: 400 } } }),
    { id: "s", type: "settlement_in", amount: 400, fromPersonId: "p1", againstTxnId: "a", date: "2026-10-05" },
    { id: "t", type: "transfer", amount: 5000, date: "2026-10-05", fromAccId: "b1", toAccId: null, isLoanDisbursal: true },
    { id: "v", type: "investment", amount: 700, date: "2026-10-05", accId: "b1" },
    { id: "c", type: "cc_payment", amount: 2000, date: "2026-10-05", fromAccId: "b1", toAccId: "cc1" },
  ];
  const c = cal(t);
  assert.equal(day(c, 5).spent, 0);
  assert.equal(day(c, 5).income, 0);
  assert.equal(day(c, 5).count, 4);
  assert.equal(day(c, 5).otherCount, 4);
  assert.equal(c.spentTotal, 600);
});

test("the month total is exactly Home's Spent (getHouseholdAttributedTotal) for the same facts", () => {
  const t = [
    exp("a", 1000, "2026-10-03", { people: { p1: { mode: "owes", amount: 400 } } }),
    exp("b", 500, "2026-10-04"), { id: "r", type: "settlement_in", isRefund: true, againstTxnId: "b", amount: 100, date: "2026-10-06" },
    exp("x", 200, "2026-10-07", { excludeFromSpend: true }),
    exp("g", 1000, "2026-10-08", { groupId: "g1", trackingMode: "split", groupAllocations: [{ groupId: "g1", mode: "owes", amount: 600 }] }),
    exp("prev", 9999, "2026-09-30"),
  ];
  const home = getHouseholdAttributedTotal({ periodTransactions: t.filter(x => x.date.startsWith(M)), allTransactions: t });
  assert.equal(cal(t).spentTotal, home);
  assert.equal(home, 600 + 400 + 0 + 400);
});

test("only the requested month is counted", () => {
  const c = cal([exp("a", 100, "2026-09-30"), exp("b", 200, "2026-10-01"), exp("c", 400, "2026-11-01")]);
  assert.equal(c.spentTotal, 200);
  assert.equal(c.entryCount, 1);
});

test("unpaid dues mark their day; other months are ignored", () => {
  const c = cal([], { dueDates: ["2026-10-14", "2026-10-14", "2026-11-02"] });
  assert.equal(day(c, 14).dueCount, 2);
  assert.equal(c.days.reduce((s, d) => s + d.dueCount, 0), 2);
});

test("day entries: full amount and my share, newest recorded first", () => {
  const t = [exp("a", 1000, "2026-10-03", { createdAt: 1, people: { p1: { mode: "owes", amount: 400 } } }), exp("b", 50, "2026-10-03", { createdAt: 2 }), { id: "i", type: "income", amount: 10, date: "2026-10-03", createdAt: 3 }];
  const e = getDayEntries({ txns: t, date: "2026-10-03" });
  assert.deepEqual(e.map(x => x.id), ["i", "b", "a"]);
  assert.equal(e[2].gross, 1000);
  assert.equal(e[2].share, 600);
  assert.equal(e[0].share, null);
  assert.equal(e[0].kind, "income");
});

test("cell amounts shorten to fit", () => {
  assert.equal(formatCellAmount(450), "450");
  assert.equal(formatCellAmount(9000, "", 4), "9k");
  assert.equal(formatCellAmount(85000, "+", 6), "+85k"); // "+85,000" is 7 characters
  assert.equal(formatCellAmount(85000, "+", 8), "+85,000");
  assert.equal(formatCellAmount(1200000, "", 4), "12L");
  assert.equal(calendarKind({ type: "cc_emi" }), "other");
});
