// domain/person/financialPosition.js
//
// Pure. Reads the existing, authoritative settlements[p.id] shape — never
// computes a balance independently, never stores one. This module only
// labels and explains what settlements already produced.
//
// BUG FOUND AND FIXED (live, via this file's own reconciliation check surfaced on
// PersonProfileScreen — a real "They owe me" total didn't match the enumerated items behind
// it): getFinancialPositionBreakdown used to run every transaction through
// getPersonAttributedAmount(t, personId) to decide both the amount AND the owesMe/iOwe label.
// That function (App.jsx) only ever returns a non-zero amount for mode==="spent_on" — an
// entirely different fact (money spent ON this person) from money owed BACK by them
// (mode==="owes", the actual source of "They owe me"). Every real receivable transaction was
// silently enumerated as amount 0 and dropped, while the real total (settlements[p.id].owesMe,
// computed inline in App.jsx from the SAME three sources replicated below) kept including them
// correctly — hence a real total with an incomplete, wrong-looking explanation underneath it.
// Fixed by replicating App.jsx's settlements[] receivables/payables logic exactly (same three
// receivable sources: mode:"owes", forPerson, tagItems; same three payable sources:
// mode:"owes_by_me", settlement_in, settlement_out) instead of routing through a function built
// for a different question.

import { getBillSplitSource } from "../bills/splitSource.js";
import { remainingShare } from "../shared/remainingShare.js";
import { getPaybacks } from "./payback.js";

/**
 * @param {{owesMe:number, iOwe:number}} settlement - settlements[p.id],
 *   the existing authoritative shape, as-is
 * @returns {{state:"balanced"|"owed_to_me"|"i_owe", label:string, amount:number, owesMe:number, iOwe:number}}
 */
export function getFinancialPositionLabel(settlement) {
  const owesMe = Number(settlement?.owesMe || 0);
  const iOwe = Number(settlement?.iOwe || 0);
  const net = owesMe - iOwe;

  if (net === 0) {
    return { state: "balanced", label: "Balanced", amount: 0, owesMe, iOwe };
  }
  if (net > 0) {
    return { state: "owed_to_me", label: "They owe you", amount: net, owesMe, iOwe };
  }
  return { state: "i_owe", label: "You owe them", amount: Math.abs(net), owesMe, iOwe };
}

/**
 * "How this is worked out" — an honest, non-authoritative EXPLANATION of
 * settlements[p.id]'s total, listing the real contributing transactions
 * and bills. This never recomputes the total independently — the total
 * shown alongside this breakdown always comes from settlements[p.id]
 * itself; this function only enumerates what's behind it, for
 * transparency, replicating the exact same per-source logic App.jsx's
 * settlements[] computation already uses (never a second, diverging
 * calculation of what counts as owed).
 *
 * @param {string} personId
 * @param {Array} txns
 * @param {Array} bills
 * @param {string} meId - the household's own person id (people.find(p=>p.isMe)?.id), needed to
 *   exclude self and to match forPerson's own "not me" guard exactly, same as App.jsx's
 *   settlements[] computation
 * @returns {Array<{id, kind:"txn"|"bill", desc, amount, mode:"owesMe"|"iOwe", date, transactionRef}>}
 *   sorted most-recent first; only entries with a genuine non-zero
 *   attributed amount for this person are included. transactionRef is a
 *   raw pass-through of the underlying transaction's real UPI/bank
 *   reference (null for Bill-sourced and settlement entries, which don't
 *   carry one) — not a new calculation, just surfaced so a caller can spot
 *   two entries that share a real reference (the same physical payment,
 *   entered twice) rather than guessing from desc/amount/date alone.
 */
