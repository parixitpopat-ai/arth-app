// A card statement CREDIT row (a refund) -> which purchase on the card does it return? Pure; reads only. It only PROPOSES: the person taps to record.
// A refund must be linked to the purchase it returns (that is what lowers what the purchase cost); a credit with no sensible purchase is not offered.
import { buildRefundTotalsByExpense } from "../../../domain/allocations/adapter.js";

const dayNum = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
const paise = n => Math.round(Number(n) * 100);
const words = s => new Set(String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !/^\d+$/.test(w)));
export const BEFORE_DAYS = 180, AFTER_DAYS = 3;

/**
 * @param {{row:{date:string, amountPaise:number, desc?:string}, transactions:Array, accountIds:Iterable<string|number>}} a  accountIds = the card and any handle linked to it
 * @returns {Array<{txn:object, exact:boolean, sameShop:boolean, remainingPaise:number}>} best first, at most 3
 */
export function refundTargets({ row, transactions, accountIds }) {
  if (!row || !(row.amountPaise > 0)) return [];
  const ids = new Set([...accountIds].map(String));
  const refunded = buildRefundTotalsByExpense(transactions);
  const rowWords = words(row.desc);
  const out = [];
  for (const t of transactions || []) {
    if (!t || t.type !== "expense" || !t.date || !ids.has(String(t.accId))) continue;
    const gap = dayNum(row.date) - dayNum(t.date);          // days between the purchase and the refund
    if (gap < -AFTER_DAYS || gap > BEFORE_DAYS) continue;
    const total = paise(t.amount), remaining = total - paise(refunded[String(t.id)] || 0);
    if (remaining < row.amountPaise) continue;               // cannot refund more than is left of it
    const exact = total === row.amountPaise && remaining === total;
    const mine = words(`${t.merchant || ""} ${t.desc || ""}`);
    const sameShop = [...rowWords].some(w => mine.has(w));
    if (!exact && !sameShop) continue;                      // a part-refund is only proposed when it is clearly the same shop
    out.push({ txn: t, exact, sameShop, remainingPaise: remaining, gap: Math.abs(gap) });
  }
  out.sort((a, b) => (b.exact && b.sameShop) - (a.exact && a.sameShop) || b.exact - a.exact || b.sameShop - a.sameShop || a.gap - b.gap);
  return out.slice(0, 3).map(({ gap, ...rest }) => rest);
}
