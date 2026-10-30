import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFill, validateFill, buildFuelHistory, fuelSummary, fillsForVehicle } from "./fuelFills.js";

const F = (id, date, odometer, litres, amount, full = true, vehicleId = "v1") => ({ id, vehicleId, date, odometer, litres, amount, full });
const TODAY = "2026-10-23";
// A baseline full tank, a partial top-up, a full tank (12.5 km/L), another full tank (16 km/L)
const SET = [F("a", "2026-01-01", 1000, 30, 3000), F("b", "2026-01-10", 1300, 20, 2000, false), F("c", "2026-01-20", 1500, 20, 2000), F("d", "2026-02-01", 1900, 25, 2750)];

test("tank-to-tank km/L and cost per km, with a partial fill between two full ones", () => {
  const h = buildFuelHistory(SET);
  assert.equal(h[0].kmpl, null); assert.equal(h[1].kmpl, null, "a partial fill closes nothing");
  assert.deepEqual(h[2].tank, { distance: 500, litres: 40, cost: 4000 }); assert.equal(h[2].kmpl, 12.5); assert.equal(h[2].costPerKm, 8);
  assert.deepEqual(h[3].tank, { distance: 400, litres: 25, cost: 2750 }); assert.equal(h[3].kmpl, 16); assert.equal(h[3].costPerKm, 6.88);   // 6.875 rounds half up to 6.88
  assert.deepEqual(h.map(r => r.distanceSincePrev), [null, 300, 200, 400]);
  assert.deepEqual(h.map(r => r.pricePerL), [100, 100, 100, 110]);
});

test("summary is distance-weighted, not an average of averages", () => {
  const s = fuelSummary(SET);
  assert.equal(s.avgKmpl, 13.85);               // 900 km / 65 L, not (12.5 + 16) / 2 = 14.25
  assert.equal(s.fuelCostPerKm, 7.5);           // 6750 / 900
  assert.equal(s.lastKmpl, 16); assert.equal(s.latestOdometer, 1900); assert.equal(s.totalKm, 900); assert.equal(s.intervals, 2); assert.equal(s.lastPricePerL, 110);
  assert.equal(s.needsFullFills, false);
});

test("not enough full fills: no efficiency is invented", () => {
  assert.equal(fuelSummary([]).needsFullFills, true);
  const one = fuelSummary([F("a", "2026-01-01", 1000, 30, 3000)]); assert.equal(one.avgKmpl, null); assert.equal(one.needsFullFills, true); assert.equal(one.latestOdometer, 1000); assert.equal(one.totalKm, null);
  const partialFirst = fuelSummary([F("a", "2026-01-01", 1000, 10, 1000, false), F("b", "2026-01-05", 1100, 10, 1000, false)]);
  assert.equal(partialFirst.avgKmpl, null); assert.equal(partialFirst.totalKm, 100);
  // a partial fill BEFORE the first full fill does not count toward the first interval
  const h = buildFuelHistory([F("p", "2026-01-01", 900, 5, 500, false), F("a", "2026-01-02", 1000, 30, 3000), F("c", "2026-01-20", 1400, 40, 4000)]);
  assert.equal(h[2].kmpl, 10); assert.equal(h[2].tank.litres, 40);
});

test("a fill with no amount still gives km/L but never an invented cost", () => {
  const h = buildFuelHistory([F("a", "2026-01-01", 1000, 30, 3000), F("b", "2026-01-10", 1300, 20, null, false), F("c", "2026-01-20", 1500, 20, 2000)]);
  assert.equal(h[2].kmpl, 12.5); assert.equal(h[2].costPerKm, null); assert.equal(h[2].tank.cost, null);
  assert.equal(fuelSummary([F("a", "2026-01-01", 1000, 30, 3000), F("c", "2026-01-20", 1500, 40, null)]).fuelCostPerKm, null);
});

test("order does not depend on the order they were entered; other vehicles are ignored", () => {
  const shuffled = [SET[3], SET[0], F("x", "2026-01-05", 99999, 10, 1, true, "v2"), SET[2], SET[1]];
  assert.deepEqual(fillsForVehicle(shuffled, "v1").map(f => f.id), ["a", "b", "c", "d"]);
  assert.equal(fuelSummary(fillsForVehicle(shuffled, "v1")).avgKmpl, 13.85);
});

