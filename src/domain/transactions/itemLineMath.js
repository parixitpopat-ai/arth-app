// domain/transactions/itemLineMath.js
//
// Payments v2 G1/G2 — Itemised quantity and price. Pure arithmetic for one Itemised line:
//   Total basis:     qty · ₹X total = ₹X           (the price typed IS the line amount)
//   Per-unit basis:  qty × ₹rate/unit = amount     (converting within g<->kg and ml<->ltr)
// plus the single reconciliation rule: the lines' sum must equal the transaction total. There is
// deliberately no plausibility check (e.g. 500 pcs x ₹200 is shown as calculated and is caught only
// by the sum).
//
// No new persisted field: a line is still {qty, unit, unitPrice, ...} and its amount is still
// qty * unitPrice (what every reader — rollup, vendor insights — already multiplies). A line entered
// on Total basis stores unitPrice = amount / qty; one entered per unit stores the equivalent
// unitPrice per entered unit (500 g at ₹400/kg -> unitPrice = ₹0.4/g). Basis is a UI choice only.

const TO_BASE = { g: 1, kg: 1000, ml: 1, ltr: 1000, l: 1000 };
const FAMILY = { g: "mass", kg: "mass", ml: "volume", ltr: "volume", l: "volume" };

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

/** Units a per-unit price can be quoted in for a quantity in `unit` (same family; otherwise just `unit`). */
export function rateUnitsFor(unit) {
  const fam = FAMILY[unit];
  if (!fam) return [unit];
  if (fam === "mass") return ["g", "kg"];
  return unit === "l" ? ["ml", "l"] : ["ml", "ltr"]; // "l" and "ltr" are the same unit spelled two ways in the app
}

/** The default "per ..." unit: the larger one of the family (500 g -> per kg), else the unit itself. */
export function defaultRateUnit(unit) {
  if (unit === "g") return "kg";
  if (unit === "ml") return "ltr";
  if (unit === "l" || unit === "ltr") return unit;
  return unit;
}

/**
 * @param {{basis:"total"|"unit", qty:number|string, unit:string, price:number|string, rateUnit?:string}} p
 * @returns {{amount:number, unitPrice:number}} amount (2dp) and the per-entered-unit price to store
 */
export function computeLine({ basis, qty, unit, price, rateUnit }) {
  const q = Number(qty) || 0;
  const pr = Number(price) || 0;
  if (basis === "unit") {
    const ru = rateUnit || unit;
    const factor = FAMILY[unit] && FAMILY[unit] === FAMILY[ru] ? TO_BASE[unit] / TO_BASE[ru] : 1;
    const amount = round2(q * factor * pr);
    return { amount, unitPrice: q > 0 ? amount / q : pr * factor };
  }
  const amount = round2(pr);
  return { amount, unitPrice: q > 0 ? amount / q : pr };
}

/** The line's calculation, always shown under it. `fmt` formats money (no symbol). */
export function describeLine({ basis, qty, unit, price, rateUnit }, sym, fmt) {
  const { amount } = computeLine({ basis, qty, unit, price, rateUnit });
  const q = Number(qty) || 0;
  if (basis === "unit") return `${q} ${unit} × ${sym}${fmt(Number(price) || 0)}/${rateUnit || unit} = ${sym}${fmt(amount)}`;
  return `${q} ${unit} · ${sym}${fmt(amount)} total = ${sym}${fmt(amount)}`;
}

/**
 * @returns {{matches:boolean, difference:number}} difference = transaction total − lines total
 *   (positive: money not on any line; negative: lines exceed the total)
 */
export function reconcileLines(lineAmounts, transactionTotal) {
  const sum = round2((lineAmounts || []).reduce((s, a) => s + (Number(a) || 0), 0));
  const difference = round2((Number(transactionTotal) || 0) - sum);
  return { matches: Math.abs(difference) < 0.005, difference, linesTotal: sum };
}
