import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getFineBucketKey,
  getVehicleLinkedTxns,
  splitTxnByFineBucket,
  getVehicleRunningCostBuckets,
  getVehicleTCO,
  getVehicleStatusTiles,
  getVehicleRecentTxns,
  getVehicleTxnsByMonth,
  getVehicleFuelSummary,
  getVehicleMaintenanceSummary,
  getVehicleInsuranceSummary,
  getVehicleReceipts,
  getUntaggedVehicleCandidates,
} from "./vehicleFinancials.js";

const v = { id: "veh1", type: "car", number: "KA 05 MX 4412" };

test("getFineBucketKey maps known Transport subcategories, defaults unknowns to other", () => {
  assert.equal(getFineBucketKey("t1"), "fuel");
  assert.equal(getFineBucketKey("t6"), "service");
  assert.equal(getFineBucketKey("t5"), "insurance");
  assert.equal(getFineBucketKey("t8"), "puc");
  assert.equal(getFineBucketKey("t7"), "tolls");
  assert.equal(getFineBucketKey("t4"), "emi");
  assert.equal(getFineBucketKey("t9"), "challan");
  assert.equal(getFineBucketKey("t2"), "other");
  assert.equal(getFineBucketKey(null), "other");
});

test("getVehicleLinkedTxns only returns transactions matching this vehicle's id", () => {
  const txns = [{ id: 1, vehicleId: "veh1" }, { id: 2, vehicleId: "veh2" }, { id: 3 }];
  assert.deepEqual(getVehicleLinkedTxns(v, txns).map(t => t.id), [1]);
  assert.deepEqual(getVehicleLinkedTxns({}, txns), []);
});

test("splitTxnByFineBucket uses the transaction's own subcategory for a standard expense", () => {
  const t = { amount: 2010, subIds: ["t1"] };
  assert.deepEqual(splitTxnByFineBucket(t), [{ bucketKey: "fuel", amount: 2010 }]);
});

test("splitTxnByFineBucket splits an itemised transaction per line item's own subcategory", () => {
  const t = { lineItems: [
    { qty: 1, unitPrice: 6400, subId: "t6" },
    { qty: 2, unitPrice: 60, subId: "t8" },
  ] };
  const parts = splitTxnByFineBucket(t);
  assert.deepEqual(parts, [
    { bucketKey: "service", amount: 6400 },
    { bucketKey: "puc", amount: 120 },
  ]);
});

test("getVehicleRunningCostBuckets omits empty buckets rather than showing ₹0, and sums correctly", () => {
  const txns = [
    { vehicleId: "veh1", date: "2026-09-21", amount: 2010, subIds: ["t1"] },
    { vehicleId: "veh1", date: "2026-09-09", amount: 1500, subIds: ["t1"] },
    { vehicleId: "veh1", date: "2026-06-12", amount: 6400, subIds: ["t6"] },
  ];
  const { total, count, buckets } = getVehicleRunningCostBuckets(v, txns);
  assert.equal(total, 9910);
  assert.equal(count, 3);
  assert.deepEqual(buckets.map(b => b.key), ["service", "fuel"]); // sorted by amount desc
  assert.equal(buckets.find(b => b.key === "insurance"), undefined); // never a ₹0 row
});

test("getVehicleTCO excludes purchase value until it exists, and says so explicitly", () => {
  const txns = [{ vehicleId: "veh1", amount: 1000 }];
  const withoutPurchase = getVehicleTCO(v, txns);
  assert.equal(withoutPurchase.total, 1000);
  assert.equal(withoutPurchase.purchaseValueIncluded, false);

  const withPurchase = getVehicleTCO({ ...v, purchaseValue: 500000 }, txns);
  assert.equal(withPurchase.total, 501000);
  assert.equal(withPurchase.purchaseValueIncluded, true);
});

test("getVehicleStatusTiles reports 'none' rather than fabricating a value when nothing is linked", () => {
  const tiles = getVehicleStatusTiles(v, []);
  assert.deepEqual(tiles.map(t => t.val.kind), ["none", "none", "none", "none"]);
});

test("getVehicleStatusTiles picks the most recent transaction per bucket", () => {
  const txns = [
    { vehicleId: "veh1", date: "2026-06-12", amount: 6400, subIds: ["t6"] },
    { vehicleId: "veh1", date: "2026-01-14", amount: 2200, subIds: ["t6"] },
  ];
  const tiles = getVehicleStatusTiles(v, txns);
  const service = tiles.find(t => t.key === "service");
  assert.equal(service.val.date, "2026-06-12");
  assert.equal(service.val.amount, 6400);
});

test("getVehicleRecentTxns sorts newest first and respects the limit", () => {
  const txns = [
    { vehicleId: "veh1", date: "2026-08-01", id: "a" },
    { vehicleId: "veh1", date: "2026-09-21", id: "b" },
    { vehicleId: "veh1", date: "2026-09-09", id: "c" },
  ];
  assert.deepEqual(getVehicleRecentTxns(v, txns, 2).map(t => t.id), ["b", "c"]);
});

