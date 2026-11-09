// domain/vendors/vendorMerge.js
//
// Vendors in Arth are just the `merchant` text on an entry. So "Dudh Sagar Dairy" and "DudhSagar Dairy" are two vendors, and their spend is split.
// This module (1) totals spend by vendor, (2) FINDS names that look like the same vendor, and (3) merges names when the person says so.
// Finding never changes anything; merging only ever runs on an explicit choice, and it returns what it changed so it can be undone. Pure.
//
// Two names look alike when they are equal after: lower case, removing company words (pvt, ltd, llp, inc, co, company, private, limited, the, and),
// removing everything that is not a letter or digit (spaces, dots, dashes), and one trailing "s". "Store"/"Shop" are NOT dropped: "Mahesh Stores"
// and "Mahesh" may well be different places, and a wrong suggestion costs more than a missed one.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const COMPANY_WORDS = /\b(pvt|private|ltd|limited|llp|inc|co|company|the|and)\b/g;

export const cleanName = name => String(name || "").trim().replace(/\s+/g, " ");
export const vendorId = name => cleanName(name).toLowerCase();          // how the app already matches a vendor: ignoring capitals
export function vendorKey(name) {
  return cleanName(name).toLowerCase().replace(COMPANY_WORDS, "").replace(/[^a-z0-9]/g, "").replace(/s$/, "");
}

/** Vendor-wise spend over expenses. Entries whose names differ only in capitals/extra spaces are one vendor (as everywhere else in the app). */
export function vendorSpend(txns, { from = "", to = "" } = {}) {
  const map = new Map();
  for (const t of txns || []) {
    if (!t || t.type !== "expense") continue;
    const name = cleanName(t.merchant);
    if (!name) continue;
    const date = String(t.date || "");
    if (from && date < from) continue;
    if (to && date > to) continue;
    const id = vendorId(name);
    const row = map.get(id) || { id, names: new Map(), entries: 0, amount: 0, first: "", last: "" };
    row.names.set(name, (row.names.get(name) || 0) + 1);
    row.entries += 1; row.amount = r2(row.amount + (Number(t.amount) || 0));
    if (!row.first || date < row.first) row.first = date;
    if (!row.last || date > row.last) row.last = date;
    map.set(id, row);
  }
  return [...map.values()].map(r => {
    const variants = [...r.names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { id: r.id, name: variants[0][0], variants: variants.map(([n]) => n), entries: r.entries, amount: r.amount, first: r.first, last: r.last };
  }).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

/** A stable identity for a suggestion: the set of exact names in it. If a new spelling shows up later, the signature changes and it is asked again. */
export const groupSignature = names => [...new Set(names.map(vendorId))].sort().join("|");

/**
 * Groups of vendors that look like the same one. Each: { key, names[{name, entries, amount}], suggested }. `suggested` = the most used spelling.
 * `dismissed` is a list of signatures the person marked "not the same".
 */
export function findVendorDuplicates(txns, { dismissed = [] } = {}) {
  const byKey = new Map();
  for (const v of vendorSpend(txns)) {
    const key = vendorKey(v.id);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) || []), v]);
  }
  const skip = new Set(dismissed);
  const groups = [];
  for (const [key, vendors] of byKey) {
    if (vendors.length < 2) continue;
    // the exact spellings, each with its own count and amount
    const spellings = new Map();
    for (const t of txns || []) {
      if (!t || t.type !== "expense") continue;
      const n = cleanName(t.merchant);
      if (!n || !vendors.some(v => v.id === vendorId(n))) continue;
      const row = spellings.get(n) || { name: n, entries: 0, amount: 0 };
      row.entries += 1; row.amount = r2(row.amount + (Number(t.amount) || 0));
      spellings.set(n, row);
    }
    const names = [...spellings.values()].sort((a, b) => b.entries - a.entries || b.amount - a.amount || a.name.localeCompare(b.name));
    if (skip.has(groupSignature(names.map(n => n.name)))) continue;
    groups.push({ key, names, suggested: names[0].name, signature: groupSignature(names.map(n => n.name)) });
  }
  return groups.sort((a, b) => b.names.reduce((s, n) => s + n.amount, 0) - a.names.reduce((s, n) => s + n.amount, 0));
}

/**
 * Rename every entry whose vendor is one of `from` (ignoring capitals) to `to`. Transactions and bills (their `merchant`).
 * @returns {{txns:any[], bills:any[], changedTxns:number, changedBills:number, undo:{txns:Array<{id:any,merchant:string}>, bills:Array<{id:any,merchant:string}>}}}
 */
export function mergeVendors({ txns = [], bills = [] }, { from, to }) {
  const target = cleanName(to);
  const ids = new Set((from || []).map(vendorId).filter(Boolean));
  const undo = { txns: [], bills: [] };
  if (!target || ids.size === 0) return { txns, bills, changedTxns: 0, changedBills: 0, undo };
  const swap = (list, bucket) => list.map(x => {
    const cur = cleanName(x?.merchant);
    if (!cur || !ids.has(vendorId(cur)) || cur === target) return x;
    bucket.push({ id: x.id, merchant: x.merchant });
    return { ...x, merchant: target };
  });
  const nt = swap(txns, undo.txns), nb = swap(bills, undo.bills);
  return { txns: undo.txns.length ? nt : txns, bills: undo.bills.length ? nb : bills, changedTxns: undo.txns.length, changedBills: undo.bills.length, undo };
}

/** Put the old names back on exactly the entries a merge changed (by id), leaving anything edited since untouched. */
export function undoVendorMerge({ txns = [], bills = [] }, undo, { to }) {
  const target = cleanName(to);
  const restore = (list, saved) => {
    const byId = new Map((saved || []).map(s => [String(s.id), s.merchant]));
    return list.map(x => (byId.has(String(x?.id)) && cleanName(x.merchant) === target ? { ...x, merchant: byId.get(String(x.id)) } : x));
  };
  return { txns: restore(txns, undo?.txns), bills: restore(bills, undo?.bills) };
}
