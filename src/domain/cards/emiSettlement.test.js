import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateCcPaymentToEmiInstallments, calculateExpectedLoanOutstanding } from "./emiSettlement.js";

let idCounter = 0;
const genId = () => `id_${++idCounter}`;

function makeLoan(overrides = {}) {
  return {
    id: "loan1", direction: "taken", sourceType: "cc", ccLinked: true,
    linkedCardId: "card1", ccEmiPlanId: "plan1", principal: 27000, outstanding: 27000,
    status: "active", repayments: [], ...overrides,
  };
}

function makeInstallment(overrides = {}) {
  return {
    id: "txn1", type: "cc_emi", accId: "card1", ccEmiPlanId: "plan1",
    amount: 4500, date: "2026-06-01", emiAmountSettled: 0,
    ...overrides,
  };
}

// --- 1. Full payment of one EMI -----------------------------------------

test("full payment of one EMI installment fully settles it, reduces outstanding by exactly that amount", () => {
  const loans = [makeLoan()];
  const txns = [makeInstallment({ id: "i1", amount: 4500 })];
  const { updatedLoans, updatedTxns, totalAllocated } = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 4500, "2026-07-01", genId);

  assert.equal(totalAllocated, 4500);
  const loan = updatedLoans.find(l => l.id === "loan1");
  assert.equal(loan.outstanding, 22500); // 27000 - 4500
  const installment = updatedTxns.find(t => t.id === "i1");
  assert.equal(installment.emiAmountSettled, 4500);
  assert.equal(installment.paidInBill, true);
});

// --- 2. Full payment covering multiple EMI installments -------------------

test("locked example: ₹9,000 payment fully settles two ₹4,500 installments", () => {
  const loans = [makeLoan()];
  const txns = [
    makeInstallment({ id: "sep", amount: 4500, date: "2026-09-01" }),
    makeInstallment({ id: "oct", amount: 4500, date: "2026-10-01" }),
  ];
  const { updatedLoans, updatedTxns, totalAllocated } = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 9000, "2026-11-01", genId);

  assert.equal(totalAllocated, 9000);
  assert.equal(updatedLoans[0].outstanding, 18000); // 27000 - 9000
  assert.equal(updatedTxns.find(t => t.id === "sep").paidInBill, true);
  assert.equal(updatedTxns.find(t => t.id === "oct").paidInBill, true);
});

// --- 3. Partial CC payment against outstanding EMI — the core bug fix ---

test("THE BUG FIX: ₹500 payment against ₹9,000 of pending EMI does NOT clear either installment or reduce outstanding by more than ₹500", () => {
  const loans = [makeLoan()];
  const txns = [
    makeInstallment({ id: "sep", amount: 4500, date: "2026-09-01" }),
    makeInstallment({ id: "oct", amount: 4500, date: "2026-10-01" }),
  ];
  const { updatedLoans, updatedTxns, totalAllocated } = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 500, "2026-11-01", genId);

  assert.equal(totalAllocated, 500);
  assert.equal(updatedLoans[0].outstanding, 26500); // 27000 - 500, NOT 27000-9000
  const sep = updatedTxns.find(t => t.id === "sep");
  assert.equal(sep.emiAmountSettled, 500);
  assert.equal(sep.paidInBill, false); // NOT falsely marked paid
  const oct = updatedTxns.find(t => t.id === "oct");
  assert.equal(oct.emiAmountSettled, 0); // completely untouched
  assert.equal(oct.paidInBill, false);
});

// --- 4. Payment smaller than the first EMI -------------------------------

test("payment smaller than even the first installment partially settles only that one", () => {
  const loans = [makeLoan()];
  const txns = [makeInstallment({ id: "i1", amount: 4500 })];
  const { updatedLoans, updatedTxns } = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 1000, "2026-07-01", genId);
  assert.equal(updatedLoans[0].outstanding, 26000); // 27000 - 1000
  assert.equal(updatedTxns[0].emiAmountSettled, 1000);
  assert.equal(updatedTxns[0].paidInBill, false);
});

// --- 5. Payment larger than one EMI but smaller than two ------------------