test("getVehicleTxnsByMonth groups by calendar month, newest month first, with per-group totals", () => {
  const txns = [
    { vehicleId: "veh1", date: "2026-09-21", amount: 2010 },
    { vehicleId: "veh1", date: "2026-09-09", amount: 1500 },
    { vehicleId: "veh1", date: "2026-08-30", amount: 640 },
  ];
  const groups = getVehicleTxnsByMonth(v, txns);
  assert.deepEqual(groups.map(g => g.key), ["2026-09", "2026-08"]);
  assert.equal(groups[0].total, 3510);
  assert.equal(groups[0].rows.length, 2);
});

test("getVehicleFuelSummary computes this-month, 12-month and a 6-month average over months with spend only", () => {
  const today = new Date("2026-09-25");
  const txns = [
    { vehicleId: "veh1", date: "2026-09-21", amount: 2010, subIds: ["t1"] },
    { vehicleId: "veh1", date: "2026-09-09", amount: 1500, subIds: ["t1"] },
    { vehicleId: "veh1", date: "2026-04-05", amount: 1000, subIds: ["t1"] }, // April is 5 months back — inside the window
  ];
  const s = getVehicleFuelSummary(v, txns, { today });
  assert.equal(s.thisMonth.amt, 3510);
  assert.equal(s.thisMonth.count, 2);
  assert.equal(s.byMonth.length, 6);
  assert.equal(s.byMonth[5].key, "2026-09");
  assert.equal(s.byMonth[0].key, "2026-04");
  // Two months had spend (April 1000, September 3510) → average divides by 2, not by 6.
  assert.equal(s.sixMonthAvg, (1000 + 3510) / 2);
});

test("getVehicleMaintenanceSummary pulls service, PUC and challan rows, newest first", () => {
  const txns = [
    { vehicleId: "veh1", date: "2026-06-12", amount: 6400, subIds: ["t6"] },
    { vehicleId: "veh1", date: "2026-03-03", amount: 120, subIds: ["t8"] },
    { vehicleId: "veh1", date: "2026-09-01", amount: 500, subIds: ["t9"] },
  ];
  const s = getVehicleMaintenanceSummary(v, txns);
  assert.equal(s.rows.length, 3);
  assert.equal(s.rows[0].bucketKey, "challan"); // newest date first
  assert.equal(s.lastService.date, "2026-06-12");
  assert.equal(s.total, 7020);
});

test("getVehicleInsuranceSummary pulls only Insurance-bucket rows", () => {
  const txns = [
    { vehicleId: "veh1", date: "2025-11-14", amount: 11200, subIds: ["t5"] },
    { vehicleId: "veh1", date: "2026-06-12", amount: 6400, subIds: ["t6"] },
  ];
  const s = getVehicleInsuranceSummary(v, txns);
  assert.equal(s.rows.length, 1);
  assert.equal(s.total, 11200);
});

test("getVehicleReceipts reads existing per-transaction attachments, never a separate document store", () => {
  const txns = [
    { vehicleId: "veh1", date: "2026-06-12", amount: 6400, imageBase64: "data:x" },
    { vehicleId: "veh1", date: "2025-11-14", amount: 11200, paymentImageBase64: "data:y" },
    { vehicleId: "veh1", date: "2026-01-01", amount: 100 },
  ];
  const receipts = getVehicleReceipts(v, txns);
  assert.equal(receipts.length, 2);
  assert.equal(receipts[0].date, "2026-06-12"); // newest first
});

test("getUntaggedVehicleCandidates finds Transport-category expenses with no vehicle, within the window", () => {
  const today = new Date("2026-09-25");
  const txns = [
    { id: "a", type: "expense", date: "2026-09-01", catIds: ["transport"], subIds: ["t1"] },
    { id: "b", type: "expense", date: "2026-09-01", catIds: ["transport"], subIds: ["t1"], vehicleId: "veh1" }, // already linked
    { id: "c", type: "expense", date: "2026-01-01", catIds: ["transport"], subIds: ["t1"] }, // outside window
    { id: "d", type: "expense", date: "2026-09-01", catIds: ["groceries"] }, // wrong category
  ];
  const all = getUntaggedVehicleCandidates(txns, { today });
  assert.deepEqual(all.map(t => t.id), ["a"]);
});

test("getUntaggedVehicleCandidates narrows to one subcategory when asked", () => {
  const today = new Date("2026-09-25");
  const txns = [
    { id: "fuel", type: "expense", date: "2026-09-01", catIds: ["transport"], subIds: ["t1"] },
    { id: "toll", type: "expense", date: "2026-09-01", catIds: ["transport"], subIds: ["t7"] },
  ];
  const fuelOnly = getUntaggedVehicleCandidates(txns, { today, subId: "t1" });
  assert.deepEqual(fuelOnly.map(t => t.id), ["fuel"]);
});
