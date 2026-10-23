// src/domain/imports/statement.js — turns raw rows (from csv.js or xlsx.js) into normalised bank-statement rows.
//
// ASSUMPTION, NOT VERIFIED: IDFC FIRST Bank's real export layout has not been seen. This parser therefore detects the header row by
// column-name aliases (Transaction Date / Value Date / Particulars / Narration / Cheque or Ref No / Debit / Withdrawal / Credit / Deposit /
// Balance) instead of fixed positions, and refuses to continue (with a plain reason) when it cannot find date + amount columns.
// Dates are read day-first (DD/MM/YYYY), the Indian convention; a value like 03/04/2026 is read as 3 April. Nothing is saved here.

const ALIASES = {
  date: ["transaction date", "txn date", "tran date", "date", "posting date"],
  valueDate: ["value date", "value dt"],
  desc: ["particulars", "narration", "description", "transaction remarks", "remarks", "details", "transaction details"],
  ref: ["cheque no", "cheque no.", "chq no", "chq/ref no", "cheque/ref no", "ref no", "reference no", "reference", "utr", "transaction id"],
  debit: ["debit", "withdrawal", "withdrawals", "withdrawal amt", "withdrawal amount", "debit amount", "dr"],
  credit: ["credit", "deposit", "deposits", "deposit amt", "deposit amount", "credit amount", "cr"],
  amount: ["amount"],
  balance: ["balance", "closing balance", "running balance"],
};
const norm = s => String(s == null ? "" : s).toLowerCase().replace(/[()₹]/g, "").replace(/\s+/g, " ").replace(/\b(inr|rs)\b\.?/g, "").trim();
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const pad = n => String(n).padStart(2, "0");
const validYmd = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };

/** Parse a statement date cell (text or Excel serial number) to "YYYY-MM-DD", or null. Day-first for numeric d/m/y. */
export function parseStatementDate(v) {
  if (typeof v === "number") {
    if (v < 20000 || v > 80000) return null;                                  // ~1954..2119: anything else is not a date serial
    const t = new Date(Math.round((v - 25569) * 86400) * 1000);
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  }
  const s = String(v == null ? "" : v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return validYmd(+m[1], +m[2], +m[3]) ? `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` : null;
  m = /^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2}|\d{4})$/.exec(s);
  if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return validYmd(y, +m[2], +m[1]) ? `${y}-${pad(+m[2])}-${pad(+m[1])}` : null; }
  m = /^(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ,]*(\d{2}|\d{4})$/.exec(s);
  if (m && MONTHS[m[2].toLowerCase()]) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return validYmd(y, MONTHS[m[2].toLowerCase()], +m[1]) ? `${y}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(+m[1])}` : null; }
  return null;
}

/** Parse an amount cell to integer paise (so sums are exact), or null if blank/unreadable. Handles 1,23,456.78, ₹, Rs, (brackets), trailing Dr/Cr. */
export function parseAmountPaise(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) : null;
  let s = String(v == null ? "" : v).trim();
  if (!s || /^[-–—]+$/.test(s)) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  const suffix = /\s*(dr|cr)\.?$/i.exec(s); let side = null;
  if (suffix) { side = suffix[1].toLowerCase(); s = s.slice(0, suffix.index); }
  s = s.replace(/[₹,\s]/g, "").replace(/^(inr|rs\.?)/i, "");
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  if (!/^\d+(\.\d{1,2})?$/.test(s) && !/^\.\d{1,2}$/.test(s)) return null;
  let p = Math.round(parseFloat(s) * 100);
  if (neg) p = -p;
  return side === "dr" ? { dr: Math.abs(p) } : side === "cr" ? { cr: Math.abs(p) } : p;
}
const plainPaise = v => { const r = parseAmountPaise(v); return r && typeof r === "object" ? null : r; };

function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const cells = rows[i].map(norm), col = {};
    for (const [key, names] of Object.entries(ALIASES)) { const idx = cells.findIndex((c, j) => c && names.includes(c) && !Object.values(col).includes(j)); if (idx >= 0) col[key] = idx; }
    if (col.date !== undefined && ((col.debit !== undefined && col.credit !== undefined) || col.amount !== undefined) && col.desc !== undefined) return { index: i, col };
  }
  return null;
}