test("implausible km/L is flagged but still shown", () => {
  const h = buildFuelHistory([F("a", "2026-01-01", 1000, 30, 0), F("b", "2026-01-02", 1900, 3, 0)]);
  assert.equal(h[1].kmpl, 300); assert.equal(h[1].suspect, true);
});

test("validation: required fields, bounds, future dates, whole kilometres", () => {
  const ok = c => validateFill(SET, c, { today: TODAY });
  assert.equal(ok(F(undefined, "2026-03-01", 2300, 30, 3000)).ok, true);
  assert.equal(ok(F(undefined, "2026-03-01", "", 30, 3000)).errors.odometer !== undefined, true);
  assert.equal(ok(F(undefined, "2026-03-01", 2300, 0, 3000)).errors.litres !== undefined, true);
  assert.equal(ok(F(undefined, "2026-03-01", 2300, 600, 3000)).errors.litres !== undefined, true);
  assert.equal(ok(F(undefined, "2026-03-01", 2300.5, 30, 3000)).errors.odometer !== undefined, true);
  assert.equal(ok(F(undefined, "2026-03-01", 2300, 30, -5)).errors.amount !== undefined, true);
  assert.equal(ok(F(undefined, "2026-13-40", 2300, 30, 3000)).errors.date !== undefined, true);
  assert.equal(ok(F(undefined, "2026-10-24", 2300, 30, 3000)).errors.date, "The date can't be in the future.");
  assert.equal(ok(F(undefined, "2026-03-01", 2300, 30, null)).ok, true, "amount is optional");
  assert.equal(ok({ ...F(undefined, "2026-03-01", 2300, 30, 3000), vehicleId: "" }).errors.vehicleId !== undefined, true);
});

