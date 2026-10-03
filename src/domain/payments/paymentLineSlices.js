// domain/payments/paymentLineSlices.js
//
// A Transaction paid with several methods (Pay Fees' "Paid with" lines) is still ONE Transaction
// carrying paymentLines[{method, accId, amount}] whose amounts sum exactly to its total. Its legacy
// `accId` is only the FIRST line's account, so every per-account figure that read `t.accId` — bank/
// cash balance, a credit card's outstanding, an account's ledger — charged the whole amount to that
// one account. This module is the read-side fix: for ACCOUNT effects only, a multi-line expense is
// viewed as one slice per paying account (same transaction, same id/date/type, accId and amount of
// that line). Spend, budget, category and person figures keep reading the original transaction —
// the money spent is one event no matter how it was paid.
//
// Nothing is persisted or rewritten. A transaction whose lines are missing, malformed or don't add
// up exactly is left untouched (it keeps behaving as before) rather than guessed at.

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

function validLines(t) {
  const lines = t && t.type === "expense" && Array.isArray(t.paymentLines) ? t.paymentLines : null;
  if (!lines || lines.length < 2) return null;
  if (lines.some(l => !l || !l.accId || !(Number(l.amount) > 0))) return null;
  const sum = round2(lines.reduce((s, l) => s + Number(l.amount), 0));
  return Math.abs(sum - round2(t.amount)) < 0.005 ? lines : null;
}

/** @returns {Array<{accId:string, amount:number}>} how a transaction's money is spread across accounts */
export function getAccountAmounts(t) {
  const lines = validLines(t);
  if (!lines) return [{ accId: t?.accId, amount: Number(t?.amount) || 0 }];
  const byAcc = new Map();
  for (const l of lines) byAcc.set(l.accId, round2((byAcc.get(l.accId) || 0) + Number(l.amount)));
  return [...byAcc.entries()].map(([accId, amount]) => ({ accId, amount }));
}

/**
 * The transaction list as account-effect slices: multi-line expenses become one entry per paying
 * account; everything else is returned as the same object (no copy).
 */
export function expandPaymentLines(txns) {
  const out = [];
  for (const t of txns || []) {
    if (!validLines(t)) { out.push(t); continue; }
    for (const { accId, amount } of getAccountAmounts(t)) out.push({ ...t, accId, amount, paymentLines: undefined, _sliceOf: t.amount });
  }
  return out;
}
