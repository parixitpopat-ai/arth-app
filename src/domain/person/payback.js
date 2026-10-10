// domain/person/payback.js
//
// Paying back someone who paid on your behalf. Until now "You owe <person>" only ever went up: the three things that add
// to it (an expense with "I owe", the "You Owe" screen, a Settlement Out row) have no counterpart that lowers it.
//
// A payback is a "transfer" with a source account and NO destination (the same shape as a loan given, see
// loans/disbursal.js): the account is debited once, and a transfer is never spending, so the cost, already counted when it
// was incurred, is not counted again. It carries paidToPersonId (and paidToGroupId when made from a group), which is how it
// is found again.
//
//   iOwe  = max(0, what you owe - paid back)
//   owesMe += whatever was paid back beyond what you owed (an overpayment is money they now owe you)
//
// Pure. Nothing here stores a balance.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

export const isPersonPayback = t => Boolean(t && t.type === "transfer" && t.isPersonPayback === true && t.paidToPersonId);

export function buildPaybackTxn({ personId, personName, groupId = null, fromAccId, amount, date, note = "", id, now = Date.now() }) {
  const who = String(personName || "").trim();
  return {
    id: id ?? now,
    type: "transfer",
    desc: `Paid back${who ? ` - ${who}` : ""}`,
    merchant: who || "Paid back",
    note: String(note || "").trim(),
    date,
    amount: r2(amount),
    fromAccId,
    toAccId: null,
    accId: null,
    catId: null, catIds: [], subId: null, subIds: [],
    people: {},
    isPersonPayback: true,
    paidToPersonId: personId,
    paidToGroupId: groupId || null,
    trackingMode: "none",
    createdDate: date,
    createdAt: now,
  };
}

/** Paybacks to one person, oldest first. `groupId` limits to those made from that group. */
export function getPaybacks(txns, personId, { groupId } = {}) {
  return (txns || [])
    .filter(t => isPersonPayback(t) && String(t.paidToPersonId) === String(personId) && (groupId === undefined || t.paidToGroupId === groupId))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

export const getPaybackTotal = (txns, personId, opts) => r2(getPaybacks(txns, personId, opts).reduce((s, t) => s + Number(t.amount || 0), 0));

/** Total paid back, by person id (all groups and none). */
export function getPaybackTotalsByPerson(txns) {
  const out = {};
  for (const t of txns || []) if (isPersonPayback(t)) out[t.paidToPersonId] = r2((out[t.paidToPersonId] || 0) + Number(t.amount || 0));
  return out;
}

/** What a settlement {owesMe, iOwe} becomes once `paidBack` has been paid. excess = the part beyond what was owed. */
export function applyPaybacks({ owesMe, iOwe }, paidBack) {
  const owed = Math.max(0, Number(iOwe) || 0), paid = Math.max(0, Number(paidBack) || 0);
  const applied = Math.min(owed, paid), excess = r2(paid - applied);
  return { owesMe: r2((Number(owesMe) || 0) + excess), iOwe: r2(owed - applied), excess };
}