test("validation: the odometer must rise with the date, against both neighbours", () => {
  const ok = c => validateFill(SET, c, { today: TODAY });
  assert.match(ok(F(undefined, "2026-03-01", 1900, 30, 1)).errors.odometer, /higher than the previous reading \(1900 km on 2026-02-01\)/);
  assert.match(ok(F(undefined, "2026-03-01", 1500, 30, 1)).errors.odometer, /higher than the previous/);
  assert.equal(ok(F(undefined, "2026-01-15", 1400, 20, 1)).ok, true, "in between b and c");
  assert.match(ok(F(undefined, "2026-01-15", 1600, 20, 1)).errors.odometer, /lower than the next reading \(1500 km on 2026-01-20\)/);
  assert.match(ok(F(undefined, "2026-01-15", 1250, 20, 1)).errors.odometer, /higher than the previous reading \(1300 km/);
  assert.equal(ok(F(undefined, "2025-12-01", 500, 20, 1)).ok, true, "before everything");
});

test("validation: editing a fill is judged against its neighbours, not against itself; an exact repeat is a duplicate; a big jump only warns", () => {
  assert.equal(validateFill(SET, { ...SET[2], odometer: 1550 }, { today: TODAY }).ok, true, "c may move between b (1300) and d (1900)");
  assert.equal(validateFill(SET, { ...SET[2], odometer: 1950 }, { today: TODAY }).ok, false, "but not past d");
  const dup = validateFill(SET, F(undefined, "2026-02-01", 1900, 25, 2750), { today: TODAY });
  assert.equal(dup.ok, false); assert.match(dup.errors.odometer, /duplicate/);
  const jump = validateFill(SET, F(undefined, "2026-03-01", 6000, 30, 1), { today: TODAY });
  assert.equal(jump.ok, true); assert.equal(jump.warnings.length, 1);
});

test("editing or deleting a fill recomputes its neighbours; deleting the baseline full fill moves the baseline", () => {
  const without = (id) => SET.filter(f => f.id !== id);
  const noB = buildFuelHistory(without("b"));        // the partial top-up is gone: c is now 500 km on 20 L
  assert.equal(noB[1].kmpl, 25);
  const noA = buildFuelHistory(without("a"));         // b (partial) now comes first; c is the first full fill; d is its only interval
  assert.equal(noA[1].kmpl, null); assert.equal(noA[2].kmpl, 16);
});

test("today is the person's own calendar date, not UTC (a date string is taken as given)", () => {
  const lateNightIst = new Date(2026, 9, 24, 0, 30);            // 24 Oct, 00:30 on the local clock
  assert.equal(validateFill(SET, F(undefined, "2026-10-24", 2300, 30, 3000), { today: lateNightIst }).ok, true);
  assert.equal(validateFill(SET, F(undefined, "2026-10-25", 2300, 30, 3000), { today: lateNightIst }).ok, false);
});

test("normalizeFill coerces form text and keeps top-ups as top-ups", () => {
  const n = normalizeFill({ vehicleId: 7, date: " 2026-03-01 ", odometer: "2300", litres: "30.5", amount: "", full: false, note: "  Shell  " });
  assert.deepEqual(n, { id: undefined, vehicleId: "7", date: "2026-03-01", odometer: 2300, litres: 30.5, amount: null, full: false, note: "Shell" });
  assert.equal(normalizeFill({ odometer: 1, litres: 1 }).full, true);
});

test("refuels are part of the synced snapshot and the restore path (otherwise they would not sync, back up or restore)", async () => {
  const fs = await import("node:fs");
  const app = fs.readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
  assert.match(app, /\n\s+fuelFills,\n/, "fuelFills is in the snapshot object");
  assert.match(app, /if\(Array\.isArray\(snapshot\.fuelFills\)\) setFuelFills\(snapshot\.fuelFills\)/, "and restored from it");
  const owner = await import("../../sync/tabOwnership.js"), user = await import("../../sync/userData.js");
  assert.ok(owner.DATA_KEYS.includes("arth_fuel_fills"), "and registered as synced data");
  assert.equal(user.hasUserData({ fuelFills: [{ id: "x" }] }), true, "and counts as user data (ownership and sync decisions)");
});

// ---- odometer entered on the FUEL EXPENSE (the refuel is linked to it by txnId) ----
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

test("a refuel keeps the id of the expense it was entered on; a fill with no expense has none", () => {
  assert.equal(normalizeFill({ ...F("x", "2026-03-01", 2000, 10, 1000), txnId: 1793371508954 }).txnId, "1793371508954");
  assert.equal("txnId" in normalizeFill(F("x", "2026-03-01", 2000, 10, 1000)), false);
  assert.equal("txnId" in normalizeFill({ ...F("x", "2026-03-01", 2000, 10, 1000), txnId: "" }), false);
});

test("re-checking a linked refuel after its expense is edited never counts the refuel against itself", () => {
  const all = [...SET, { ...F("e", "2026-03-01", 2100, 20, 2000), txnId: "t9" }];
  const v = validateFill(all, { ...F("e", "2026-03-01", 2100, 20, 2500), txnId: "t9" }, { today: "2026-10-23" });
  assert.equal(v.ok, true);                                                            // same row, new amount: not a duplicate of itself
  assert.equal(validateFill(all, { ...F(undefined, "2026-03-01", 2100, 20, 2500) }, { today: "2026-10-23" }).ok, false);   // the same fill as a NEW one is a duplicate
});

test("the fuel expense form: odometer fields only for a Fuel sub-category with a vehicle; edit and delete keep the refuel in step", () => {
  const app = readFileSync(fileURLToPath(new URL("../../App.jsx", import.meta.url)), "utf8");
  assert.match(app, /const isFuelSub = sid => \/\^fuel\$\/i\.test\(/);
  assert.match(app, /const showFuelFields = txnType==="expense" && validCatIds\.includes\("transport"\) && Boolean\(vehicleId\) && validSubIds\.some\(isFuelSub\)/);
  assert.match(app, /const isFuelExpense = txnType==="expense" && effectiveCatIds\.includes\("transport"\) && Boolean\(newTxn\.vehicleId\) && validSubIds\.some\(isFuelSub\)/);
  assert.match(app, /validateFill\(fuelFills, candidate\)/);                                       // the same odometer checks as the Add refuel sheet
  assert.match(app, /Expense saved\. Refuel not added:/);                                          // a bad reading never blocks the expense
  assert.match(app, /setFuelFills\(prev=>prev\.some\(f=>f\.txnId!=null && String\(f\.txnId\)===String\(txn\.id\)\)/);   // deleting the expense removes its refuel
  assert.match(app, /existingFill \? prev\.map\(f=>String\(f\.id\)===String\(existingFill\.id\)/);   // editing updates the same refuel
});
