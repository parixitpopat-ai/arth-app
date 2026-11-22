// domain/person/theyPaid.js
//
// "They paid. I owe them" on the Add screen. Someone else paid for part (or all) of an expense out of their own pocket.
//   * My own account is debited only for what I paid myself: amount minus what they paid.
//   * What they paid becomes ordinary "paid by" expenses (domain/person/paidBy.js): no account of mine is used, and I owe that
//     person until I pay them back (the existing Pay back flow). Petty cash they hold from me offsets it there, as before.
//   * Spending is the whole amount either way (my piece + their piece add up to the purchase).
// The entry is saved as separate transactions, one for my own part and one per payer, so every existing balance, statement and
// payable rule keeps working unchanged. Pure.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {{amount:number, rows:Array<{personId:string, amount:(number|string|undefined)}>}} args
 *   a row with no amount means "they paid it all", allowed only when there is exactly one such row.
 * @returns {{ok:true, myPart:number, payers:Array<{personId:string, amount:number}>}|{ok:false, error:string}}
 */
export function planTheyPaid({ amount, rows }) {
  const total = r2(amount);
  const list = (rows || []).filter(r => r && r.personId);
  if (!(total > 0)) return { ok: false, error: "Enter the amount first." };
  if (list.length === 0) return { ok: false, error: "Choose who paid." };
  const payers = list.map(r => {
    const a = Number(r.amount);
    return { personId: r.personId, amount: a > 0 ? r2(a) : (list.length === 1 ? total : 0) };
  });
  if (payers.some(p => !(p.amount > 0))) return { ok: false, error: "Enter how much each person paid." };
  const paid = r2(payers.reduce((s, p) => s + p.amount, 0));
  if (paid > total + 0.005) return { ok: false, error: `They paid ${paid} but the expense is ${total}.` };
  return { ok: true, myPart: r2(total - paid), payers };
}
