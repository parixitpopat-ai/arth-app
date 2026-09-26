import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileCreditCardBillers } from "./creditCardReconciliation.js";

let idCounter = 0;
const genId = () => `id${++idCounter}`;

test("1. an existing Credit Card Account with no billers at all: creates a new shell + link", () => {
  idCounter = 0;
  const accounts = [{ id: "acc1", type: "cc", name: "Sapphire Visa 0001" }];
  const out = reconcileCreditCardBillers({ accounts, billers: [], billerAccounts: [], genId });
  assert.equal(out.newBillers.length, 1);
  assert.equal(out.newBillers[0].name, "Sapphire Visa 0001");
  assert.equal(out.newBillerAccounts.length, 1);
  assert.equal(out.newBillerAccounts[0].accId, "acc1");
  assert.equal(out.newBillerAccounts[0].billerId, out.newBillers[0].id);
});

test("2. runtime scenario reported: an orphaned same-name Biller resolves to the real Account, not a duplicate", () => {
  idCounter = 0;
  const accounts = [{ id: "acc-sapphire", type: "cc", name: "Sapphiro Visa 0001" }];
  const orphanShell = { id: "shell-sapphire-orphan", name: "Sapphiro Visa 0001", type: "Credit Card", provider: "Sapphiro Visa 0001", createdAt: 1 };
  const out = reconcileCreditCardBillers({ accounts, billers: [orphanShell], billerAccounts: [], genId });
  // No second shell created — the existing one is reused.
  assert.equal(out.newBillers.length, 0);
  assert.equal(out.newBillerAccounts.length, 1);
  assert.equal(out.newBillerAccounts[0].billerId, "shell-sapphire-orphan");
  assert.equal(out.newBillerAccounts[0].accId, "acc-sapphire");
});

test("2b. the match is case-insensitive", () => {
  idCounter = 0;
  const accounts = [{ id: "acc1", type: "cc", name: "coral rupay 8004" }];
  const orphanShell = { id: "shell1", name: "Coral RuPay 8004", type: "Credit Card", provider: "Coral RuPay 8004", createdAt: 1 };
  const out = reconcileCreditCardBillers({ accounts, billers: [orphanShell], billerAccounts: [], genId });
  assert.equal(out.newBillers.length, 0);
  assert.equal(out.newBillerAccounts[0].billerId, "shell1");
});

test("3. once reconciled, a re-run (the next effect tick) is a true no-op — idempotent", () => {
  idCounter = 0;
  const accounts = [{ id: "acc1", type: "cc", name: "Sapphiro Visa 0001" }];
  const billers = [{ id: "shell1", name: "Sapphiro Visa 0001", type: "Credit Card", provider: "Sapphiro Visa 0001", createdAt: 1 }];
  const billerAccounts = [{ id: "ba1", billerId: "shell1", accId: "acc1", name: "Sapphiro Visa 0001", type: "Credit Card" }];
  const out = reconcileCreditCardBillers({ accounts, billers, billerAccounts, genId });
  assert.deepEqual(out, { newBillers: [], newBillerAccounts: [] });
});

test("4. four independent cards each resolve to their own account, never cross-linked", () => {
  idCounter = 0;
  const accounts = [
    { id: "acc1", type: "cc", name: "Sapphiro Visa 0001" },
    { id: "acc2", type: "cc", name: "Amazon Visa 1017" },
    { id: "acc3", type: "cc", name: "Coral RuPay 8004" },
    { id: "acc4", type: "cc", name: "First Millenia" },
  ];
  const billers = [
    { id: "shell1", name: "Sapphiro Visa 0001", type: "Credit Card", provider: "Sapphiro Visa 0001" },
    { id: "shell2", name: "Amazon Visa 1017", type: "Credit Card", provider: "Amazon Visa 1017" },
    { id: "shell3", name: "Coral RuPay 8004", type: "Credit Card", provider: "Coral RuPay 8004" },
    { id: "shell4", name: "First Millenia", type: "Credit Card", provider: "First Millenia" },
  ];
  const out = reconcileCreditCardBillers({ accounts, billers, billerAccounts: [], genId });
  assert.equal(out.newBillers.length, 0);
  assert.equal(out.newBillerAccounts.length, 4);
  const byAcc = Object.fromEntries(out.newBillerAccounts.map(ba => [ba.accId, ba.billerId]));
  assert.equal(byAcc.acc1, "shell1");
  assert.equal(byAcc.acc2, "shell2");
  assert.equal(byAcc.acc3, "shell3");
  assert.equal(byAcc.acc4, "shell4");
});

test("5. a Credit Card biller with genuinely no matching Account is left alone (nothing to reconcile it to)", () => {
  idCounter = 0;
  const accounts = [];
  const billers = [{ id: "shell1", name: "Some Card Nobody Added", type: "Credit Card", provider: "Some Card Nobody Added" }];
  const out = reconcileCreditCardBillers({ accounts, billers, billerAccounts: [], genId });
  assert.deepEqual(out, { newBillers: [], newBillerAccounts: [] });
});

test("6. never touches non-Credit-Card billers or already-linked cc accounts", () => {
  idCounter = 0;
  const accounts = [
    { id: "acc1", type: "cc", name: "Linked Already" },
    { id: "acc2", type: "bank", name: "HDFC Savings" },
  ];
  const billers = [{ id: "shell1", name: "Electricity Co", type: "Electricity", provider: "Electricity Co" }];
  const billerAccounts = [{ id: "ba1", billerId: "somewhere", accId: "acc1", name: "Linked Already", type: "Credit Card" }];
  const out = reconcileCreditCardBillers({ accounts, billers, billerAccounts, genId });
  assert.deepEqual(out, { newBillers: [], newBillerAccounts: [] });
});
