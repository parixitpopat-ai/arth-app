import { test } from "node:test";
import assert from "node:assert/strict";
import { computePeriodAmount, generateDueStatements } from "./statementBills.js";

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
  const out = generateDueStatements({ card, accounts, txns: [], bills: [priorBill], toDateOnly, refDate });
  assert.equal(out.length, 2);
  assert.equal(out[0].periodFrom, "2026-09-15");
  assert.equal(out[0].periodTo, "2026-10-15");
  assert.equal(out[1].periodFrom, "2026-10-15");
  assert.equal(out[1].periodTo, "2026-11-15");
});
