// src/domain/accounts/compareStatement.js — compares a statement file from the bank (already read by readStatementFile) with Arth's own statement lines
// for the same period. Read-only: it never writes. Pure.
//   matched     : a bank row and an Arth entry with the same signed amount, dates within DAY_WINDOW days (closest date first, an equal reference first of all);
//                 each is used once
//   onlyInBank  : in the bank's statement, nothing like it in Arth (missing in Arth)
//   onlyInArth  : in Arth, nothing like it in the bank's statement (not cleared yet, or entered twice / wrongly)
// Totals and, when the bank's file has a balance column that adds up, opening/closing balances are returned for both sides.

export const DAY_WINDOW = 2;
const dayNum = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);

/** Opening/closing balance of the bank's rows inside [from,to] when every row has a balance and the file's running balance adds up; else null. */
export function bankBalancesWithin(parsed, from, to) {
  if (!parsed || !parsed.ok || !parsed.balance || !(parsed.balance.checked > 0) || (parsed.balance.mismatches || []).length) return null;
  if (parsed.rows.some(r => r.balancePaise === null || r.balancePaise === undefined)) return null;
  const chrono = parsed.balance.order === "newest-first" ? parsed.rows.slice().reverse() : parsed.rows;
  const inside = chrono.filter(r => r.date >= from && r.date <= to);
  if (!inside.length) return null;
  const first = inside[0], last = inside[inside.length - 1];
  return { openingPaise: first.balancePaise - first.amountPaise, closingPaise: last.balancePaise };
}

/**
 * @param {{parsed:object, arthLines:Array<{id,date,description,debitPaise,creditPaise,t?:object}>, from:string, to:string}} a
 */
export function compareStatements({ parsed, arthLines, from, to }) {
  const bank = (parsed && parsed.ok ? parsed.rows : []).filter(r => r.date >= from && r.date <= to);
  const arth = (arthLines || []).map(l => ({ ...l, signedPaise: (l.creditPaise || 0) - (l.debitPaise || 0), ref: (l.t && l.t.transactionRef) || "" }));
  const used = new Set(), matched = [], onlyInBank = [];
  for (const b of bank) {
    let best = null, bestScore = Infinity;
    for (const a of arth) {
      if (used.has(a.id) || a.signedPaise !== b.amountPaise) continue;
      const gap = Math.abs(dayNum(a.date) - dayNum(b.date));
      if (gap > DAY_WINDOW) continue;
      const score = gap - (b.ref && a.ref && String(b.ref) === String(a.ref) ? 10 : 0);
      if (score < bestScore) { best = a; bestScore = score; }
    }
    if (best) { used.add(best.id); matched.push({ bank: b, arth: best }); } else onlyInBank.push(b);
  }
  const onlyInArth = arth.filter(a => !used.has(a.id));
  const sum = (rows, pick) => rows.reduce((s, r) => s + pick(r), 0);
  return {
    matched, onlyInBank, onlyInArth,
    bankIn: sum(bank, r => (r.amountPaise > 0 ? r.amountPaise : 0)), bankOut: sum(bank, r => (r.amountPaise < 0 ? -r.amountPaise : 0)),
    arthIn: sum(arth, a => a.creditPaise || 0), arthOut: sum(arth, a => a.debitPaise || 0),
    bankCount: bank.length, arthCount: arth.length,
    bankBalances: bankBalancesWithin(parsed, from, to),
  };
}
