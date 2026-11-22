// domain/investments/valuation.js
//
// Net worth for an investment = what it is worth now, not what was put in. For a holding (a folio or a stock) with a known number of
// units and a price per unit, value = units x price. Without both, the old figure stays (what was invested) and the holding is NOT marked as valued.
// Pure. Nothing here fetches a price: the price comes from the person (typed) or from a lookup that the app runs and passes in.
//
// Units, in order of trust:  1. units the person entered for the holding  2. worked out from the entries
//   mf     : each entry's amount / the NAV it was bought at (entries with no NAV are not counted, and the result says so)
//   stocks, gold (grams), crypto : each entry already holds its units / grams, so they are added up
// Price per unit: stocks per share, gold per gram, crypto per coin, mutual fund = NAV. Entered or looked up, with the date it is "as of".

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const r4 = n => Math.round((Number(n) || 0) * 10000) / 10000;
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const VALUED_TYPES = ["mf", "stocks", "gold", "crypto"];
export const STALE_AFTER_DAYS = 7;

const daysBetween = (a, b) => Math.round((new Date(String(b).slice(0, 10) + "T00:00:00Z") - new Date(String(a).slice(0, 10) + "T00:00:00Z")) / 86400000);

/** @param {string} type @param {Array<{amount?:number,lastNav?:number}>} items  entries of the holding (lastNav = the NAV bought at, or the units / grams, as the entry form stores it)
 *  @returns {{units:number, missing:number}} missing = entries that could not be turned into units */
export function deriveUnits(type, items) {
  const list = items || [];
  if (type === "mf") {
    let units = 0, missing = 0;
    for (const it of list) { const nav = num(it.lastNav), amt = num(it.amount); if (nav > 0 && amt > 0) units += amt / nav; else if (amt > 0) missing += 1; }
    return { units: r4(units), missing };
  }
  if (type === "stocks" || type === "gold" || type === "crypto") {
    let units = 0, missing = 0;
    for (const it of list) { const u = num(it.lastNav); if (u > 0) units += u; else if (num(it.amount) > 0) missing += 1; }
    return { units: r4(units), missing };
  }
  return { units: 0, missing: 0 };
}

/**
 * @param {{type:string, items:Array, invested:number}} holding
 * @param {{units?:number, price?:number, priceDate?:string}|undefined} saved  what the person / the lookup stored for this holding
 * @param {string} today  "YYYY-MM-DD"
 */
export function valueHolding(holding, saved, today) {
  const invested = r2(holding.invested);
  const derived = deriveUnits(holding.type, holding.items);
  const yours = num(saved && saved.units);
  const units = yours > 0 ? yours : derived.units;
  const unitsSource = yours > 0 ? "yours" : (derived.units > 0 ? "worked-out" : "none");
  const price = num(saved && saved.price);
  const priceDate = (saved && saved.priceDate) || "";
  const valued = VALUED_TYPES.includes(holding.type) && units > 0 && price > 0;
  const value = valued ? r2(units * price) : invested;
  const gain = valued ? r2(value - invested) : 0;
  const stale = valued && priceDate ? daysBetween(priceDate, today) > STALE_AFTER_DAYS : false;
  return { valued, value, invested, gain, gainPct: valued && invested > 0 ? Math.round((gain / invested) * 1000) / 10 : null, units, unitsSource, price, priceDate, stale, partialUnits: unitsSource === "worked-out" && derived.missing > 0, missingEntries: derived.missing };
}

/** Replaces each group's tracked total with its market value when it has one. Groups: {id,type,items,trackedTotal}. Returns new groups with `valuation` added. */
export function applyValuations(groups, store, today) {
  return (groups || []).map(g => {
    if (!VALUED_TYPES.includes(g.type) || !g.items || !g.items.length) return g;
    const v = valueHolding({ type: g.type, items: g.items, invested: g.trackedTotal }, (store || {})[g.id], today);
    return { ...g, valuation: v, trackedTotal: v.valued ? v.value : g.trackedTotal };
  });
}

/** Totals for the Invest screen. */
export function summariseValuations(groups) {
  let invested = 0, value = 0, valuedCount = 0, total = 0;
  for (const g of groups || []) {
    if (!g.valuation) continue; total += 1;
    invested += g.valuation.invested; value += g.valuation.value;
    if (g.valuation.valued) valuedCount += 1;
  }
  return { invested: r2(invested), value: r2(value), gain: r2(value - invested), valuedCount, holdings: total };
}
