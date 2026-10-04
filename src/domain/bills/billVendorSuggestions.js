// domain/bills/billVendorSuggestions.js
//
// Add expense -> Vendor box: typing part of a bill's name offers ready-made payment labels such as
// "Electricity Bill Payment for Home", the way an Investment's name is offered when adding an investment.
// Text only: choosing one fills the Vendor box; it links nothing and marks nothing paid. Card statements
// are left out (a card is paid with a Card payment, not an expense).

/** "Electricity" + "Home" -> "Electricity Bill Payment for Home"; a name already ending in "Bill" is not doubled. */
export function billPaymentLabel(name, forLabel) {
  const base = String(name || "").trim();
  if (!base) return "";
  const core = /\bbill\b/i.test(base) ? `${base} Payment` : `${base} Bill Payment`;
  const who = String(forLabel || "").trim();
  return who && who.toLowerCase() !== "unassigned" ? `${core} for ${who}` : core;
}

/**
 * @param {{query:string, bills:Array, getForLabel:(bill:Object)=>string, limit?:number}} p
 * @returns {string[]} labels, unpaid bills first, no duplicates
 */
export function suggestBillPaymentVendors({ query, bills, getForLabel, limit = 3 }) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const rows = new Map(); // label (lowercase) -> { label, unpaid }; a label is "unpaid" if ANY bill behind it is
  for (const b of bills || []) {
    if (!b || b.status === "cancelled" || b.isCcStatement || !String(b.name || "").trim()) continue;
    const label = billPaymentLabel(b.name, getForLabel ? getForLabel(b) : "");
    const key = label.toLowerCase();
    if (!(key.includes(q) || String(b.name).toLowerCase().includes(q))) continue;
    const row = rows.get(key);
    if (row) row.unpaid = row.unpaid || b.status === "unpaid";
    else rows.set(key, { label, unpaid: b.status === "unpaid" });
  }
  return [...rows.values()].sort((a, c) => Number(c.unpaid) - Number(a.unpaid)).slice(0, limit).map(r => r.label);
}
