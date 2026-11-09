// src/domain/imports/matchStatement.js — decides, row by row, what an import would do. Pure; never writes and never changes existing records.
//   already-imported : this exact row was imported before (its importKey is stored)
//   probable-match   : an existing transaction on this account has the same amount and a date within ±DAY_WINDOW days → default is SKIP
//   new              : nothing similar exists → would be created
// Existing transactions are only read. A probable match is claimed by at most one statement row (so two identical statement rows
// do not both hide behind a single manual entry).
export const DAY_WINDOW = 2;

const dayNum = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
const paise = n => Math.round(Number(n) * 100);

/** Existing transactions that touch accountId, as { id, date, amountPaise (credit +, debit −), ref } for comparison. */
export function accountMovements(transactions, accountId, linkedIds = []) {
  // A UPI handle or debit card linked to this bank is only a rail: spending through it moves this account's money, so entries recorded against the
  // rail count as this account's. A part-paid expense (paymentLines) counts only the slice paid from this account.
  const mine = id => id != null && (String(id) === String(accountId) || (linkedIds || []).some(l => String(l) === String(id)));
  const out = [];
  for (const t of Array.isArray(transactions) ? transactions : []) {
    if (!t || !t.date || !Number.isFinite(Number(t.amount))) continue;
    let a = paise(t.amount);
    if (t.type === "expense" && Array.isArray(t.paymentLines) && t.paymentLines.length > 1) {
      const slice = t.paymentLines.filter(l => mine(l && l.accId)).reduce((sum, l) => sum + paise(l.amount), 0);
      if (slice > 0 && slice < a) { out.push({ id: t.id, date: t.date, amountPaise: -slice, ref: t.transactionRef || "" }); continue; }
    }
    if (t.type === "expense" && mine(t.accId)) out.push({ id: t.id, date: t.date, amountPaise: -a, ref: t.transactionRef || "" });
    else if (t.type === "income" && mine(t.accId)) out.push({ id: t.id, date: t.date, amountPaise: a, ref: t.transactionRef || "" });
    else if (t.type === "transfer" || t.type === "cc_payment") {
      if (mine(t.fromAccId)) out.push({ id: t.id, date: t.date, amountPaise: -a, ref: t.transactionRef || "" });
      if (mine(t.toAccId)) out.push({ id: t.id, date: t.date, amountPaise: a, ref: t.transactionRef || "" });
    }
  }
  return out;
}

/** @param keyedRows rows from withImportKeys @param {{transactions:Array, accountId:string, importedKeys:Iterable<string>}} ctx */
export function matchStatement(keyedRows, { transactions, accountId, importedKeys, linkedIds }) {
  const imported = new Set(importedKeys || []), claimed = new Set(), moves = accountMovements(transactions, accountId, linkedIds);
  const results = keyedRows.map(row => {
    if (imported.has(row.importKey)) return { row, status: "already-imported" };
    const cands = moves.filter(m => !claimed.has(m.id + "|" + m.amountPaise) && m.amountPaise === row.amountPaise && Math.abs(dayNum(m.date) - dayNum(row.date)) <= DAY_WINDOW)
      .sort((a, b) => (b.ref && b.ref === row.ref) - (a.ref && a.ref === row.ref) || Math.abs(dayNum(a.date) - dayNum(row.date)) - Math.abs(dayNum(b.date) - dayNum(row.date)));
    if (cands.length) { claimed.add(cands[0].id + "|" + cands[0].amountPaise); return { row, status: "probable-match", matchId: cands[0].id }; }
    return { row, status: "new" };
  });
  const count = s => results.filter(r => r.status === s).length;
  return { results, summary: { total: results.length, new: count("new"), probableMatch: count("probable-match"), alreadyImported: count("already-imported") } };
}
