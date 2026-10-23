// src/domain/transactions/chargeShare.js — charges on an itemised expense (handling, delivery, platform fee, GST…) and how they are shared. Pure.
//
// A line on an itemised expense is either an ITEM (the default) or a CHARGE (`kind: "charge"`, with a `chargeType`). A charge is a cost that is not an item.
// Rule (the person's own): charges are divided EQUALLY by the number of splits, whatever each split's items cost. A split is a person or group that has been
// given items on this expense; the person who paid ("me") also counts, unless they switch that off. The paisa that does not divide stays with "me" (or with the first
// split when "me" is not counted), so the shares always add back to the charges exactly.
//
// Money is worked in whole paise so nothing drifts. Charges on a line are `qty × unitPrice` like any other line.

export const CHARGE_TYPES = [
  { value: "handling", label: "Handling charge" },
  { value: "delivery", label: "Delivery charge" },
  { value: "platform", label: "Platform fee" },
  { value: "cgst", label: "CGST" },
  { value: "sgst", label: "SGST" },
  { value: "other", label: "Other charge" },
];
const TYPE_LABEL = Object.fromEntries(CHARGE_TYPES.map(t => [t.value, t.label]));
export const chargeTypeLabel = type => TYPE_LABEL[type] || TYPE_LABEL.other;

export const ME = "__me__";

export const isCharge = line => Boolean(line) && line.kind === "charge";

const paise = v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
/** A line's amount in paise: qty × unit price when there is a quantity, else its own amount (the same rule the Add form uses). */
export const linePaise = line => {
  const qty = Number(line && line.qty), unit = Number(line && line.unitPrice);
  if (Number.isFinite(qty) && qty > 0 && Number.isFinite(unit)) return Math.round(qty * unit * 100);
  return paise(line && line.amount);
};

/** Totals of the charge lines, by type, in rupees; plus the total of all charges. Used for the on-screen breakup and any report. */
export function chargeBreakdown(lineItems) {
  const by = {};
  let total = 0;
  for (const l of Array.isArray(lineItems) ? lineItems : []) {
    if (!isCharge(l)) continue;
    const p = linePaise(l);
    if (!(p > 0)) continue;
    const type = TYPE_LABEL[l.chargeType] ? l.chargeType : "other";
    by[type] = (by[type] || 0) + p;
    total += p;
  }
  return { byType: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v / 100])), total: total / 100, totalPaise: total, byTypePaise: by };
}

/** Split `totalPaise` equally between `keys`. The leftover paise goes to `remainderTo` (a key in `keys`). Returns {key: paise}. */
export function equalShares(totalPaise, keys, remainderTo) {
  const out = {};
  if (!keys.length) return out;
  const base = Math.floor(totalPaise / keys.length);
  keys.forEach(k => { out[k] = base; });
  out[remainderTo != null && keys.includes(remainderTo) ? remainderTo : keys[0]] += totalPaise - base * keys.length;
  return out;
}

const keyOf = row => `${row.targetType}:${row.targetId}`;
/** A row takes part in the split when it points at someone and is linked to specific items. */
const takesPart = row => Boolean(row && row.targetId) && Array.isArray(row.items) && row.items.some(i => Number(i && i.qty) > 0);

/**
 * @param {{lineItems:any[], rows:Array<{id?:string,targetType:string,targetId:string,items?:Array<{sourceItemId:string,qty:number|string}>,amount?:any}>, includeMe?:boolean}} input
 * @returns {{chargesPaise:number, splitCount:number, meCounts:boolean, meSharePaise:number, rows:Record<string,{itemsPaise:number, chargePaise:number, totalPaise:number}>}} keyed by row id (or targetType:targetId)
 */
export function shareCharges({ lineItems, rows, includeMe = true }) {
  const lines = Array.isArray(lineItems) ? lineItems : [];
  const byId = new Map(lines.map(l => [l.id, l]));
  const chargesPaise = lines.filter(isCharge).reduce((s, l) => s + linePaise(l), 0);
  const itemPaise = row => (row.items || []).reduce((s, i) => {
    const src = byId.get(i.sourceItemId);
    if (!src || isCharge(src)) return s;
    const qty = Math.max(0, Number(i.qty) || 0);
    const unit = Number(src.qty) > 0 ? Number(src.unitPrice) || 0 : Number(src.amount) || 0;
    return s + Math.round(qty * unit * 100);
  }, 0);

  const taking = (rows || []).filter(takesPart);
  const meRow = taking.find(r => r.targetType === "person" && r.targetId === ME);
  const others = taking.filter(r => r !== meRow);
  // "me" is a split when they have a row of their own, or when they are counted in and are not already represented.
  const meCounts = Boolean(meRow) || (includeMe && others.length > 0);
  const keys = [...others.map(keyOf), ...(meCounts ? [keyOf({ targetType: "person", targetId: ME })] : [])];
  const unique = [...new Set(keys)];
  const shares = chargesPaise > 0 ? equalShares(chargesPaise, unique, meCounts ? keyOf({ targetType: "person", targetId: ME }) : unique[0]) : {};

  const out = {};
  for (const r of rows || []) {
    const k = r.id != null ? r.id : keyOf(r);
    const items = itemPaise(r);
    const share = takesPart(r) ? (shares[keyOf(r)] || 0) : 0;
    out[k] = { itemsPaise: items, chargePaise: share, totalPaise: items + share };
  }
  const meSharePaise = meCounts ? (shares[keyOf({ targetType: "person", targetId: ME })] || 0) : 0;
  return { chargesPaise, splitCount: unique.length, meCounts, meSharePaise, rows: out };
}
