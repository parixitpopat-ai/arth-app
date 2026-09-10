import test from "node:test";
import assert from "node:assert/strict";

// Simulates App.jsx's SMS balance-sync block EXACTLY as it exists today
// (App.jsx:4085-4098, confirmed by direct trace) — before any WP-07 change.
// This captures current behavior, bug included, per the standing
// "characterize before changing" rule. Do not "fix" this simulation to
// match the intended new behavior — that belongs in smsBalanceSync.test.js.
//
// Also note (confirmed by repo-wide grep): `forceAdjust` is referenced only
// in the condition below and is never set to `true` at any of the 4 real
// parseSms() call sites in App.jsx today — the mutation branch is currently
// unreachable in the live app. These tests still exercise it directly
// (by passing forceAdjust:true themselves) to characterize the LOGIC as
// written, independent of whether any current UI path reaches it.

function accountBalanceRaw(accounts, txns, accId) {
  // Minimal stand-in matching App.jsx's accountBalance() for these tests'
  // purposes — full formula already characterized in balanceCalculations.characterization.test.js.
  const acc = accounts.find(a => a.id === accId);
  if (!acc || acc.type === "cc") return 0;
  let bal = Number(acc.openingBalance || 0);
  txns.forEach(t => {
    if (t.type === "income" && t.accId === accId) bal += Number(t.amount || 0);
    if (t.type === "expense" && t.accId === accId) bal -= Number(t.amount || 0);
  });
  return bal;
}

// Exact current logic from App.jsx:4085-4098.
function currentSmsBalanceSync({ accounts, txns, primaryAccount, smsBalance, options }) {
  let balanceAdjusted = false;
  let balanceDiff = 0;
  let updatedAccounts = accounts;
  if (options.adjustBalance && primaryAccount && primaryAccount.type !== "cc") {
    if (smsBalance !== null) {
      const appBal = accountBalanceRaw(accounts, txns, primaryAccount.id); // BUG: raw, not effective
      balanceDiff = smsBalance - appBal;
      if (Math.abs(balanceDiff) > 0.01 && options.forceAdjust) {
        updatedAccounts = accounts.map(a => a.id === primaryAccount.id ? { ...a, openingBalance: Number(a.openingBalance || 0) + balanceDiff } : a);
        balanceAdjusted = true;
      }
    }
  }
  return { balanceAdjusted, balanceDiff, accounts: updatedAccounts };
}

test("current: no checkpoint, diff above threshold, forceAdjust true -> openingBalance mutated", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000 }];
  const result = currentSmsBalanceSync({
    accounts, txns: [], primaryAccount: accounts[0], smsBalance: 1300,
    options: { adjustBalance: true, forceAdjust: true },
  });
  assert.equal(result.balanceAdjusted, true);
  assert.equal(result.accounts[0].openingBalance, 1300);
});

test("current: diff below threshold -> no mutation regardless of forceAdjust", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000 }];
  const result = currentSmsBalanceSync({
    accounts, txns: [], primaryAccount: accounts[0], smsBalance: 1000.005,
    options: { adjustBalance: true, forceAdjust: true },
  });
  assert.equal(result.balanceAdjusted, false);
  assert.equal(result.accounts[0].openingBalance, 1000);
});

test("current: diff above threshold but forceAdjust false -> no mutation (matches today's actual reachable behavior)", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000 }];
  const result = currentSmsBalanceSync({
    accounts, txns: [], primaryAccount: accounts[0], smsBalance: 1300,
    options: { adjustBalance: true, forceAdjust: false },
  });
  assert.equal(result.balanceAdjusted, false, "this is the ACTUAL live behavior today, since no real call site ever sets forceAdjust:true");
});

test("current: adjustBalance false -> nothing computed or mutated, regardless of everything else", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000 }];
  const result = currentSmsBalanceSync({
    accounts, txns: [], primaryAccount: accounts[0], smsBalance: 1300,
    options: { adjustBalance: false, forceAdjust: true },
  });
  assert.equal(result.balanceAdjusted, false);
});

test("current: CC accounts are never adjusted, regardless of options", () => {
  const accounts = [{ id: "cc1", type: "cc", openingBalance: 5000 }];
  const result = currentSmsBalanceSync({
    accounts, txns: [], primaryAccount: accounts[0], smsBalance: 8000,
    options: { adjustBalance: true, forceAdjust: true },
  });
  assert.equal(result.balanceAdjusted, false);
});

test("current: THE BUG — an existing checkpoint is completely ignored; comparison uses raw balance, mutation proceeds anyway", () => {
  // The current logic has no concept of balanceCheckpoints at all — this
  // test proves that by construction: even though a checkpoint conceptually
  // exists in the surrounding app, this function never looks at it, and
  // the mutation fires purely off the raw-balance diff exceeding threshold.
  const accounts = [{ id: "b1", type: "bank", openingBalance: 1000 }];
  // Pretend a checkpoint exists elsewhere in balanceCheckpoints — irrelevant here,
  // since currentSmsBalanceSync's signature doesn't even accept one.
  const result = currentSmsBalanceSync({
    accounts, txns: [], primaryAccount: accounts[0], smsBalance: 1300,
    options: { adjustBalance: true, forceAdjust: true },
  });
  assert.equal(result.balanceAdjusted, true, "confirmed: current code has no mechanism to skip adjustment for a checkpointed account");
  assert.equal(result.accounts[0].openingBalance, 1300);
});
