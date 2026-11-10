// domain/bills/billExpenseMatch.js
//
// Two small rules for a bill added from a connection, both pure.
//
// 1. defaultCategoryForBillerType: a bill made from a connection used to carry NO expense category (the form only showed "Mobile Postpaid · from
//    connection", which is the provider type, not a category), so paying it produced an uncategorised expense. Types whose category is clear
//    get Utilities and the matching sub-category; every other type returns null (nothing is guessed).
//
// 2. findMatchingExpenseForBill: when a bill is added, an expense you already have may be the payment. The old rule matched ANY unlinked expense
//    with the same amount (any date, any category when the bill had none), so a different expense — say a Housing one — could be offered as "the
//    payment" and, on Yes, become the bill's proof of payment. Now the expense must have the same amount, must not already be linked to a bill,
//    must agree on category when BOTH have one, and must be dated within WINDOW_DAYS of the bill's due date or of today. The closest date wins.

export const WINDOW_DAYS = 45;

const BY_TYPE = {
  "Electricity": { catId: "utilities", subId: "u1" },
  "Water": { catId: "utilities", subId: "u2" },
  "LPG Gas": { catId: "utilities", subId: "u3" },
  "Piped Gas": { catId: "utilities", subId: "u3" },
  "Broadband": { catId: "utilities", subId: "u4" },
  "Mobile Postpaid": { catId: "utilities", subId: "u5" },
  "Mobile Prepaid": { catId: "utilities", subId: "u5" },
};

/** @returns {{catId:string, subId:string}|null} */
export function defaultCategoryForBillerType(type) { return BY_TYPE[type] ? { ...BY_TYPE[type] } : null; }

const dayNum = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null; };
const catOf = o => ((o && o.catIds && o.catIds.length ? o.catIds[0] : o && o.catId) || "");

/** @param {{bill:object, txns:Array, today?:string}} a @returns {object|null} the matching expense, or null */
export function findMatchingExpenseForBill({ bill, txns, today }) {
  if (!bill) return null;
  const amt = Number(bill.amount), billCat = catOf(bill), due = dayNum(bill.dueDate), now = dayNum(today);
  let best = null, bestGap = Infinity;
  for (const t of txns || []) {
    if (!t || t.type !== "expense" || t.isBillPayment || t.paidBillId) continue;
    if (!(Math.abs(Number(t.amount) - amt) < 0.005)) continue;
    const tc = catOf(t);
    if (billCat && tc && String(tc) !== String(billCat)) continue;
    const d = dayNum(t.date); if (d === null) continue;
    const gaps = [due, now].filter(x => x !== null).map(x => Math.abs(d - x));
    const gap = gaps.length ? Math.min(...gaps) : 0;
    if (gap > WINDOW_DAYS) continue;
    if (gap < bestGap) { best = t; bestGap = gap; }
  }
  return best;
}
