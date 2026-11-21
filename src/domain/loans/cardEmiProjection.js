// domain/loans/cardEmiProjection.js
//
// Money Required for a card EMI purchase. The purchase makes every instalment up front as a dated card expense
// (Add > EMI > Credit card EMI, loan.autoScheduled). A statement only counts what is already billed, so until it closes
// the coming instalments were invisible: Money Required showed 0 for an EMI that was certain.
//
// This projects each instalment still ahead (dated after today) as one Debt Service entry, due on the due date of the
// statement that will carry it (getCardCycleDates). An instalment dated today or earlier is ALREADY on a statement
// (that statement is a Bill / card summary), so it is never projected: no double counting. Nothing is stored.

import { getCardCycleDates } from "../cards/summaries.js";

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const noon = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d, 12); };

/** @param {{loans:Array, accounts:Array, txns:Array, today:string}} args  @returns {Array} Debt Service events */
export function projectCardEmiInstalments({ loans, accounts, txns, today }) {
  const out = [];
  for (const loan of loans || []) {
    if (!loan || loan.direction !== "taken" || loan.autoScheduled !== true || (loan.status && loan.status !== "active")) continue;
    if (loan.outstanding != null && Number(loan.outstanding) <= 0) continue;
    const ids = new Set((loan.scheduledInstallmentIds || []).map(String));
    for (const t of txns || []) {
      if (!ids.has(String(t.id)) || !t.date || String(t.date) <= String(today)) continue;
      const card = (accounts || []).find(a => String(a.id) === String(t.accId));
      const cycle = card ? getCardCycleDates(card, noon(t.date)) : null;
      if (!cycle?.dueOn) continue;
      const n = t.emiInstallmentNum, total = t.emiTotalInstallments;
      out.push({
        sourceType: "debt", sourceId: `${loan.id}:${t.id}`, category: "debtService", subCategory: "cardEmi",
        name: `${loan.name || "Card EMI"} EMI${n && total ? ` ${n}/${total}` : ""}`,
        amount: Number(t.amount) || 0, date: ymd(cycle.dueOn), status: "upcoming", recurs: false,
      });
    }
  }
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
