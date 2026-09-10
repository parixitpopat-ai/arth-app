import test from "node:test";
import assert from "node:assert/strict";

// Simulates App.jsx's accountBalance/effectiveAccountBalance/accountReconciliationGap
// exactly as currently implemented (App.jsx:2058-2101, confirmed by direct trace) —
// App.jsx has no JSX test runtime in this sandbox, so this reproduces the real
// formulas verbatim rather than importing them. This is a CHARACTERIZATION of
// current behavior, written before any WP-07 change, per the standing "no code
// changes until characterization tests exist" rule.

function isDateInRange(date, start, end) {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function accountBalance(accounts, txns, accId, endDate = null) {
  const acc = accounts.find(a => a.id === accId);
  if (!acc || acc.type === "cc") return 0;
  const openingDate = acc.openingBalanceDate || "";
  const linkedDebitIds = acc.type === "bank"
    ? accounts.filter(a => (a.type === "debit" && a.linkedBank === accId) || (a.type === "upi" && a.linkedAccount === accId)).map(a => a.id)
    : [];
  let bal = Number(acc.openingBalance || 0);
  txns.forEach(t => {
    if (!isDateInRange(t.date, openingDate, endDate)) return;
    if (t.type === "income" && t.accId === accId) bal += Number(t.amount || 0);
    if (t.type === "settlement_in" && t.accId === accId) bal += Number(t.amount || 0);
    if (t.type === "expense") { if (t.accId === accId || linkedDebitIds.includes(t.accId)) bal -= Number(t.amount || 0); }
    if (t.type === "investment") { if (t.accId === accId || linkedDebitIds.includes(t.accId)) bal -= Number(t.amount || 0); }
    if (t.type === "transfer") {
      if (t.fromAccId === accId || linkedDebitIds.includes(t.fromAccId)) bal -= Number(t.amount || 0);
      if (t.toAccId === accId || linkedDebitIds.includes(t.toAccId)) bal += Number(t.amount || 0);
    }
    if (t.type === "cc_payment" && (t.fromAccId === accId || linkedDebitIds.includes(t.fromAccId))) bal -= Number(t.amount || 0);
  });
  return bal;
}

function accountReconciliationGap(accounts, txns, balanceCheckpoints, accId) {
  const checkpoint = balanceCheckpoints[accId];
  if (!checkpoint?.date) return 0;
  const expectedAtDate = accountBalance(accounts, txns, accId, checkpoint.date);
  return Number(checkpoint.amount || 0) - Number(expectedAtDate || 0);
}

function effectiveAccountBalance(accounts, txns, balanceCheckpoints, accId) {
  const acc = accounts.find(a => a.id === accId);
  if (!acc || acc.type === "cc") return 0;
  const computed = accountBalance(accounts, txns, accId);
  return acc.type === "bank" ? computed + accountReconciliationGap(accounts, txns, balanceCheckpoints, accId) : computed;
}

test("accountBalance: starts from openingBalance, applies income/expense within date range", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" }];
  const txns = [
    { type: "income", accId: "b1", amount: 500, date: "2026-02-01" },
    { type: "expense", accId: "b1", amount: 200, date: "2026-03-01" },
  ];
  assert.equal(accountBalance(accounts, txns, "b1"), 1300);
});

test("accountBalance: CC accounts always return 0", () => {
  const accounts = [{ id: "c1", type: "cc", openingBalance: 5000, openingBalanceDate: "2026-01-01" }];
  const txns = [{ type: "expense", accId: "c1", amount: 100, date: "2026-02-01" }];
  assert.equal(accountBalance(accounts, txns, "c1"), 0);
});

