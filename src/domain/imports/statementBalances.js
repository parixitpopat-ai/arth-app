// src/domain/imports/statementBalances.js — what a statement says the account's balance was at its start and end, and the change that would make
// Arth agree. Pure; nothing is written here.
// The offer exists only when every row has a balance, there are at least two rows, and the running balance adds up on every row. A statement
// whose balance does not add up is never used to move a balance.
//   opening  = balance before the first row (first row's balance minus its amount), dated the first row's date
//   closing  = balance after the last row, dated the last row's date
// "First"/"last" follow the file's order as detected by the balance check (oldest-first or newest-first).

/** @returns {{openingPaise:number, openingDate:string, closingPaise:number, closingDate:string}|null} */
export function statementBalances(parsed) {
  if (!parsed || !parsed.ok || !Array.isArray(parsed.rows) || parsed.rows.length < 2) return null;
  const b = parsed.balance || {};
  if (!(b.checked > 0) || (b.mismatches || []).length > 0) return null;
  if (parsed.rows.some(r => r.balancePaise === null || r.balancePaise === undefined)) return null;
  const chrono = b.order === "newest-first" ? parsed.rows.slice().reverse() : parsed.rows;
  const first = chrono[0], last = chrono[chrono.length - 1];
  return { openingPaise: first.balancePaise - first.amountPaise, openingDate: first.date, closingPaise: last.balancePaise, closingDate: last.date };
}

const rupees = p => p / 100;

/**
 * @param {{openingBalance?:number, openingBalanceDate?:string}} account
 * @param {{amount:number, date:string}|null} checkpoint the account's current "balance as of a date" note, if any
 * @param {ReturnType<typeof statementBalances>} sb
 * @param {Array} txns used only to count entries that the new opening date would stop counting
 * @param {string} accountId
 */
export function planBalanceMatch(account, checkpoint, sb, txns, accountId) {
  if (!account || !sb) return null;
  const before = (txns || []).filter(t => t && t.date && t.date < sb.openingDate && [t.accId, t.fromAccId, t.toAccId].some(id => id != null && String(id) === String(accountId))).length;
  return {
    opening: { from: Number(account.openingBalance || 0), fromDate: account.openingBalanceDate || "", to: rupees(sb.openingPaise), toDate: sb.openingDate },
    current: { from: checkpoint ? Number(checkpoint.amount || 0) : null, fromDate: checkpoint ? checkpoint.date || "" : "", to: rupees(sb.closingPaise), toDate: sb.closingDate },
    entriesBeforeOpening: before,
  };
}

/** The values to store, and what is needed to put things back exactly. */
export function applyBalanceMatch(account, checkpoint, plan) {
  return {
    account: { ...account, openingBalance: plan.opening.to, openingBalanceDate: plan.opening.toDate },
    checkpoint: { amount: plan.current.to, date: plan.current.toDate },
    undo: { openingBalance: account.openingBalance, openingBalanceDate: account.openingBalanceDate, hadOpeningDate: "openingBalanceDate" in account, checkpoint: checkpoint ? { ...checkpoint } : null },
  };
}

export function undoBalanceMatch(account, undo) {
  const a = { ...account, openingBalance: undo.openingBalance };
  if (undo.hadOpeningDate) a.openingBalanceDate = undo.openingBalanceDate; else delete a.openingBalanceDate;
  return { account: a, checkpoint: undo.checkpoint };
}
