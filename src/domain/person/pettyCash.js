// domain/person/pettyCash.js
//
// PETTY CASH given to a person: cash I hand someone (a spouse, a helper, a colleague) to spend for me (the house, a trip, a project) before any of it is spent. It is not an expense (the
// things she buys are the expenses, recorded as "Paid by" her, with category, vendor and who paid), not a loan (she does not owe it back),
// and not a transfer between my accounts. Same stored shape as a payback / a loan given (domain/person/payback.js, domain/loans/disbursal.js):
// a "transfer" with a source account (or none, for cash) and NO destination, so my account is debited once and budgets are untouched.
//
// What it does to the person's balance: what I owe her (the "Paid by her" purchases) is paid from the petty cash first.
//     iOwe    = max(0, owed - petty)               what I still owe her once her purchases have used up the petty cash
//     withHer = max(0, petty - owed)               what is still with her, to be used on later purchases; NOT a receivable, NOT in net worth
// Pure. Nothing here stores a balance.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

export const isPettyCash = t => Boolean(t && t.type === "transfer" && t.isPettyCash === true && t.pettyCashPersonId);

export function buildPettyCashTxn({ personId, personName, fromAccId = "", amount, date, note = "", id, now = Date.now() }) {
  const who = String(personName || "").trim();
  return {
    id: id ?? now,
    type: "transfer",
    desc: `Petty cash${who ? ` - ${who}` : ""}`,
    merchant: who || "Petty cash",
    note: ["Money given to spend on my behalf", String(note || "").trim()].filter(Boolean).join(" · "),
    date,
    amount: r2(amount),
    fromAccId: fromAccId || null,
    toAccId: null,
    accId: null,
    catId: null, catIds: [], subId: null, subIds: [],
    people: {},
    isPettyCash: true,
    pettyCashPersonId: personId,
    trackingMode: "none",
    createdDate: date,
    createdAt: now,
  };
}

/** Petty cash given to one person, oldest first. */
export const getPettyCashGiven = (txns, personId) => (txns || [])
  .filter(t => isPettyCash(t) && String(t.pettyCashPersonId) === String(personId))
  .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || Number(a.createdAt || 0) - Number(b.createdAt || 0));

/** Total petty cash given, by person id. */
export function getPettyCashTotalsByPerson(txns) {
  const out = {};
  for (const t of txns || []) if (isPettyCash(t)) out[t.pettyCashPersonId] = r2((out[t.pettyCashPersonId] || 0) + Number(t.amount || 0));
  return out;
}

/** What I owe once the petty cash has been used on it, and what is still with her. */
export function applyPettyCash(iOwe, pettyCash) {
  const owed = Math.max(0, Number(iOwe) || 0), held = Math.max(0, Number(pettyCash) || 0);
  const used = Math.min(owed, held);
  return { iOwe: r2(owed - used), withHer: r2(held - used), used: r2(used) };
}