test("payment covering one full installment plus part of the next splits correctly across both", () => {
  const loans = [makeLoan()];
  const txns = [
    makeInstallment({ id: "i1", amount: 4500, date: "2026-09-01" }),
    makeInstallment({ id: "i2", amount: 4500, date: "2026-10-01" }),
  ];
  const { updatedLoans, updatedTxns, totalAllocated } = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 6000, "2026-11-01", genId);

  assert.equal(totalAllocated, 6000);
  assert.equal(updatedLoans[0].outstanding, 21000); // 27000 - 6000
  const i1 = updatedTxns.find(t => t.id === "i1");
  assert.equal(i1.emiAmountSettled, 4500);
  assert.equal(i1.paidInBill, true); // fully settled
  const i2 = updatedTxns.find(t => t.id === "i2");
  assert.equal(i2.emiAmountSettled, 1500); // 6000 - 4500 remainder
  assert.equal(i2.paidInBill, false); // only partially settled
});

// --- 6. Existing non-EMI CC purchases alongside EMI -----------------------

test("regular (non-EMI) purchases on the same card are completely untouched by this allocation", () => {
  const loans = [makeLoan()];
  const txns = [
    makeInstallment({ id: "emi1", amount: 4500 }),
    { id: "purchase1", type: "expense", accId: "card1", amount: 1200, date: "2026-06-05" }, // regular purchase
  ];
  const { updatedTxns } = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 4500, "2026-07-01", genId);
  const purchase = updatedTxns.find(t => t.id === "purchase1");
  assert.deepEqual(purchase, txns[1]); // byte-identical, completely unmodified
});

// --- 7. Multiple EMI plans on the same card --------------------------------

test("multiple EMI plans on the same card: payment allocates oldest-first ACROSS plans, not per-plan", () => {
  const loans = [
    makeLoan({ id: "loanA", ccEmiPlanId: "planA", principal: 9000, outstanding: 9000 }),
    makeLoan({ id: "loanB", ccEmiPlanId: "planB", principal: 9000, outstanding: 9000 }),
  ];
  const txns = [
    makeInstallment({ id: "a1", ccEmiPlanId: "planA", amount: 4500, date: "2026-09-01" }), // oldest
    makeInstallment({ id: "b1", ccEmiPlanId: "planB", amount: 4500, date: "2026-09-15" }), // newer
  ];
  // Payment covers plan A's installment fully, plus half of plan B's.
  const { updatedLoans, updatedTxns } = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 6750, "2026-10-01", genId);

  const loanA = updatedLoans.find(l => l.id === "loanA");
  const loanB = updatedLoans.find(l => l.id === "loanB");
  assert.equal(loanA.outstanding, 4500); // 9000 - 4500 (a1 fully settled)
  assert.equal(loanB.outstanding, 6750); // 9000 - 2250 (b1 half settled)

  assert.equal(updatedTxns.find(t => t.id === "a1").paidInBill, true);
  assert.equal(updatedTxns.find(t => t.id === "b1").emiAmountSettled, 2250);
  assert.equal(updatedTxns.find(t => t.id === "b1").paidInBill, false);
});

test("multiple plans, payment only large enough for the older plan's installments — newer plan untouched", () => {
  const loans = [
    makeLoan({ id: "loanA", ccEmiPlanId: "planA", principal: 4500, outstanding: 4500 }),
    makeLoan({ id: "loanB", ccEmiPlanId: "planB", principal: 4500, outstanding: 4500 }),
  ];
  const txns = [
    makeInstallment({ id: "a1", ccEmiPlanId: "planA", amount: 4500, date: "2026-09-01" }),
    makeInstallment({ id: "b1", ccEmiPlanId: "planB", amount: 4500, date: "2026-09-15" }),
  ];
  const { updatedLoans } = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 4500, "2026-10-01", genId);
  assert.equal(updatedLoans.find(l => l.id === "loanA").outstanding, 0);
  assert.equal(updatedLoans.find(l => l.id === "loanB").outstanding, 4500); // completely untouched
});

// --- 8. loan.outstanding reconciliation invariant --------------------------