/**
 * @param {Array<Array<string|number>>} rawRows
 * @returns {{ ok:boolean, reason?:string, rows:Array, skipped:Array, balance:{checked:number, mismatches:number[], order:string}, period:{from:string,to:string}|null }}
 * row: { line, date, valueDate, desc, ref, amountPaise (credit +, debit −), balancePaise|null }
 */
export function parseStatementRows(rawRows) {
  const empty = { rows: [], skipped: [], balance: { checked: 0, mismatches: [], order: "unknown" }, period: null };
  const h = findHeader(rawRows || []);
  if (!h) return { ok: false, reason: "Could not find the column headings (a date column, a description column and debit/credit or amount columns). This file does not look like a bank statement Arth can read yet.", ...empty };
  const { col } = h, rows = [], skipped = [];
  for (let i = h.index + 1; i < rawRows.length; i++) {
    const r = rawRows[i], line = i + 1, get = k => (col[k] === undefined ? "" : r[col[k]] ?? "");
    const date = parseStatementDate(get("date"));
    const text = norm(r.join(" "));
    if (!date) { if (text && !/^(opening|closing|total|statement|page|generated|account|customer|branch|ifsc|\*)/.test(text)) skipped.push({ line, why: "no readable date", text: r.join(" ").slice(0, 80) }); continue; }
    let paise = null;
    if (col.amount !== undefined && col.debit === undefined) { const a = parseAmountPaise(get("amount")); paise = a && typeof a === "object" ? (a.dr !== undefined ? -a.dr : a.cr) : a; }
    else {
      const d = plainPaise(get("debit")), c = plainPaise(get("credit"));
      if (d && c) { skipped.push({ line, why: "both debit and credit filled", text: r.join(" ").slice(0, 80) }); continue; }
      paise = d ? -Math.abs(d) : c ? Math.abs(c) : null;
    }
    if (paise === null || paise === 0) { skipped.push({ line, why: "no amount", text: r.join(" ").slice(0, 80) }); continue; }
    const bal = col.balance !== undefined ? parseAmountPaise(get("balance")) : null;
    rows.push({ line, date, valueDate: parseStatementDate(get("valueDate")), desc: String(get("desc")).replace(/\s+/g, " ").trim(), ref: String(get("ref")).trim(), amountPaise: paise,
      balancePaise: bal && typeof bal === "object" ? (bal.cr !== undefined ? bal.cr : -bal.dr) : bal });
  }
  if (!rows.length) return { ok: false, reason: "The headings were found but no transaction rows could be read.", ...empty, skipped };
  const balance = checkBalances(rows);
  const dates = rows.map(r => r.date).sort();
  return { ok: true, rows, skipped, balance, period: { from: dates[0], to: dates[dates.length - 1] } };
}

/** Running-balance check. A statement is either oldest-first (prev + amount = this) or newest-first (this + amount of the earlier... i.e. next-row). */
export function checkBalances(rows) {
  const withBal = rows.filter(r => r.balancePaise !== null);
  if (withBal.length < rows.length || rows.length < 2) return { checked: 0, mismatches: [], order: "unknown" };
  const test = asc => { const bad = []; for (let i = 1; i < rows.length; i++) { const [a, b] = asc ? [rows[i - 1], rows[i]] : [rows[i], rows[i - 1]]; if (a.balancePaise + b.amountPaise !== b.balancePaise) bad.push(rows[i].line); } return bad; };
  const up = test(true), down = test(false);
  return up.length <= down.length ? { checked: rows.length - 1, mismatches: up, order: "oldest-first" } : { checked: rows.length - 1, mismatches: down, order: "newest-first" };
}

const keyText = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/**
 * Stable per-row keys. Two genuinely identical rows in one file (same day, amount, text) get occurrence indexes 0,1,… so they stay distinct,
 * while re-importing the same file (or an overlapping one) yields the same keys. Balance is deliberately not part of the key.
 */
export function withImportKeys(rows, accountId) {
  const seen = new Map();
  return rows.map(r => {
    const base = `${accountId}|${r.date}|${r.amountPaise}|${keyText(r.ref)}|${keyText(r.desc)}`;
    const n = seen.get(base) || 0; seen.set(base, n + 1);
    return { ...r, importKey: `${base}|${n}` };
  });
}
