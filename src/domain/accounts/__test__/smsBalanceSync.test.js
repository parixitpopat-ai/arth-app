import test from "node:test";
import assert from "node:assert/strict";
import { evaluateObservedBalance, OBSERVATION_OUTCOME } from "../evaluateObservedBalance.js";

// Simulates App.jsx's SMS balance-sync block AFTER WP-07's fix, using the
// real evaluateObservedBalance() (not a re-implementation). This is what
// the patched App.jsx:4085-4098 call site does.
function newSmsBalanceSync({ accounts, balanceCheckpoints, primaryAccount, effectiveBalance, smsBalance, options }) {
  let balanceAdjusted = false;
  let reconciledDiscrepancy = false;
  let balanceDiff = 0;
  let updatedAccounts = accounts;

  if (options.adjustBalance && primaryAccount && primaryAccount.type !== "cc" && smsBalance !== null) {
    const existingCheckpoint = balanceCheckpoints[primaryAccount.id] || null;
    const evaluation = evaluateObservedBalance({
      effectiveBalance,
      existingCheckpoint,
      observedBalance: smsBalance,
    });
    balanceDiff = evaluation.diff;

    if (evaluation.outcome === OBSERVATION_OUTCOME.NO_CHECKPOINT && options.forceAdjust) {
      updatedAccounts = accounts.map(a => a.id === primaryAccount.id ? { ...a, openingBalance: Number(a.openingBalance || 0) + evaluation.diff } : a);
      balanceAdjusted = true;
    } else if (evaluation.outcome === OBSERVATION_OUTCOME.RECONCILED_DISCREPANCY) {
      reconciledDiscrepancy = true;
    }
    // MATCHES -> neither flag set, no mutation, no warning — same as today's "no diff" case.
  }

  return { balanceAdjusted, reconciledDiscrepancy, balanceDiff, accounts: updatedAccounts };
}

test("new: no checkpoint, diff above threshold, forceAdjust true -> openingBalance mutated (UNCHANGED from current behavior)", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000 }];
  const result = newSmsBalanceSync({
    accounts, balanceCheckpoints: {}, primaryAccount: accounts[0],
    effectiveBalance: 1000, smsBalance: 1300,
    options: { adjustBalance: true, forceAdjust: true },
  });
  assert.equal(result.balanceAdjusted, true);
  assert.equal(result.reconciledDiscrepancy, false);
  assert.equal(result.accounts[0].openingBalance, 1300);
});

test("new: existing checkpoint, diff above threshold -> NO mutation, RECONCILED_DISCREPANCY surfaced instead (THE FIX)", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000 }];
  const checkpoints = { b1: { amount: 1500, date: "2026-02-15" } };
  const result = newSmsBalanceSync({
    accounts, balanceCheckpoints: checkpoints, primaryAccount: accounts[0],
    effectiveBalance: 1500, // this IS effectiveAccountBalance, already including the gap
    smsBalance: 1800,
    options: { adjustBalance: true, forceAdjust: true },
  });
  assert.equal(result.balanceAdjusted, false, "must NOT silently mutate when a checkpoint exists");
  assert.equal(result.reconciledDiscrepancy, true, "must surface the conflict instead");
  assert.equal(result.accounts[0].openingBalance, 1000, "openingBalance is untouched");
  assert.equal(result.balanceDiff, 300, "the diff is still correctly reported to the caller for display purposes");
});

test("new: existing checkpoint, forceAdjust true still does not matter — checkpoint presence overrides it entirely", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000 }];
  const checkpoints = { b1: { amount: 1500, date: "2026-02-15" } };
  const result = newSmsBalanceSync({
    accounts, balanceCheckpoints: checkpoints, primaryAccount: accounts[0],
    effectiveBalance: 1500, smsBalance: 1800,
    options: { adjustBalance: true, forceAdjust: true },
  });
  assert.equal(result.balanceAdjusted, false, "forceAdjust does not override the checkpoint-safety rule");
});

test("new: existing checkpoint, observed MATCHES effectiveBalance -> no mutation, no warning (quiet success, same as no-diff case)", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000 }];
  const checkpoints = { b1: { amount: 1500, date: "2026-02-15" } };
  const result = newSmsBalanceSync({
    accounts, balanceCheckpoints: checkpoints, primaryAccount: accounts[0],
    effectiveBalance: 1500, smsBalance: 1500.005,
    options: { adjustBalance: true, forceAdjust: true },
  });
  assert.equal(result.balanceAdjusted, false);
  assert.equal(result.reconciledDiscrepancy, false);
});

test("new: no checkpoint, diff below threshold -> quiet, unchanged from current", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000 }];
  const result = newSmsBalanceSync({
    accounts, balanceCheckpoints: {}, primaryAccount: accounts[0],
    effectiveBalance: 1000, smsBalance: 1000.005,
    options: { adjustBalance: true, forceAdjust: true },
  });
  assert.equal(result.balanceAdjusted, false);
  assert.equal(result.reconciledDiscrepancy, false);
});

test("new: CC accounts still never touched, regardless of checkpoint state", () => {
  const accounts = [{ id: "cc1", type: "cc", openingBalance: 5000 }];
  const result = newSmsBalanceSync({
    accounts, balanceCheckpoints: { cc1: { amount: 6000, date: "2026-01-01" } }, primaryAccount: accounts[0],
    effectiveBalance: 0, smsBalance: 8000,
    options: { adjustBalance: true, forceAdjust: true },
  });
  assert.equal(result.balanceAdjusted, false);
  assert.equal(result.reconciledDiscrepancy, false);
});

test("new: root-cause proof — the exact scenario from balanceCalculations.characterization.test.js no longer produces a silent, ineffective mutation", () => {
  // Mirrors the ROOT CAUSE test: openingBalance 1000 -> shifted to 1300 would have been
  // mathematically invisible in effectiveAccountBalance. The new wiring prevents the
  // shift from happening at all when a checkpoint exists, rather than performing an
  // adjustment that silently does nothing.
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000 }];
  const checkpoints = { b1: { amount: 1600, date: "2026-02-15" } };
  const result = newSmsBalanceSync({
    accounts, balanceCheckpoints: checkpoints, primaryAccount: accounts[0],
    effectiveBalance: 1500, // accountBalance(1500) + gap(0) in this simplified scenario
    smsBalance: 1800,
    options: { adjustBalance: true, forceAdjust: true },
  });
  assert.equal(result.accounts[0].openingBalance, 1000, "no ineffective mutation happens at all now");
  assert.equal(result.reconciledDiscrepancy, true);
});