test("accountBalance: a bank account aggregates its linked debit card's expenses", () => {
  const accounts = [
    { id: "b1", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" },
    { id: "d1", type: "debit", linkedBank: "b1", openingBalance: 0 },
  ];
  const txns = [{ type: "expense", accId: "d1", amount: 300, date: "2026-02-01" }];
  assert.equal(accountBalance(accounts, txns, "b1"), 700);
});

test("accountBalance: transfer moves balance between fromAccId and toAccId", () => {
  const accounts = [
    { id: "b1", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" },
    { id: "b2", type: "bank", openingBalance: 500, openingBalanceDate: "2026-01-01" },
  ];
  const txns = [{ type: "transfer", fromAccId: "b1", toAccId: "b2", amount: 200, date: "2026-02-01" }];
  assert.equal(accountBalance(accounts, txns, "b1"), 800);
  assert.equal(accountBalance(accounts, txns, "b2"), 700);
});

test("accountBalance: endDate restricts the walk (used by accountReconciliationGap)", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" }];
  const txns = [
    { type: "income", accId: "b1", amount: 500, date: "2026-02-01" },
    { type: "income", accId: "b1", amount: 900, date: "2026-04-01" },
  ];
  assert.equal(accountBalance(accounts, txns, "b1", "2026-03-01"), 1500, "the April income must not count when endDate is March");
});

test("accountReconciliationGap: zero when no checkpoint exists", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" }];
  assert.equal(accountReconciliationGap(accounts, [], {}, "b1"), 0);
});

test("accountReconciliationGap: checkpoint.amount minus the ledger value at the checkpoint's date", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" }];
  const txns = [{ type: "income", accId: "b1", amount: 500, date: "2026-02-01" }];
  const checkpoints = { b1: { amount: 1600, date: "2026-02-15" } };
  // Ledger at 2026-02-15 = 1000 + 500 = 1500. Checkpoint claims 1600. Gap = +100.
  assert.equal(accountReconciliationGap(accounts, txns, checkpoints, "b1"), 100);
});

test("effectiveAccountBalance: for bank, equals accountBalance + accountReconciliationGap", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" }];
  const txns = [{ type: "income", accId: "b1", amount: 500, date: "2026-02-01" }];
  const checkpoints = { b1: { amount: 1600, date: "2026-02-15" } };
  assert.equal(effectiveAccountBalance(accounts, txns, checkpoints, "b1"), 1500 + 100);
});

test("effectiveAccountBalance: for cash, IGNORES any checkpoint that might exist — no gap ever applied", () => {
  const accounts = [{ id: "c1", type: "cash", openingBalance: 1000, openingBalanceDate: "2026-01-01" }];
  const checkpoints = { c1: { amount: 5000, date: "2026-02-15" } }; // wildly different, should be ignored
  assert.equal(effectiveAccountBalance(accounts, [], checkpoints, "c1"), 1000, "cash accounts never apply the reconciliation gap, confirmed by the acc.type===\"bank\" guard");
});

test("effectiveAccountBalance: for CC, always 0", () => {
  const accounts = [{ id: "cc1", type: "cc", openingBalance: 5000, openingBalanceDate: "2026-01-01" }];
  assert.equal(effectiveAccountBalance(accounts, [], {}, "cc1"), 0);
});

test("ROOT CAUSE, confirmed mathematically: an openingBalance-only shift is fully canceled by the reconciliation gap for a checkpointed bank account — effectiveAccountBalance is invariant to it", () => {
  const before = [{ id: "b1", type: "bank", openingBalance: 1000, openingBalanceDate: "2026-01-01" }];
  const after = [{ id: "b1", type: "bank", openingBalance: 1300, openingBalanceDate: "2026-01-01" }]; // shifted by +300
  const txns = [{ type: "income", accId: "b1", amount: 500, date: "2026-02-01" }];
  const checkpoints = { b1: { amount: 1600, date: "2026-02-15" } };

  const effectiveBefore = effectiveAccountBalance(before, txns, checkpoints, "b1");
  const effectiveAfter = effectiveAccountBalance(after, txns, checkpoints, "b1");

  assert.equal(effectiveBefore, effectiveAfter, "this is the exact bug WP-07 fixes: SMS sync's openingBalance-only adjustment is mathematically invisible in effectiveAccountBalance for a checkpointed account");

  // Meanwhile the raw accountBalance DOES move — proving the discrepancy is only invisible on effective, not on raw.
  const rawBefore = accountBalance(before, txns, "b1");
  const rawAfter = accountBalance(after, txns, "b1");
  assert.notEqual(rawBefore, rawAfter, "raw accountBalance is NOT invariant — this is why MoneyPage (raw) and WealthPage (effective) would show different post-adjustment results, the display inconsistency noted separately as out of WP-07's scope");
});
