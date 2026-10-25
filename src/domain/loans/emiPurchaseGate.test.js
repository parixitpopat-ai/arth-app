// PURCHASE-ENTRY-001 §16.9 — stage 2b, TESTS ONLY, run against the CURRENT code.
// An invented field is put on a loan (`purchase`) and on a down-payment expense (`emiLoanId`) that no code writes yet; each gate proves what today's code does
// with such fields. Nothing here creates, reads or interprets them in production code. All data is synthetic.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getHouseholdAttributedTotal, getCategoryAttributedTotal, getMyExpenseShare } from "../../../domain/allocations/adapter.js";
import { reconcileAutoEmiLoans } from "./autoEmiProgress.js";
import { allocateCcPaymentToEmiInstallments } from "../cards/emiSettlement.js";
import { danglingReferences, restoreRehearsal, sameRecords } from "../../sync/snapshotIntegrity.js";
import { makeKit } from "../../sync/scenarios.js";

const PURCHASE = { v: 1, purchaseValuePaise: 3000000, downPaymentPaise: 600000, financedPaise: 2400000, tenure: 6, emiPaise: 420000, mode: "emi" };
const LOAN = () => ({ id: "L1", direction: "taken", name: "Phone", principal: 24000, outstanding: 24000, startDate: "2026-10-01", dueDate: "2026-11-01", dueDay: 1, tenureMonths: 6, emiAmount: 4200, hasInterest: true, interestRate: 15,
  sourceType: "bank", paymentMode: "emi", isEmiPlan: true, status: "active", repayments: [], purchase: PURCHASE });
const DOWN = (withRef = true) => ({ id: "t-down", type: "expense", desc: "Phone", merchant: "Phone", date: "2026-10-01", amount: 6000, accId: "b1", catId: "shopping", catIds: ["shopping"], people: {}, ...(withRef ? { emiLoanId: "L1" } : {}) });
const totals = txns => ({
  household: getHouseholdAttributedTotal({ periodTransactions: txns, allTransactions: txns }),
  category: getCategoryAttributedTotal(txns, "shopping", { allTransactions: txns }),
  mine: txns.map(t => getMyExpenseShare(t, {})),
});
const app = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");