export function getFinancialPositionBreakdown(personId, txns, bills, meId) {
  const items = [];

  for (const t of (txns || [])) {
    if (!t) continue;

    if (t.type === "expense") {
      // owesMe — mirrors App.jsx settlements[] receivables exactly, same three sources, same
      // double-count guards (a transaction contributes at most one receivable entry per person).
      const peopleMap = { ...(t.splitPeople || {}), ...(t.people || {}) };
      const info = peopleMap[personId];
      if (info && personId !== meId && info.mode === "owes" && !info.settled) {
        const amount = remainingShare(info);
        if (amount > 0) {
          items.push({ id: t.id, kind: "txn", desc: t.desc || t.merchant || "Expense", amount, mode: "owesMe", date: t.date || null, transactionRef: t.transactionRef || null });
        }
      } else if (t.forPerson && t.forPerson === personId && personId !== meId) {
        const amt = Number(t.tagPersonAmount || 0) > 0 ? Number(t.tagPersonAmount) : (t.tagMode === "person" ? Number(t.amount || 0) : 0);
        if (amt > 0) {
          items.push({ id: t.id, kind: "txn", desc: t.desc || t.merchant || "Expense", amount: amt, mode: "owesMe", date: t.date || null, transactionRef: t.transactionRef || null });
        }
      } else {
        const tagItem = (t.tagItems || []).find(item => item.targetType === "person" && item.targetId === personId && personId !== meId && Number(item.amount || 0) > 0);
        if (tagItem) {
          items.push({ id: t.id, kind: "txn", desc: t.desc || t.merchant || "Expense", amount: Number(tagItem.amount), mode: "owesMe", date: t.date || null, transactionRef: t.transactionRef || null });
        }
      }

      // iOwe — the one expense-level payable source; settlement_in/settlement_out (the other
      // two real sources) are handled below, since they're a different transaction type.
      const owesByMeInfo = t.people?.[personId];
      if (owesByMeInfo && owesByMeInfo.mode === "owes_by_me") {
        const amount = Number(owesByMeInfo.amount || 0);
        if (amount > 0) {
          items.push({ id: `${t.id}_iowe`, kind: "txn", desc: t.desc || t.merchant || "Expense", amount, mode: "iOwe", date: t.date || null, transactionRef: t.transactionRef || null });
        }
      }
    }

    if (t.type === "settlement_in" && t.fromPersonId === personId && Number(t.extraAmount || 0) > 0 && (t.settlementLinks || []).length > 0) {
      items.push({ id: t.id, kind: "txn", desc: t.desc || "Settlement", amount: Number(t.extraAmount), mode: "iOwe", date: t.date || null, transactionRef: t.transactionRef || null });
    }
    if (t.type === "settlement_out" && t.toPersonId === personId) {
      const amount = Number(t.amount || 0);
      if (amount > 0) {
        items.push({ id: t.id, kind: "txn", desc: t.desc || "Settlement", amount, mode: "iOwe", date: t.date || null, transactionRef: t.transactionRef || null });
      }
    }
  }

  for (const b of (bills || [])) {
    if (!b) continue;
    // Once paid, a split Bill's own splitPeople is a stale snapshot — the linked payment
    // Transaction is what settling actually updates (see splitSource.js). Counting the Bill's own
    // copy here too would double the same debt: once from the txns loop above (via that
    // Transaction's `people`), once from the Bill's stale, forever-unsettled copy.
    const splitSource = getBillSplitSource(b, txns);
    if (splitSource.kind === "txn") continue;
    const info = splitSource.people?.[personId];
    if (!info) continue;
    const remaining = Number(info.amount || 0) - Number(info.settledAmt || 0);
    if (!(remaining > 0)) continue;
    items.push({
      id: b.id, kind: "bill",
      desc: b.name || b.merchant || "Bill",
      amount: remaining,
      mode: info.mode === "owes" ? "owesMe" : "iOwe",
      date: b.dueDate || null,
      transactionRef: null,
    });
  }

  // Paybacks (payback.js): each one lowers "I owe" by the part of it that was owed, oldest first; whatever is left over is
  // an overpayment and is listed as owed to me, so the totals above still equal what the screen shows.
  const paybacks = getPaybacks(txns, personId);
  if (paybacks.length) {
    let room = items.filter(i => i.mode === "iOwe").reduce((sum, i) => sum + i.amount, 0);
    let excess = 0;
    for (const pb of paybacks) {
      const amount = Number(pb.amount || 0);
      const applied = Math.min(room, amount);
      room -= applied; excess += amount - applied;
      if (applied > 0) items.push({ id: pb.id, kind: "txn", desc: pb.desc || "Paid back", amount: -applied, mode: "iOwe", date: pb.date || null, transactionRef: null });
    }
    if (excess > 0) items.push({ id: `payback_excess_${personId}`, kind: "txn", desc: "Paid back more than owed", amount: Math.round(excess * 100) / 100, mode: "owesMe", date: null, transactionRef: null });
  }

  return items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
