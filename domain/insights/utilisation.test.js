// domain/insights/utilisation.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrepaidUtilisation, getMembershipUtilisation } from "./utilisation.js";

const ACCOUNTS = [{ id: "ba1", name: "Jio Prepaid", type: "Mobile Prepaid" }];

test("getPrepaidUtilisation: computes real days-remaining from validUntil, status active", () => {
  const today = new Date(2026, 7, 10); // Aug 10, 2026
  const bills = [{ billerAccountId: "ba1", billerCategory: "Mobile Prepaid", validFrom: "2026-08-01", validUntil: "2026-08-31" }];
  const rows = getPrepaidUtilisation(bills, ACCOUNTS, today);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].billerAccount.id, "ba1");
  assert.equal(rows[0].daysRemaining, 21);
  assert.equal(rows[0].status, "active");
});

test("getPrepaidUtilisation: expiring_soon within 7 days", () => {
  const today = new Date(2026, 7, 28); // Aug 28
  const bills = [{ billerAccountId: "ba1", billerCategory: "Mobile Prepaid", validFrom: "2026-08-01", validUntil: "2026-08-31" }];
  const rows = getPrepaidUtilisation(bills, ACCOUNTS, today);
  assert.equal(rows[0].daysRemaining, 3);
  assert.equal(rows[0].status, "expiring_soon");
});

test("getPrepaidUtilisation: expired — negative days remaining", () => {
  const today = new Date(2026, 8, 5); // Sep 5, past Aug 31 expiry
  const bills = [{ billerAccountId: "ba1", billerCategory: "Mobile Prepaid", validFrom: "2026-08-01", validUntil: "2026-08-31" }];
  const rows = getPrepaidUtilisation(bills, ACCOUNTS, today);
  assert.equal(rows[0].status, "expired");
  assert.ok(rows[0].daysRemaining < 0);
});

test("getPrepaidUtilisation: picks the most recent period (latest validFrom) when multiple exist", () => {
  const today = new Date(2026, 8, 5);
  const bills = [
    { billerAccountId: "ba1", billerCategory: "Mobile Prepaid", validFrom: "2026-07-01", validUntil: "2026-07-31" },
    { billerAccountId: "ba1", billerCategory: "Mobile Prepaid", validFrom: "2026-09-01", validUntil: "2026-09-30" },
  ];
  const rows = getPrepaidUtilisation(bills, ACCOUNTS, today);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].validFrom, "2026-09-01", "the later period wins, not the first one found");
});

test("getPrepaidUtilisation: non-recharge billers and bills with no validUntil are omitted, never guessed", () => {
  const today = new Date(2026, 7, 10);
  const bills = [
    { billerAccountId: "ba1", billerCategory: "Electricity", validFrom: "2026-08-01", validUntil: "2026-08-31" }, // not a recharge type
    { billerAccountId: "ba1", billerCategory: "Mobile Prepaid", validFrom: "2026-08-01", validUntil: null }, // no real validUntil
  ];
  assert.deepEqual(getPrepaidUtilisation(bills, ACCOUNTS, today), []);
});

test("getPrepaidUtilisation: empty input is a safe empty array", () => {
  assert.deepEqual(getPrepaidUtilisation([], ACCOUNTS), []);
  assert.deepEqual(getPrepaidUtilisation(null, ACCOUNTS), []);
});

test("getMembershipUtilisation: re-exports getCostPerVisit unchanged", () => {
  const checkIns = [{ relationshipId: "r1", attended: true }, { relationshipId: "r1", attended: true }, { relationshipId: "r1", attended: false }];
  assert.equal(getMembershipUtilisation(checkIns, "r1", 2000), 1000, "2000 lifetime spend / 2 attended visits = 1000/visit");
});
