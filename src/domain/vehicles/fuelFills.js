// src/domain/vehicles/fuelFills.js
//
// Odometer capture at every refuelling: mileage history, fuel efficiency (km/L) and fuel cost per kilometre.
// Pure functions only (no storage, no clock unless passed in). A "fill" is:
//   { id, vehicleId, date: "YYYY-MM-DD", odometer: km, litres, amount: ₹ | null, full: boolean, note?: string }
//
// Efficiency uses the standard TANK-TO-TANK method, because a single fill-up says nothing about consumption by itself:
//   for a FULL-tank fill that follows an earlier FULL-tank fill,
//     distance = odometer(this) - odometer(previous full fill)
//     fuel     = litres of this fill + litres of every partial fill in between   (the previous full fill's own litres are NOT counted)
//     km/L     = distance / fuel          cost per km = (amounts of the same fills) / distance
// Partial fills before the first full fill, and fills with an unknown amount (for cost only), never invent numbers: the figure is
// simply not shown ("needs two full-tank fill-ups"). Nothing here touches transactions or money records.

export const FILL_LIMITS = Object.freeze({ maxOdometer: 5_000_000, maxLitres: 500, maxAmount: 10_000_000, bigJumpKm: 3000 });

const isIsoDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const num = v => (v === "" || v === null || v === undefined ? NaN : Number(v));
/** The calendar date on the person's own clock (not UTC: shortly after midnight in India the UTC date is still yesterday). */
export const localIsoDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const round = (n, d = 2) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null);

/** Coerce form input into a fill record. Does not validate. */
export function normalizeFill(raw) {
  const f = raw || {};
  const amount = num(f.amount);
  return {
    id: f.id, vehicleId: f.vehicleId == null ? f.vehicleId : String(f.vehicleId),
    date: typeof f.date === "string" ? f.date.trim() : f.date,
    odometer: num(f.odometer), litres: num(f.litres),
    amount: Number.isFinite(amount) ? amount : null,
    full: f.full !== false,                                   // full tank unless explicitly a top-up
    ...(f.note && String(f.note).trim() ? { note: String(f.note).trim().slice(0, 200) } : {}),
  };
}

const keyCompare = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.odometer - b.odometer);

/** This vehicle's fills in chronological order (date, then odometer). */
export const fillsForVehicle = (fills, vehicleId) =>
  (Array.isArray(fills) ? fills : []).filter(f => f && String(f.vehicleId) === String(vehicleId)).slice().sort(keyCompare);

/**
 * Can this fill be saved? `errors` block saving; `warnings` are shown but do not block.
 * The odometer must rise with the date: higher than the reading before it and lower than the reading after it.
 * @returns {{ ok:boolean, errors:Object<string,string>, warnings:string[] }}
 */
export function validateFill(allFills, candidate, { today = new Date() } = {}) {
  const c = normalizeFill(candidate), errors = {}, warnings = [];
  const todayIso = typeof today === "string" ? today.slice(0, 10) : localIsoDate(new Date(today));
  if (c.vehicleId == null || c.vehicleId === "") errors.vehicleId = "Choose a vehicle.";
  if (!isIsoDate(c.date)) errors.date = "Enter a valid date.";
  else if (c.date > todayIso) errors.date = "The date can't be in the future.";
  if (!Number.isFinite(c.odometer) || c.odometer < 0) errors.odometer = "Enter the odometer reading in km.";
  else if (c.odometer > FILL_LIMITS.maxOdometer) errors.odometer = "That odometer reading looks too high.";
  else if (!Number.isInteger(c.odometer)) errors.odometer = "Enter whole kilometres.";
  if (!Number.isFinite(c.litres) || c.litres <= 0) errors.litres = "Enter the litres filled (more than 0).";
  else if (c.litres > FILL_LIMITS.maxLitres) errors.litres = "That many litres looks wrong.";
  if (c.amount !== null && (c.amount < 0 || c.amount > FILL_LIMITS.maxAmount)) errors.amount = "Enter the amount paid, or leave it blank.";

  if (!errors.vehicleId && !errors.date && !errors.odometer) {
    const others = fillsForVehicle(allFills, c.vehicleId).filter(f => c.id == null || String(f.id) !== String(c.id));
    const before = others.filter(f => keyCompare(f, c) < 0).pop(), after = others.find(f => keyCompare(f, c) > 0);
    const dup = others.find(f => f.date === c.date && f.odometer === c.odometer && Math.abs(f.litres - c.litres) < 0.005);
    if (dup) errors.odometer = "This looks like a duplicate of a fill-up already saved.";
    else if (before && c.odometer <= before.odometer) errors.odometer = `The odometer must be higher than the previous reading (${before.odometer} km on ${before.date}).`;
    else if (after && c.odometer >= after.odometer) errors.odometer = `The odometer must be lower than the next reading (${after.odometer} km on ${after.date}).`;
    else if (before && c.odometer - before.odometer > FILL_LIMITS.bigJumpKm) warnings.push(`That is ${c.odometer - before.odometer} km since the last reading. Check the number.`);
  }
  return { ok: Object.keys(errors).length === 0, errors, warnings };
}

