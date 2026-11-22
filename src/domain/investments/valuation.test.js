import test from "node:test";
import assert from "node:assert/strict";
import { deriveUnits, valueHolding, applyValuations, summariseValuations } from "./valuation.js";

const mf = [{ amount: 5000, lastNav: 50 }, { amount: 5000, lastNav: 40 }];   // 100 + 125 = 225 units
test("mutual fund units are worked out from each entry's amount and the NAV it was bought at", () => {
  assert.deepEqual(deriveUnits("mf", mf), { units: 225, missing: 0 });
  assert.deepEqual(deriveUnits("mf", [...mf, { amount: 1000, lastNav: 0 }]), { units: 225, missing: 1 });   // an entry without a NAV is not guessed
});
test("stocks, gold and crypto add up the units / grams each entry holds", () => {
  assert.deepEqual(deriveUnits("stocks", [{ amount: 1000, lastNav: 10 }, { amount: 500, lastNav: 4 }]), { units: 14, missing: 0 });
  assert.deepEqual(deriveUnits("gold", [{ amount: 60000, lastNav: 10 }]), { units: 10, missing: 0 });
  assert.deepEqual(deriveUnits("fd", [{ amount: 1000, lastNav: 3 }]), { units: 0, missing: 0 });
});
test("with units and a price the value is units x price, and the gain is against what was invested", () => {
  const v = valueHolding({ type: "mf", items: mf, invested: 10000 }, { price: 60, priceDate: "2026-11-20" }, "2026-11-22");
  assert.equal(v.valued, true); assert.equal(v.value, 13500); assert.equal(v.gain, 3500); assert.equal(v.gainPct, 35); assert.equal(v.units, 225); assert.equal(v.unitsSource, "worked-out"); assert.equal(v.stale, false);
});
test("units the person entered win over worked-out units; no price means not valued and the invested figure stays", () => {
  assert.equal(valueHolding({ type: "mf", items: mf, invested: 10000 }, { units: 200, price: 60, priceDate: "2026-11-22" }, "2026-11-22").value, 12000);
  const none = valueHolding({ type: "mf", items: mf, invested: 10000 }, undefined, "2026-11-22");
  assert.deepEqual([none.valued, none.value, none.gain], [false, 10000, 0]);
  assert.equal(valueHolding({ type: "mf", items: [{ amount: 1000, lastNav: 0 }], invested: 1000 }, { price: 60 }, "2026-11-22").valued, false);   // no units at all
});
test("a price older than 7 days is stale; entries missing a NAV make worked-out units partial; types without a price (FD, PPF) are never valued", () => {
  assert.equal(valueHolding({ type: "mf", items: mf, invested: 10000 }, { price: 60, priceDate: "2026-11-10" }, "2026-11-22").stale, true);
  const p = valueHolding({ type: "mf", items: [...mf, { amount: 1000, lastNav: 0 }], invested: 11000 }, { price: 60, priceDate: "2026-11-22" }, "2026-11-22");
  assert.equal(p.partialUnits, true); assert.equal(p.missingEntries, 1);
  assert.equal(valueHolding({ type: "fd", items: [{ amount: 1000, lastNav: 2 }], invested: 1000 }, { price: 9, units: 5 }, "2026-11-22").valued, false);
});
test("applyValuations swaps the group total for its market value, leaves others alone, and totals add up", () => {
  const groups = [{ id: "mf|folio|1", type: "mf", items: mf, trackedTotal: 10000 }, { id: "fd|name|x", type: "fd", items: [{ amount: 500 }], trackedTotal: 500 }, { id: "mf|name|y", type: "mf", items: mf, trackedTotal: 10000 }];
  const out = applyValuations(groups, { "mf|folio|1": { price: 60, priceDate: "2026-11-22" } }, "2026-11-22");
  assert.deepEqual(out.map(g => g.trackedTotal), [13500, 500, 10000]);
  assert.equal(out[1].valuation, undefined);
  const s = summariseValuations(out); assert.deepEqual([s.invested, s.value, s.gain, s.valuedCount, s.holdings], [20000, 23500, 3500, 1, 2]);
  assert.deepEqual(applyValuations(undefined, undefined, "2026-11-22"), []);
});
