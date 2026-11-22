// domain/cards/unbilledCommitments.js
//
// Money Required for what is already spent on a card but not yet on a statement ("unbilled"). Until the statement closes,
// Money Required showed nothing for it, though the bill is certain (a down payment, a purchase made this week).
// One entry per card, due on the due date of the statement that will carry it. When the statement closes this
// spending moves into that statement (a Bill) and the unbilled figure restarts, so the two never overlap.
// Instalments dated in the future are NOT in unbilled (they are dated after today), so they are not counted twice
// with domain/loans/cardEmiProjection.js either. Nothing here is stored.

import { getCardCycleDates } from "./summaries.js";

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * @param {{accounts:Array, unbilledOf:(card:object)=>number, today?:Date}} args
 *   unbilledOf is injected (App.jsx passes getCardSummary(...).currentCycleSpend), keeping this module pure.
 */
export function getCardUnbilledEvents({ accounts, unbilledOf, today = new Date() }) {
  const out = [];
  for (const card of accounts || []) {
    if (card?.type !== "cc") continue;
    const amount = r2(unbilledOf(card));
    if (!(amount > 0)) continue;
    const cycle = getCardCycleDates(card, today);
    const next = cycle?.nextStatementDate ? getCardCycleDates(card, cycle.nextStatementDate) : null;
    out.push({
      sourceType: "ccUnbilled", sourceId: card.id, category: "committedSpending", subCategory: "ccUnbilled",
      name: `${card.name || "Card"} · spent since the last statement`,
      amount, date: next?.dueOn ? ymd(next.dueOn) : null, status: "upcoming", recurs: false,
    });
  }
  return out;
}