/**
 * Chronological history with derived figures per row.
 * Row: { ...fill, distanceSincePrev, pricePerL, kmpl, costPerKm, tank:{distance,litres,cost}|null, suspect }
 *  distanceSincePrev  km since the previous reading (any fill)
 *  kmpl / costPerKm / tank  only on a FULL fill that closes a full-to-full interval; null otherwise
 *  suspect            km/L outside 1..100: shown, but flagged "check the readings"
 */
export function buildFuelHistory(fills) {
  const sorted = (Array.isArray(fills) ? fills : []).slice().sort(keyCompare);
  let lastFull = null, litres = 0, cost = 0, costKnown = true;
  return sorted.map((f, i) => {
    const prev = i > 0 ? sorted[i - 1] : null;
    const row = {
      ...f,
      distanceSincePrev: prev ? f.odometer - prev.odometer : null,
      pricePerL: f.amount != null && f.litres > 0 ? round(f.amount / f.litres, 2) : null,
      kmpl: null, costPerKm: null, tank: null, suspect: false,
    };
    if (lastFull) { litres += f.litres; if (f.amount == null) costKnown = false; else cost += f.amount; }
    if (f.full) {
      if (lastFull) {
        const distance = f.odometer - lastFull.odometer;
        if (distance > 0 && litres > 0) {
          const kmpl = distance / litres;
          row.kmpl = round(kmpl, 2);
          row.costPerKm = costKnown ? round(cost / distance, 2) : null;
          row.tank = { distance, litres: round(litres, 2), cost: costKnown ? round(cost, 2) : null };
          row.suspect = kmpl < 1 || kmpl > 100;
        }
      }
      lastFull = f; litres = 0; cost = 0; costKnown = true;
    }
    return row;
  });
}

/**
 * Headline figures for one vehicle. Averages are distance-weighted over the full-to-full intervals (not an average of averages).
 * @returns {{ count, latestOdometer, totalKm, intervals, avgKmpl, lastKmpl, fuelCostPerKm, lastPricePerL, needsFullFills }}
 */
export function fuelSummary(fills) {
  const rows = buildFuelHistory(fills);
  const tanks = rows.filter(r => r.tank);
  const km = tanks.reduce((s, r) => s + r.tank.distance, 0), l = tanks.reduce((s, r) => s + r.tank.litres, 0);
  const costed = tanks.filter(r => r.tank.cost != null), costKm = costed.reduce((s, r) => s + r.tank.distance, 0), costSum = costed.reduce((s, r) => s + r.tank.cost, 0);
  const priced = rows.filter(r => r.pricePerL != null);
  return {
    count: rows.length,
    latestOdometer: rows.length ? rows[rows.length - 1].odometer : null,
    totalKm: rows.length > 1 ? rows[rows.length - 1].odometer - rows[0].odometer : null,
    intervals: tanks.length,
    avgKmpl: l > 0 ? round(km / l, 2) : null,
    lastKmpl: tanks.length ? tanks[tanks.length - 1].kmpl : null,
    fuelCostPerKm: costKm > 0 ? round(costSum / costKm, 2) : null,
    lastPricePerL: priced.length ? priced[priced.length - 1].pricePerL : null,
    needsFullFills: tanks.length === 0,
  };
}
