// domain/insights/providers.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { getProviderSpendBreakdown } from "./providers.js";

const ACCOUNTS = [
  { id: "ba1", name: "Airtel Postpaid", type: "Mobile Postpaid" },
  { id: "ba2", name: "Electricity Board", type: "Electricity" },
];

test("getProviderSpendBreakdown: sums paid bills by billerAccountId within the period, refund-netted", () => {
  const bills = [
    { id: "b1", billerAccountId: "ba1", status: "paid", paidDate: "2026-08-05", amount: 500 },
    { id: "b2", billerAccountId: "ba1", status: "paid", paidDate: "2026-08-20", amount: 300 },
    { id: "b3", billerAccountId: "ba2", status: "paid", paidDate: "2026-08-10", amount: 1200 },
    { id: "b4", billerAccountId: "ba2", status: "unpaid", paidDate: null, amount: 1200 }, // excluded — not paid
    { id: "b5", billerAccountId: "ba1", status: "paid", paidDate: "2026-07-01", amount: 999 }, // excluded — different month
  ];
  const rows = getProviderSpendBreakdown(bills, ACCOUNTS, "2026-08");
  assert.equal(rows.length, 2);
  const ba1Row = rows.find(r => r.billerAccount.id === "ba1");
  const ba2Row = rows.find(r => r.billerAccount.id === "ba2");
  assert.equal(ba1Row.total, 800, "500 + 300 = 800; the July bill (b5) must not leak in");
  assert.equal(ba1Row.count, 2);
  assert.equal(ba2Row.total, 1200, "only b3 counts — b4 is unpaid, excluded");
  assert.equal(ba2Row.count, 1);
});

test("getProviderSpendBreakdown: sorts descending by total", () => {
  const bills = [
    { id: "b1", billerAccountId: "ba1", status: "paid", paidDate: "2026-08-05", amount: 500 },
    { id: "b2", billerAccountId: "ba2", status: "paid", paidDate: "2026-08-10", amount: 1200 },
  ];
  const rows = getProviderSpendBreakdown(bills, ACCOUNTS, "2026-08");
  assert.equal(rows[0].billerAccount.id, "ba2");
  assert.equal(rows[0].total, 1200);
  assert.equal(rows[1].billerAccount.id, "ba1");
});

test("getProviderSpendBreakdown: refund nets the total via refundTotalsByBill", () => {
  const bills = [{ id: "b1", billerAccountId: "ba1", status: "paid", paidDate: "2026-08-05", amount: 1000 }];
  const rows = getProviderSpendBreakdown(bills, ACCOUNTS, "2026-08", { b1: 400 });
  assert.equal(rows[0].total, 600, "1000 - 400 refund = 600");
});

test("getProviderSpendBreakdown: a bill with no billerAccountId or unresolved account is omitted, not fabricated", () => {
  const bills = [
    { id: "b1", billerAccountId: null, status: "paid", paidDate: "2026-08-05", amount: 500 },
    { id: "b2", billerAccountId: "ba_unknown", status: "paid", paidDate: "2026-08-05", amount: 500 },
  ];
  assert.deepEqual(getProviderSpendBreakdown(bills, ACCOUNTS, "2026-08"), []);
});

test("getProviderSpendBreakdown: empty bills is a safe empty array", () => {
  assert.deepEqual(getProviderSpendBreakdown([], ACCOUNTS, "2026-08"), []);
  assert.deepEqual(getProviderSpendBreakdown(null, ACCOUNTS, "2026-08"), []);
});
