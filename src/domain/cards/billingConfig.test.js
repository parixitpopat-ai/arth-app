import { test } from "node:test";
import assert from "node:assert/strict";
import { getEffectiveBillingConfig, migrateLegacyBillingHistory, getEarliestEligibleChangeDate, addBillingVersion } from "./billingConfig.js";

test("getEffectiveBillingConfig falls back to legacy fields when no history", () => {
  const account = { statementDate: 15, dueDate: 5, paymentAccId: "acc1" };
  const cfg = getEffectiveBillingConfig(account, "2026-06-01");
  assert.equal(cfg.statementDay, 15);
  assert.equal(cfg.dueDay, 5);
});

test("getEffectiveBillingConfig picks the latest version on/before the date", () => {
  const account = {
    billingHistory: [
      { effectiveFrom: "2000-01-01", statementDay: 15, dueDay: 5 },
      { effectiveFrom: "2026-09-16", statementDay: 20, dueDay: 10 },
    ],
  };
  assert.equal(getEffectiveBillingConfig(account, "2026-09-01").statementDay, 15);
  assert.equal(getEffectiveBillingConfig(account, "2026-09-16").statementDay, 20);
  assert.equal(getEffectiveBillingConfig(account, "2027-01-01").statementDay, 20);
});

test("migrateLegacyBillingHistory seeds v1 exactly from existing fields, once", () => {
  const account = { statementDate: 15, dueDate: 5, paymentAccId: "acc1" };
  const migrated = migrateLegacyBillingHistory(account);
  assert.equal(migrated.billingHistory.length, 1);
  assert.equal(migrated.billingHistory[0].statementDay, 15);
  const already = migrateLegacyBillingHistory(migrated);
  assert.equal(already, migrated); // no-op if already migrated
});

test("getEarliestEligibleChangeDate is null with no generated statements", () => {
  assert.equal(getEarliestEligibleChangeDate("card1", []), null);
});

test("getEarliestEligibleChangeDate is the day after the latest generated period", () => {
  const bills = [
    { isCcStatement: true, accId: "card1", periodTo: "2026-09-15" },
    { isCcStatement: true, accId: "card1", periodTo: "2026-08-15" },
  ];
  assert.equal(getEarliestEligibleChangeDate("card1", bills), "2026-09-16");
});

test("addBillingVersion rejects a change that lands inside an already-generated period", () => {
  const account = { id: "card1", statementDate: 15, dueDate: 5 };
  const bills = [{ isCcStatement: true, accId: "card1", periodTo: "2026-09-15" }];
  assert.throws(() => addBillingVersion(account, { effectiveFrom: "2026-09-01", statementDay: 20, dueDay: 10 }, bills));
});

test("addBillingVersion accepts a change from an eligible future date", () => {
  const account = { id: "card1", statementDate: 15, dueDate: 5 };
  const bills = [{ isCcStatement: true, accId: "card1", periodTo: "2026-09-15" }];
  const history = addBillingVersion(account, { effectiveFrom: "2026-09-16", statementDay: 20, dueDay: 10 }, bills);
  assert.equal(history.length, 2);
  assert.equal(history[1].statementDay, 20);
});
