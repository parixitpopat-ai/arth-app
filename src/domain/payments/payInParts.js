// src/domain/payments/payInParts.js — "paid in parts" for ONE purchase: ₹500 paid as ₹100 + ₹400. Pure.
// One purchase stays one transaction; it carries paymentLines [{accId, amount}] that must add up exactly to its total
// (the rule domain/payments/paymentLineSlices.js already enforces when it spreads the money over accounts).
// The form keeps lines as { accId, amount:"text" }; this module checks them and turns them into what is saved.
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const amt = l => round2(parseFloat(String(l && l.amount || "").replace(/,/g, "")) || 0);

/** Two empty lines to start with, the first on the account already chosen. */
export function startParts(accId) { return [{ accId: accId || "", amount: "" }, { accId: "", amount: "" }]; }

/** Lines of an existing transaction -> form lines; null when it was not paid in parts. */
export function partsFromTxn(t) {
  const l = t && t.type === "expense" && Array.isArray(t.paymentLines) ? t.paymentLines : null;
  return l && l.length > 1 ? l.map(x => ({ accId: String(x.accId || ""), amount: String(x.amount ?? "") })) : null;
}

/** { ok, placed, left, message } — `left` is what still has to be placed (negative = too much). */
export function payPartsStatus(lines, total) {
  const t = round2(total), ls = Array.isArray(lines) ? lines : [];
  const placed = round2(ls.reduce((s, l) => s + amt(l), 0)), left = round2(t - placed);
  if (!(t > 0)) return { ok: false, placed, left, message: "Enter the amount first." };
  if (ls.length < 2) return { ok: false, placed, left, message: "Add at least two payments, or switch back to one account." };
  if (ls.some(l => !l.accId)) return { ok: false, placed, left, message: "Choose an account for every payment." };
  if (ls.some(l => !(amt(l) > 0))) return { ok: false, placed, left, message: "Every payment needs an amount." };
  if (Math.abs(left) >= 0.005) return { ok: false, placed, left, message: left > 0 ? `${left} still has to be placed.` : `The payments are ${-left} more than the amount.` };
  return { ok: true, placed, left: 0, message: "" };
}

/** What is stored on the transaction. */
export function toPaymentLines(lines) { return (lines || []).map(l => ({ accId: l.accId, amount: amt(l) })); }
