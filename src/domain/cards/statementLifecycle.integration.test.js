// Runtime/integration test for the Credit Card WP's statement lifecycle — exercises the exact
// sequence App.jsx's lazy effect runs (generateDueStatements -> allocateCcPaymentsToStatements),
// against real cc_payment transactions, rather than testing either module in isolation. This is
// the closest available substitute for browser verification in this environment (no browser tool
// here): it runs the same domain functions the UI calls, in the same order, on realistic data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDueStatements } from "./statementBills.js";
import { allocateCcPaymentsToStatements } from "./paymentAllocation.js";
import { recordBankAmount, applyRecalculatedUpdate } from "./reconciliation.js";

const toDateOnly = value => {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

const card = { id: "cc1", name: "Test Card", statementDate: 15, dueDate: 5 };
const accounts = [card];

// Applies the same patching App.jsx's setBills(prev => prev.map(...)) does for allocations.
const applyAllocations = (bills, allocations) => bills.map(b => {
  const alloc = allocations.find(a => a.billId === b.id);
  return alloc ? { ...b, status: "paid", paidByTxnId: alloc.paidByTxnId, paidDate: alloc.paidDate } : b;
});

test("exact payment: statement generates, then a matching cc_payment closes it", () => {
  const refDate = new Date(2026, 8, 20); // 20 Sep 2026 -> closed cycle 15 Aug - 15 Sep
  const txns = [{ id: "e1", type: "expense", accId: "cc1", date: "2026-08-20", amount: 35000 }];
  let bills = generateDueStatements({ card, accounts, txns, bills: [], toDateOnly, refDate });
  assert.equal(bills.length, 1);
  assert.equal(bills[0].amount, 35000);
  assert.equal(bills[0].status, "unpaid");

  const paymentTxns = [...txns, { id: "p1", type: "cc_payment", toAccId: "cc1", date: "2026-09-25", amount: 35000 }];
  const allocations = allocateCcPaymentsToStatements(card, bills, paymentTxns);
  bills = applyAllocations(bills, allocations);
  assert.equal(bills[0].status, "paid");
  assert.equal(bills[0].paidByTxnId, "p1");

  // Re-running generation against the now-paid bill must not re-generate or double-allocate.
  const again = generateDueStatements({ card, accounts, txns: paymentTxns, bills, toDateOnly, refDate });
  assert.equal(again.length, 0);
  const againAlloc = allocateCcPaymentsToStatements(card, bills, paymentTxns);
  assert.equal(againAlloc.length, 0);
});

test("partial payment: statement stays unpaid, reconciliation is unaffected by payment status (rule 10)", () => {
  const refDate = new Date(2026, 8, 20);
  const txns = [{ id: "e1", type: "expense", accId: "cc1", date: "2026-08-20", amount: 35000 }];
  let bills = generateDueStatements({ card, accounts, txns, bills: [], toDateOnly, refDate });
  const paymentTxns = [...txns, { id: "p1", type: "cc_payment", toAccId: "cc1", date: "2026-09-25", amount: 20000 }];
  const allocations = allocateCcPaymentsToStatements(card, bills, paymentTxns);
  assert.equal(allocations.length, 0);
  bills = applyAllocations(bills, allocations);
  assert.equal(bills[0].status, "unpaid");
  // Verification can still proceed and complete independently of the unpaid status.
  bills = bills.map(b => (b.id === bills[0].id ? recordBankAmount(b, 35000) : b));
  assert.equal(bills[0].verification, "matched");
  assert.equal(bills[0].status, "unpaid"); // payment and verification are genuinely independent
});

test("overpayment across two cycles: one large payment closes both, oldest first", () => {
  // First-ever generation only ever materializes the most recently closed cycle (statementBills.js
  // never backfills further history it wasn't asked to) — so to get two real generated bills here,
  // this simulates the app being opened once at each cycle's close, exactly as it would run live.
  const txns = [
    { id: "e1", type: "expense", accId: "cc1", date: "2026-08-20", amount: 10000 },
    { id: "e2", type: "expense", accId: "cc1", date: "2026-09-20", amount: 15000 },
  ];
  let bills = generateDueStatements({ card, accounts, txns, bills: [], toDateOnly, refDate: new Date(2026, 8, 20) }); // Sep 20 -> closes Aug15-Sep15
  assert.equal(bills.length, 1);
  bills = [...bills, ...generateDueStatements({ card, accounts, txns, bills, toDateOnly, refDate: new Date(2026, 9, 20) })]; // Oct 20 -> closes Sep15-Oct15
  assert.equal(bills.length, 2);

  const paymentTxns = [...txns, { id: "p1", type: "cc_payment", toAccId: "cc1", date: "2026-10-25", amount: 100000 }];
  const allocations = allocateCcPaymentsToStatements(card, bills, paymentTxns);
  assert.equal(allocations.length, 2);
  bills = applyAllocations(bills, allocations);
  assert.ok(bills.every(b => b.status === "paid"));
  assert.ok(bills.every(b => b.paidByTxnId === "p1"));
});

test("mismatch recalculation then payment: independent concerns compose correctly", () => {
  const refDate = new Date(2026, 8, 20);
  const txns = [{ id: "e1", type: "expense", accId: "cc1", date: "2026-08-20", amount: 35000 }];
  let bills = generateDueStatements({ card, accounts, txns, bills: [], toDateOnly, refDate });
  bills = bills.map(b => recordBankAmount(b, 40000)); // bank higher -> mismatch
  assert.equal(bills[0].verification, "mismatch");

  // User adds the missing 5000 transaction, recalculates.
  const correctedTxns = [...txns, { id: "e2", type: "expense", accId: "cc1", date: "2026-09-01", amount: 5000 }];
  bills = bills.map(b => applyRecalculatedUpdate(b, 40000));
  assert.equal(bills[0].amount, 40000);
  assert.equal(bills[0].verification, "matched");

  // Paying the now-corrected 40000 amount closes it.
  const paymentTxns = [...correctedTxns, { id: "p1", type: "cc_payment", toAccId: "cc1", date: "2026-09-25", amount: 40000 }];
  const allocations = allocateCcPaymentsToStatements(card, bills, paymentTxns);
  assert.equal(allocations.length, 1);
  bills = applyAllocations(bills, allocations);
  assert.equal(bills[0].status, "paid");
});
