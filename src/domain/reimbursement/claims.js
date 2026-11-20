// domain/reimbursement/claims.js
//
// Work expenses waiting to be claimed, and what a reimbursement received clears. Same idea as a repayment clearing dues: a list of what is waiting,
// ticked from the oldest while the money lasts, the person can change the ticks, and saving marks those expenses as reimbursed by this payment.
//
// An expense is WAITING when it is a work expense (`reimbursable`) with no `reimbursedByTxnId`. What is claimed for it is `reimbursableAmount` when set (for
// example ₹4,000 of a ₹4,800 hotel), else the whole amount. An expense is claimed whole or not at all: the stored shape has one `reimbursedByTxnId`, no part-paid state.
// Pure; money is worked in paise.

const paise = v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const rupees = p => p / 100;

/** Waiting work expenses, oldest first. `amount` is what is claimed; `spent` is what the expense cost. */
export function getWaitingClaims(txns) {
  return (txns || [])
    .filter(t => t && t.type === "expense" && t.reimbursable && !t.reimbursedByTxnId)
    .map(t => ({ id: String(t.id), title: t.desc || t.merchant || "Expense", date: t.date || "", amount: rupees(paise(t.reimbursableAmount || t.amount)), spent: Number(t.amount) || 0, createdAt: Number(t.createdAt) || 0 }))
    .filter(c => c.amount > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/** Ticks whole expenses from the oldest while the received money lasts; stops at the first one that does not fit. */
export function autoPickClaims(claims, received) {
  let left = paise(received);
  const ids = [];
  for (const c of claims || []) {
    const p = paise(c.amount);
    if (p > left) break;
    ids.push(c.id); left -= p;
  }
  return ids;
}

/** What the ticked expenses add up to against the money received. left > 0: money not matched to an expense; short > 0: ticked more than received. */
export function summarisePick(claims, pickedIds, received) {
  const set = new Set((pickedIds || []).map(String));
  const total = (claims || []).filter(c => set.has(c.id)).reduce((s, c) => s + paise(c.amount), 0);
  const got = paise(received);
  return { count: (claims || []).filter(c => set.has(c.id)).length, total: rupees(total), left: got > total ? rupees(got - total) : 0, short: total > got ? rupees(total - got) : 0 };
}

/** The transactions with the picked expenses marked as reimbursed by `incomeTxnId`. Anything not picked is returned as it was. */
export function applyReimbursement(txns, pickedIds, incomeTxnId) {
  const set = new Set((pickedIds || []).map(String));
  return (txns || []).map(t => (set.has(String(t.id)) && t.type === "expense" && t.reimbursable && !t.reimbursedByTxnId ? { ...t, reimbursedByTxnId: incomeTxnId } : t));
}
