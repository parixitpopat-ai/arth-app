// src/domain/bills/prepaidUtilisation.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrepaidCoverage, getPrepaidHistory } from "./prepaidUtilisation.js";

function rechargeBill(overrides) {
  return { id: `b${Math.random()}`, billerCategory: "Mobile Prepaid", ...overrides };
}

test("getPrepaidCoverage: date-only strings are compared as LOCAL days, not shifted by UTC parsing (regression — found live in an Asia/Kolkata browser session)", () => {
  // validUntil is Sep 27; "today" is the local calendar day Sep 28 — one full day past expiry,
  // regardless of what timezone this test happens to run in. A UTC-parsed comparison
  // (`new Date("2026-09-27")` is UTC midnight, which in UTC+5:30 is still Sep 27 05:30 local towards
  // evening the previous day) previously misclassified this as still within the "expiring_soon"
  // window instead of expired.
  const today = new Date(2026, 8, 28); // Sep 28, local
  const bills = [rechargeBill({ validFrom: "2026-08-28", validUntil: "2026-09-27" })];
  const c = getPrepaidCoverage(bills, today);
  assert.equal(c.status, "expired", "one full local day past validUntil must read as expired, not expiring_soon");
  assert.equal(c.daysRemaining, -1);
});

test("getPrepaidCoverage: real validFrom+validUntil derives daysRemaining, totalDays, percentUsed — active status", () => {
  const today = new Date(2026, 7, 10); // Aug 10
  const bills = [rechargeBill({ validFrom: "2026-08-01", validUntil: "2026-08-31" })]; // 31-day period
  const c = getPrepaidCoverage(bills, today);
  assert.equal(c.daysRemaining, 21);
  assert.equal(c.totalDays, 31);
  assert.equal(c.status, "active");
  // 10 days elapsed (Aug 1 -> Aug 10 inclusive of start) of 31 -> round(10/31*100) = 32
  assert.equal(c.percentUsed, 32);
});

test("getPrepaidCoverage: expiring_soon within 7 days", () => {
  const today = new Date(2026, 7, 28);
  const bills = [rechargeBill({ validFrom: "2026-08-01", validUntil: "2026-08-31" })];
  const c = getPrepaidCoverage(bills, today);
  assert.equal(c.daysRemaining, 3);
  assert.equal(c.status, "expiring_soon");
});

test("getPrepaidCoverage: expired — negative daysRemaining, percentUsed capped at 100", () => {
  const today = new Date(2026, 8, 5); // Sep 5, past Aug 31
  const bills = [rechargeBill({ validFrom: "2026-08-01", validUntil: "2026-08-31" })];
  const c = getPrepaidCoverage(bills, today);
  assert.equal(c.status, "expired");
  assert.ok(c.daysRemaining < 0);
  assert.equal(c.percentUsed, 100, "never over 100% even though the period is long past");
});

test("getPrepaidCoverage: no validFrom on record — totalDays/percentUsed are null, never guessed", () => {
  const today = new Date(2026, 7, 10);
  const bills = [rechargeBill({ validFrom: null, validUntil: "2026-08-31" })];
  const c = getPrepaidCoverage(bills, today);
  assert.equal(c.totalDays, null);
  assert.equal(c.percentUsed, null);
  assert.ok(c.daysRemaining != null, "daysRemaining still derivable from validUntil alone");
});

test("getPrepaidCoverage: picks the most recent period (latest validFrom) when several exist", () => {
  const today = new Date(2026, 8, 5);
  const bills = [
    rechargeBill({ validFrom: "2026-07-01", validUntil: "2026-07-31" }),
    rechargeBill({ validFrom: "2026-09-01", validUntil: "2026-09-30" }),
  ];
  const c = getPrepaidCoverage(bills, today);
  assert.equal(c.validFrom, "2026-09-01");
});

test("getPrepaidCoverage: non-recharge bills and bills with no validUntil are ignored, never guessed", () => {
  const bills = [
    { billerCategory: "Electricity", validFrom: "2026-08-01", validUntil: "2026-08-31" },
    rechargeBill({ validFrom: "2026-08-01", validUntil: null }),
  ];
  assert.equal(getPrepaidCoverage(bills), null);
});

test("getPrepaidCoverage: no bills at all — null, not a fabricated empty period", () => {
  assert.equal(getPrepaidCoverage([]), null);
  assert.equal(getPrepaidCoverage(null), null);
});

test("getPrepaidHistory: real periods only, sorted most-recent-first, no gap-filling", () => {
  const bills = [
    rechargeBill({ id: "b1", validFrom: "2026-06-01", validUntil: "2026-06-30" }),
    rechargeBill({ id: "b2", validFrom: "2026-08-01", validUntil: "2026-08-31" }),
    rechargeBill({ id: "b3", validFrom: "2026-07-01", validUntil: "2026-07-31" }),
    { id: "b4", billerCategory: "Electricity", validFrom: "2026-07-15", validUntil: "2026-08-15" }, // not a recharge — excluded
    rechargeBill({ id: "b5", validFrom: "2026-05-01", validUntil: null }), // no real validUntil — excluded
  ];
  const history = getPrepaidHistory(bills);
  assert.deepEqual(history.map(b => b.id), ["b2", "b3", "b1"]);
});

test("getPrepaidHistory: empty/missing input is a safe empty array", () => {
  assert.deepEqual(getPrepaidHistory([]), []);
  assert.deepEqual(getPrepaidHistory(null), []);
});