test("loan.outstanding always agrees with the independently-recomputed expected value, across a multi-step sequence", () => {
  let loans = [makeLoan({ principal: 27000, outstanding: 27000 })];
  let txns = [
    makeInstallment({ id: "i1", amount: 4500, date: "2026-06-01" }),
    makeInstallment({ id: "i2", amount: 4500, date: "2026-07-01" }),
    makeInstallment({ id: "i3", amount: 4500, date: "2026-08-01" }),
  ];

  // Step 1: partial payment.
  let result = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 2000, "2026-06-05", genId);
  loans = result.updatedLoans; txns = result.updatedTxns;
  assert.equal(loans[0].outstanding, calculateExpectedLoanOutstanding(loans[0], txns));

  // Step 2: another payment, crossing into the second installment.
  result = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 5000, "2026-07-05", genId);
  loans = result.updatedLoans; txns = result.updatedTxns;
  assert.equal(loans[0].outstanding, calculateExpectedLoanOutstanding(loans[0], txns));

  // Step 3: a big overpayment relative to what's left logged.
  result = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 20000, "2026-08-05", genId);
  loans = result.updatedLoans; txns = result.updatedTxns;
  assert.equal(loans[0].outstanding, calculateExpectedLoanOutstanding(loans[0], txns));
});

// --- Edge cases -------------------------------------------------------------

test("a payment with nothing pending on the card allocates nothing, changes nothing", () => {
  const loans = [makeLoan({ outstanding: 0, status: "closed" })];
  const txns = [makeInstallment({ id: "i1", amount: 4500, emiAmountSettled: 4500, paidInBill: true })];
  const { updatedLoans, updatedTxns, totalAllocated } = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 4500, "2026-07-01", genId);
  assert.equal(totalAllocated, 0);
  assert.deepEqual(updatedLoans, loans);
  assert.deepEqual(updatedTxns, txns);
});

test("a card with no CC-linked loans at all is a safe no-op", () => {
  const loans = [{ id: "personal1", direction: "taken", sourceType: "person" }]; // unrelated loan
  const txns = [];
  const { updatedLoans, updatedTxns, totalAllocated } = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 500, "2026-07-01", genId);
  assert.equal(totalAllocated, 0);
  assert.deepEqual(updatedLoans, loans);
});

test("loan closes (status becomes closed) exactly when outstanding reaches zero, not before", () => {
  const loans = [makeLoan({ principal: 4500, outstanding: 4500 })];
  const txns = [makeInstallment({ id: "i1", amount: 4500 })];
  const { updatedLoans: partial } = allocateCcPaymentToEmiInstallments(loans, txns, "card1", 4000, "2026-07-01", genId);
  assert.equal(partial[0].status, "active"); // 500 still outstanding

  const { updatedLoans: full } = allocateCcPaymentToEmiInstallments(partial, txns.map(t=>({...t, emiAmountSettled:4000})), "card1", 500, "2026-07-02", genId);
  assert.equal(full[0].outstanding, 0);
  assert.equal(full[0].status, "closed");
});

test("never mutates input loans or txns arrays/objects", () => {
  const loans = [makeLoan()];
  const txns = [makeInstallment({ id: "i1" })];
  const loanSnapshot = JSON.parse(JSON.stringify(loans));
  const txnSnapshot = JSON.parse(JSON.stringify(txns));
  allocateCcPaymentToEmiInstallments(loans, txns, "card1", 2000, "2026-07-01", genId);
  assert.deepEqual(loans, loanSnapshot);
  assert.deepEqual(txns, txnSnapshot);
});

test("does not rewrite any core historical fact on the installment transaction — amount, date, type all unchanged", () => {
  const loans = [makeLoan()];
  const original = makeInstallment({ id: "i1", amount: 4500, date: "2026-06-01" });
  const { updatedTxns } = allocateCcPaymentToEmiInstallments(loans, [original], "card1", 2000, "2026-07-01", genId);
  const updated = updatedTxns[0];
  assert.equal(updated.amount, original.amount);
  assert.equal(updated.date, original.date);
  assert.equal(updated.type, original.type);
  assert.equal(updated.ccEmiPlanId, original.ccEmiPlanId);
});
