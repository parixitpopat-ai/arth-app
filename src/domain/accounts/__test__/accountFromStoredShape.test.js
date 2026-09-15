import test from "node:test";
import assert from "node:assert/strict";
import { accountFromStoredShape } from "../accountFromStoredShape.js";
import { Account } from "../Account.js";
import { MIGRATION_STATE } from "../migrateLegacyAccount.js";

// --- Hydration correctness: all 5 built-ins ---

test("hydration: bank account -> behavior=bank, all fields preserved", () => {
  const stored = { id: "b1", type: "bank", name: "HDFC Savings", color: "#22c55e", last4: "3310", accountTypeId: "bank", typeLabel: "Bank Account", typeIcon: "🏦", typeBucket: "cash", openingBalance: 5000, openingBalanceDate: "2026-04-01", needsCalibration: false };
  const result = accountFromStoredShape(stored);
  assert.equal(result.status, "hydrated");
  assert.ok(result.account instanceof Account);
  assert.equal(result.account.behavior, "bank");
  assert.equal(result.account.classificationId, "bank");
  assert.equal(result.account.classificationLabel, "Bank Account");
  assert.equal(result.account.icon, "🏦");
  assert.equal(result.account.bucket, "cash");
  assert.equal(result.account.name, "HDFC Savings");
  assert.equal(result.account.openingBalance, 5000);
  assert.equal(result.account.last4, "3310");
});

test("hydration: cash account -> behavior=cash", () => {
  const stored = { id: "c1", type: "cash", name: "Wallet", accountTypeId: "cash", typeLabel: "Cash", openingBalance: 2000 };
  const result = accountFromStoredShape(stored);
  assert.equal(result.status, "hydrated");
  assert.equal(result.account.behavior, "cash");
  assert.equal(result.account.openingBalance, 2000);
});

test("hydration: credit card -> behavior=cc, cc-specific fields preserved", () => {
  const stored = { id: "cc1", type: "cc", name: "Sapphire", accountTypeId: "cc", typeLabel: "Credit Card", limit: 300000, outstanding: 12000, statementDate: 15, dueDate: 5, alertPct: 30, billingCycle: "15th–14th" };
  const result = accountFromStoredShape(stored);
  assert.equal(result.status, "hydrated");
  assert.equal(result.account.behavior, "cc");
  assert.equal(result.account.limit, 300000);
  assert.equal(result.account.outstanding, 12000);
  assert.equal(result.account.billingCycle, "15th–14th");
});

test("hydration: debit account -> behavior=debit, linkedBank preserved", () => {
  const stored = { id: "d1", type: "debit", name: "Visa", accountTypeId: "debit", typeLabel: "Debit Card", linkedBank: "b1", last4: "0211" };
  const result = accountFromStoredShape(stored);
  assert.equal(result.status, "hydrated");
  assert.equal(result.account.behavior, "debit");
  assert.equal(result.account.linkedBank, "b1");
});

test("hydration: upi account -> behavior=upi, handle and linkedAccount preserved", () => {
  const stored = { id: "u1", type: "upi", name: "GPay", accountTypeId: "upi", typeLabel: "UPI", handle: "9309848069@upi", linkedAccount: "b1" };
  const result = accountFromStoredShape(stored);
  assert.equal(result.status, "hydrated");
  assert.equal(result.account.behavior, "upi");
  assert.equal(result.account.handle, "9309848069@upi");
  assert.equal(result.account.linkedAccount, "b1");
});

test("hydration: custom classification with a resolved baseType (e.g. Digital Account -> cash) hydrates correctly", () => {
  const stored = { id: "g1", type: "cash", name: "R Wallet", accountTypeId: "digital_account", typeLabel: "Digital Account", typeIcon: "💵", typeBucket: "cash", attributedTo: null, attributeType: null, openingBalance: 3170.05, needsCalibration: true };
  const result = accountFromStoredShape(stored);
  assert.equal(result.status, "hydrated");
  assert.equal(result.account.behavior, "cash");
  assert.equal(result.account.classificationId, "digital_account");
  assert.equal(result.account.classificationLabel, "Digital Account");
});

// --- No event raised (the property that distinguishes this from migrateLegacyAccount) ---

test("hydration: raises no domain event (unlike migrateLegacyAccount's AccountCreated)", () => {
  const stored = { id: "b2", type: "bank", name: "ICICI", accountTypeId: "bank", typeLabel: "Bank Account" };
  const result = accountFromStoredShape(stored);
  assert.equal(result.status, "hydrated");
  const events = result.account.pullEvents();
  assert.deepEqual(events, []);
});

// --- Unresolved type: never guessed, never converted ---

test("hydration: unmapped custom type -> unresolved, NEEDS_BEHAVIOR, does not guess", () => {
  const stored = { id: "x1", type: "crypto", name: "My Crypto", typeLabel: "Crypto Wallet" };
  const result = accountFromStoredShape(stored);
  assert.equal(result.status, "unresolved");
  assert.equal(result.migrationState, MIGRATION_STATE.NEEDS_BEHAVIOR);
  assert.equal(result.classificationLabel, "Crypto Wallet");
});

test("hydration: unresolved type never defaults to bank or any other behavior", () => {
  const stored = { id: "x2", type: "bnpl", name: "Pay Later", typeLabel: "BNPL" };
  const result = accountFromStoredShape(stored);
  assert.equal(result.status, "unresolved");
  assert.notEqual(result.migrationState, "bank");
  assert.equal(result.account, undefined);
});

test("hydration: does not mutate the input stored record — type is preserved exactly as given", () => {
  const stored = { id: "x3", type: "crypto", name: "My Crypto", typeLabel: "Crypto Wallet" };
  const snapshot = JSON.stringify(stored);
  accountFromStoredShape(stored);
  assert.equal(JSON.stringify(stored), snapshot);
  assert.equal(stored.type, "crypto");
});

test("hydration: unresolved result carries the original stored record, untouched, for the caller to preserve", () => {
  const stored = { id: "x4", type: "crypto", name: "My Crypto", typeLabel: "Crypto Wallet", color: "#3b82f6" };
  const result = accountFromStoredShape(stored);
  assert.equal(result.status, "unresolved");
  assert.deepEqual(result.stored, stored);
});

// --- INVALID_DATA: resolved type, but another Account invariant fails ---
// Mirrors migrateLegacyAccount()'s existing two-failure-mode contract, so a
// caller that already handles NEEDS_BEHAVIOR/INVALID_DATA from migration
// handles both cases identically from hydration too.

test("hydration: resolved type but invalid data (debit, no linkedBank) -> unresolved, INVALID_DATA", () => {
  const stored = { id: "d2", type: "debit", name: "Orphan Debit", accountTypeId: "debit", typeLabel: "Debit Card" };
  const result = accountFromStoredShape(stored);
  assert.equal(result.status, "unresolved");
  assert.equal(result.migrationState, MIGRATION_STATE.INVALID_DATA);
  assert.ok(result.reason.includes("linked bank"));
});

test("hydration: unresolved INVALID_DATA does not mutate the stored record either", () => {
  const stored = { id: "d3", type: "debit", name: "Orphan Debit" };
  const snapshot = JSON.stringify(stored);
  accountFromStoredShape(stored);
  assert.equal(JSON.stringify(stored), snapshot);
});
