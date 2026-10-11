// domain/person/paidBy.js
//
// "Paid by <person>": a purchase another person paid for from their own pocket on my behalf. It is an ordinary `expense`
// (ADR-017: no new type) with two differences:
//   * paidByPersonId names the payer, and accId is empty, so no account of mine is debited when it is recorded;
//   * what I owe the payer is the expense amount (what I agreed to bear), less any refund against it.
//
// Spending is unchanged: getMyExpenseShare already counts the expense on its own date, net of refunds. The payable is
// derived here, never stored, and joins the person's "I owe" total beside the older owes_by_me source. Paying the person
// back is the existing Pay back flow (payback.js): it lowers the same total, and an overpayment becomes "they owe you".
//
// Pure.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

export const isPaidByOther = t => Boolean(t && t.type === "expense" && t.paidByPersonId);

/** What I owe the payer for one expense: its amount less refunds, never below zero. 0 for an expense I paid myself. */
export function getPaidByPayable(t, refundMap) {
  if (!isPaidByOther(t)) return 0;
  const refunded = Number((refundMap || {})[String(t.id)] || 0);
  return Math.max(0, r2(Number(t.amount || 0) - refunded));
}

/** Total I owe one person for expenses they paid. `groupId` limits to expenses recorded against that group. */
export function getPaidByPayableTotal(txns, personId, refundMap, { groupId } = {}) {
  return r2((txns || [])
    .filter(t => isPaidByOther(t) && String(t.paidByPersonId) === String(personId) && (groupId === undefined || t.groupId === groupId))
    .reduce((sum, t) => sum + getPaidByPayable(t, refundMap), 0));
}

/** { personId: amount } over every expense someone else paid. */
export function getPaidByPayablesByPerson(txns, refundMap) {
  const out = {};
  for (const t of txns || []) if (isPaidByOther(t)) out[t.paidByPersonId] = r2((out[t.paidByPersonId] || 0) + getPaidByPayable(t, refundMap));
  return out;
}
