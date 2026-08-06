import test from "node:test";
import assert from "node:assert/strict";
import { migrateLegacyAccount, migrateLegacyAccounts, generateMigrationReport, MIGRATION_STATE } from "../migrateLegacyAccount.js";
import { Account } from "../Account.js";

// --- Migration decision table, row by row ---

test("migration: built-in bank (Savings) -> behavior=bank, High confidence", () => {
  const legacy = { id: "a1", type: "bank", accountTypeId: "savings", typeLabel: "Savings Account", typeIcon: "🏦", typeBucket: "cash-bank", name: "HDFC Savings" };
  const result = migrateLegacyAccount(legacy);
  assert.equal(result.status, "migrated");
  assert.ok(result.account instanceof Account);
  assert.equal(result.account.behavior, "bank");
  assert.equal(result.account.classificationId, "savings");
  assert.equal(result.account.classificationLabel, "Savings Account");
});

test("migration: built-in bank (Salary) -> behavior=bank, High confidence", () => {
  const legacy = { id: "a2", type: "bank", accountTypeId: "salary", typeLabel: "Salary Account", name: "ICICI Salary" };
  const result = migrateLegacyAccount(legacy);
  assert.equal(result.status, "migrated");
  assert.equal(result.account.behavior, "bank");
  assert.equal(result.account.classificationLabel, "Salary Account");
});

test("migration: cash -> behavior=cash, High confidence", () => {
  const legacy = { id: "a3", type: "cash", name: "Wallet" };
  const result = migrateLegacyAccount(legacy);
  assert.equal(result.status, "migrated");
  assert.equal(result.account.behavior, "cash");
});

test("migration: credit card -> behavior=cc, High confidence", () => {
  const legacy = { id: "a4", type: "cc", name: "HDFC Regalia", limit: 200000, outstanding: 0 };
  const result = migrateLegacyAccount(legacy);
  assert.equal(result.status, "migrated");
  assert.equal(result.account.behavior, "cc");
  assert.equal(result.account.limit, 200000);
});

test("migration: upi -> behavior=upi, High confidence", () => {
  const legacy = { id: "a5", type: "upi", name: "GPay", handle: "me@okicici" };
  const result = migrateLegacyAccount(legacy);
  assert.equal(result.status, "migrated");
  assert.equal(result.account.behavior, "upi");
  assert.equal(result.account.handle, "me@okicici");
});

// The key row: legacy custom type with no behavior mapping. Per ADR-035,
// must NOT guess — not "everything becomes bank", not inferred from name.
test("migration: legacy custom type with no behavior -> unresolved, NEEDS_BEHAVIOR, does not guess", () => {
  const legacy = { id: "a6", type: "crypto", name: "Binance Wallet", accountTypeId: "crypto", typeLabel: "Crypto" };
  const result = migrateLegacyAccount(legacy);
  assert.equal(result.status, "unresolved");
  assert.equal(result.migrationState, MIGRATION_STATE.NEEDS_BEHAVIOR);
  assert.equal(result.legacy, legacy);
  assert.equal(result.classificationLabel, "Crypto");
  // Explicitly: no Account instance is ever produced for this record.
  assert.equal(result.account, undefined);
});

test("migration: unresolved custom type never defaults to bank", () => {
  const legacy = { id: "a7", type: "bnpl", name: "Simpl" };
  const result = migrateLegacyAccount(legacy);
  assert.equal(result.status, "unresolved");
  assert.notEqual(result.status, "migrated");
});

// Distinct failure mode: built-in type maps fine, but another invariant
// fails (debit with no linkedBank) — a real data problem, not an ambiguity.
test("migration: built-in type with invalid data (debit, no linkedBank) -> unresolved, INVALID_DATA", () => {
  const legacy = { id: "a8", type: "debit", name: "Debit Card", linkedBank: null };
  const result = migrateLegacyAccount(legacy);
  assert.equal(result.status, "unresolved");
  assert.equal(result.migrationState, MIGRATION_STATE.INVALID_DATA);
  assert.match(result.reason, /linked bank/i);
});

// --- migrateLegacyAccounts() — batch, MigrationResult shape ---

test("migrateLegacyAccounts(): returns migratedAccounts/unresolvedAccounts/warnings", () => {
  const legacyAccounts = [
    { id: "a1", type: "bank", name: "Savings" },
    { id: "a2", type: "crypto", name: "Crypto Wallet" },
    { id: "a3", type: "debit", name: "Debit", linkedBank: null },
  ];
  const result = migrateLegacyAccounts(legacyAccounts);
  assert.equal(result.migratedAccounts.length, 1);
  assert.equal(result.unresolvedAccounts.length, 2);
  assert.equal(result.warnings.length, 2);
  assert.ok(result.migratedAccounts[0] instanceof Account);
});

test("migrateLegacyAccounts(): does not mutate the input array", () => {
  const legacyAccounts = [{ id: "a1", type: "bank", name: "Savings" }];
  const copy = JSON.parse(JSON.stringify(legacyAccounts));
  migrateLegacyAccounts(legacyAccounts);
  assert.deepEqual(legacyAccounts, copy);
});

test("migrateLegacyAccounts(): empty input produces empty result, not an error", () => {
  const result = migrateLegacyAccounts([]);
  assert.equal(result.migratedAccounts.length, 0);
  assert.equal(result.unresolvedAccounts.length, 0);
  assert.equal(result.warnings.length, 0);
});

// --- generateMigrationReport() — the three-scenario classification ---

test("generateMigrationReport(): Scenario A — everything migrates, no report noise", () => {
  const legacyAccounts = [
    { id: "a1", type: "bank", name: "Savings" },
    { id: "a2", type: "cash", name: "Wallet" },
  ];
  const report = generateMigrationReport(legacyAccounts);
  assert.equal(report.scenario, "A");
  assert.equal(report.totalAccounts, 2);
  assert.equal(report.migrated, 2);
  assert.equal(report.needsBehavior, 0);
  assert.equal(report.invalidData, 0);
});

test("generateMigrationReport(): Scenario B — only invalid data, no genuine ambiguity", () => {
  const legacyAccounts = [
    { id: "a1", type: "bank", name: "Savings" },
    { id: "a2", type: "debit", name: "Debit", linkedBank: null },
  ];
  const report = generateMigrationReport(legacyAccounts);
  assert.equal(report.scenario, "B");
  assert.equal(report.needsBehavior, 0);
  assert.equal(report.invalidData, 1);
});

test("generateMigrationReport(): Scenario C — genuine ambiguous classifications exist", () => {
  const legacyAccounts = [
    { id: "a1", type: "bank", name: "Savings" },
    { id: "a2", type: "crypto", name: "Binance", typeLabel: "Crypto" },
    { id: "a3", type: "bnpl", name: "Simpl", typeLabel: "BNPL" },
  ];
  const report = generateMigrationReport(legacyAccounts);
  assert.equal(report.scenario, "C");
  assert.equal(report.needsBehavior, 2);
  assert.deepEqual(report.needsBehaviorByClassification, { Crypto: 1, BNPL: 1 });
});

test("generateMigrationReport(): does not leak account id/name into the summary counts", () => {
  const legacyAccounts = [{ id: "secret-id-123", type: "crypto", name: "My Private Wallet", typeLabel: "Crypto" }];
  const report = generateMigrationReport(legacyAccounts);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("secret-id-123"), false);
  assert.equal(serialized.includes("My Private Wallet"), false);
});

