import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCreditCardAccount } from "./billerShellResolution.js";

function makeShell(overrides = {}) {
  return { id: "shell1", name: "HDFC Regalia", type: "Credit Card", provider: "HDFC Regalia", createdAt: 1, ...overrides };
}
function makeBillerAccount(overrides = {}) {
  return { id: "ba1", billerId: "shell1", accId: "acc_cc_1", name: "HDFC Regalia", type: "Credit Card", consumerNo: null, createdAt: 1, ...overrides };
}
function makeCcAccount(overrides = {}) {
  return { id: "acc_cc_1", name: "HDFC Regalia", type: "cc", limit: 100000, ...overrides };
}

test("resolves the real CC account through the real shell -> billerAccount -> accId chain", () => {
  const shell = makeShell();
  const ba = makeBillerAccount();
  const ccAccount = makeCcAccount();
  const result = resolveCreditCardAccount(shell, [ba], [ccAccount]);
  assert.equal(result, ccAccount);
});

test("returns null for a non-Credit-Card shell — never resolves anything for a normal biller", () => {
  const shell = makeShell({ type: "Electricity" });
  const ba = makeBillerAccount({ billerId: "shell1" });
  const ccAccount = makeCcAccount();
  assert.equal(resolveCreditCardAccount(shell, [ba], [ccAccount]), null);
});

test("returns null (never a fabricated fallback) when a Credit Card shell has no linked billerAccount yet", () => {
  const shell = makeShell();
  assert.equal(resolveCreditCardAccount(shell, [], []), null);
});

test("returns null when the linked billerAccount's accId doesn't resolve to any real account", () => {
  const shell = makeShell();
  const ba = makeBillerAccount({ accId: "acc_does_not_exist" });
  assert.equal(resolveCreditCardAccount(shell, [ba], [makeCcAccount()]), null);
});

test("only matches billerAccounts belonging to THIS shell — a same-type biller-account under a different shell is ignored", () => {
  const shell = makeShell({ id: "shell1" });
  const wrongShellBa = makeBillerAccount({ billerId: "shell_other", accId: "acc_cc_1" });
  assert.equal(resolveCreditCardAccount(shell, [wrongShellBa], [makeCcAccount()]), null);
});

test("handles null/undefined shell, billerAccounts, accounts gracefully — never throws", () => {
  assert.equal(resolveCreditCardAccount(null, [], []), null);
  assert.equal(resolveCreditCardAccount(makeShell(), undefined, undefined), null);
});