// ---------- G1 loan removal / loan missing ----------
test("G1: a down-payment expense counts identically with or without the reference, and with the loan missing", () => {
  assert.deepEqual(totals([DOWN(true)]), totals([DOWN(false)]));
});
test("G1: the integrity code does not treat the reference as a relation (no dangling report, nothing rewritten)", () => {
  const snap = { version: 1, txns: [DOWN(true)], loans: [] };
  assert.deepEqual(danglingReferences(snap), []);
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
});
test("G1: there is no loan-removal operation in the app (only restore, sync overwrite or reset can drop a loan)", () => {
  assert.ok(!/setLoans\(\s*prev\s*=>\s*prev\.filter/.test(app), "a loan filter-out exists");
  assert.ok(!/loans\.filter\(\s*(l|loan)\s*=>\s*String\((l|loan)\.id\)\s*!==/.test(app));
});
test("G1: a restore that drops the loan leaves the expense, its field and its totals untouched (two-device simulation)", async () => {
  const kit = makeKit("new"); kit.seed(0);
  const A = kit.mk("A"); await A.start(); await A.settle(100);
  A.data().loans = [LOAN()]; A.data().txns.push(DOWN(true)); A.addTxn("trigger"); await A.settle(1500);
  assert.equal(A.data().loans[0].purchase.tenure, 6);
  const without = JSON.parse(JSON.stringify(A.data())); without.loans = [];                    // an older backup / overwrite that has the expense but no loan
  await A.restoreFrom(without); await A.settle(1500);
  assert.equal(A.data().loans.length, 0);
  const e = A.data().txns.find(t => t.id === "t-down");
  assert.equal(e.emiLoanId, "L1"); assert.equal(e.amount, 6000);
  assert.deepEqual(totals([e]), totals([DOWN(false)]));
});

// ---------- G2 manual Add Loan / loan edit form ----------
test("G2: the loan form builds the saved loan from the existing record and merges over the old one (unknown fields survive)", () => {
  assert.match(app, /const nextItem=\{\s*\.\.\.\(item\|\|\{\}\),/);
  assert.match(app, /prev\.map\(x=>x\.id===item\.id\?\{\.\.\.x,\.\.\.nextItem\}:x\)/);
});
test("G2: every other loan writer in the app spreads the existing loan", () => {
  for (const re of [/return \{\.\.\.l, outstanding:newOutstanding/, /\.\.\.loan,\s*\n\s*paymentAccId:accId/]) assert.match(app, re);
});

// ---------- G3 card-detail "new EMI" (cc_emi) flow and EMI helpers ----------
test("G3: the card-detail new-EMI flow builds a loan with no purchase record, so it reads as 'financed part only'", () => {
  const i = app.indexOf("ccEmiPlanId:planId"); assert.ok(i > 0);
  const block = app.slice(i - 400, i + 900);
  assert.ok(!/purchase\s*:/.test(block));
});
test("G3: the auto-EMI progress and card EMI settlement helpers keep unknown loan fields, and leave a loan with none unchanged", () => {
  const insts = [1, 2, 3].map(n => ({ id: `i${n}`, type: "expense", date: `2026-1${n - 1}-01`, amount: 4000, accId: "cc1" }));
  const loan = { ...LOAN(), sourceType: "cc", ccLinked: true, linkedCardId: "cc1", autoScheduled: true, scheduledInstallmentIds: ["i1", "i2", "i3"], principal: 12000, outstanding: 12000 };
  const next = reconcileAutoEmiLoans([loan], insts, "2026-11-15");
  assert.deepEqual(next[0].purchase, PURCHASE);
  const r = allocateCcPaymentToEmiInstallments([{ ...loan, scheduledInstallmentIds: ["i1", "i2", "i3"] }], insts.map(t => ({ ...t, isAutoEmiInstallment: true, emiInstallmentNum: 1 })), "cc1", 4000, "2026-11-20", () => "g1");
  for (const l of r.updatedLoans) assert.deepEqual(l.purchase, PURCHASE);
  const plain = { ...loan }; delete plain.purchase;
  const again = reconcileAutoEmiLoans([plain], insts, "2026-11-15");
  assert.ok(!("purchase" in again[0]));
});

// ---------- G4 two-device sync ----------
test("G4: a loan and an expense carrying the unknown fields reach the other device intact, and a later edit by that device keeps them", async () => {
  const kit = makeKit("new"); kit.seed(0);
  const A = kit.mk("A"), B = kit.mk("B"); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  A.data().loans = [LOAN()]; A.data().txns.push(DOWN(true)); A.addTxn("a1"); await A.settle(2000);
  await B.reload(); await B.settle(2000);
  assert.deepEqual(B.data().loans[0].purchase, PURCHASE);
  assert.equal(B.data().txns.find(t => t.id === "t-down").emiLoanId, "L1");
  B.data().loans = B.data().loans.map(l => ({ ...l, emiAmount: 4300 }));                        // a known writer: spreads the existing loan
  B.addTxn("b1"); await B.settle(2000); await A.reload(); await A.settle(2000);
  assert.equal(A.data().loans[0].emiAmount, 4300); assert.deepEqual(A.data().loans[0].purchase, PURCHASE);
  assert.equal(A.data().txns.find(t => t.id === "t-down").emiLoanId, "L1");
});
test("G4: when the devices diverge offline, no record loses its fields and no transaction is lost", async () => {
  const kit = makeKit("new"); kit.seed(0);
  const A = kit.mk("A"), B = kit.mk("B"); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  A.data().loans = [LOAN()]; A.data().txns.push(DOWN(true)); A.addTxn("a0"); await A.settle(2000); await B.reload(); await B.settle(2000);
  kit.cloud.faults.offlineDevices.add("B");
  B.addTxn("b-offline"); await B.settle(1500);
  A.data().loans = A.data().loans.map(l => ({ ...l, emiAmount: 4400 })); A.addTxn("a-online"); await A.settle(1500);
  kit.cloud.faults.offlineDevices.delete("B"); await B.reload(); await B.settle(3000); await A.reload(); await A.settle(3000);
  for (const d of [A, B]) {
    const e = d.data().txns.find(t => t.id === "t-down"); assert.equal(e && e.emiLoanId, "L1");
    const l = d.data().loans[0]; assert.ok(l && l.purchase && l.purchase.tenure === 6);
  }
});

// ---------- G5 snapshot restore ----------
test("G5: a snapshot carrying the fields restores unchanged through the restore rehearsal and through the device restore", async () => {
  const snap = { version: 1, txns: [DOWN(true)], loans: [LOAN()], accounts: [] };
  assert.equal(restoreRehearsal(snap, { loans: l => l.map(x => ({ ...x })) }).ok, true);
  const kit = makeKit("new"); kit.seed(0); const A = kit.mk("A"); await A.start(); await A.settle(100);
  await A.restoreFrom(snap); await A.settle(1500);
  assert.deepEqual(A.data().loans[0], LOAN()); assert.equal(A.data().txns.find(t => t.id === "t-down").emiLoanId, "L1");
});
test("G5: the app's restore normaliser spreads the stored loan, so the fields are kept (static guard on normalizeLoans)", () => {
  assert.match(app, /const normalizeLoans = stored => \(Array\.isArray\(stored\) \? stored : \[\]\)\.map\(loan=>\(\{\s*\.\.\.loan,/);
});
test("G5: a snapshot OLDER than the loan restores to the 'loan missing' state without altering the expense", async () => {
  const older = { version: 1, txns: [DOWN(true)], loans: [], accounts: [] };
  const kit = makeKit("new"); kit.seed(0); const A = kit.mk("A"); await A.start(); await A.settle(100);
  await A.restoreFrom(older); await A.settle(1500);
  assert.equal(A.data().loans.length, 0); assert.deepEqual(A.data().txns.find(t => t.id === "t-down"), DOWN(true));
  assert.deepEqual(sameRecords({ txns: [DOWN(true)] }, { txns: [A.data().txns.find(t => t.id === "t-down")] }).ok, true);
});

// ---------- G6 older-app editing ----------
test("G6: an older app that rebuilds records from known fields only loses the fields but changes no amount and no total", async () => {
  const strip = d => ({ ...d, loans: (d.loans || []).map(({ purchase, ...rest }) => rest), txns: (d.txns || []).map(({ emiLoanId, ...rest }) => rest) });
  const kit = makeKit("new"); kit.seed(0);
  const A = kit.mk("A"); await A.start(); await A.settle(100);
  A.data().loans = [LOAN()]; A.data().txns.push(DOWN(true)); A.addTxn("a1"); await A.settle(2000);
  const before = JSON.parse(JSON.stringify(A.data()));
  const old = (await import("../../sync/testing/sim.js")).createDevice({ name: "OLD", clock: kit.clock, cloud: kit.cloud, storage: undefined, applyTransform: strip });
  await old.start(); await old.settle(2500);
  const oe = old.data().txns.find(t => t.id === "t-down"), ol = old.data().loans[0];
  assert.ok(!("emiLoanId" in oe)); assert.ok(!("purchase" in ol));
  assert.equal(oe.amount, 6000); assert.equal(ol.principal, 24000); assert.equal(ol.emiAmount, 4200);
  assert.deepEqual(totals([oe]), totals(before.txns.filter(t => t.id === "t-down")));
});
