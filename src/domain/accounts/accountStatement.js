// src/domain/accounts/accountStatement.js — a bank-style statement for one account over a date range (a calendar month by default). Pure.
// Input is the account's ledger rows (each { t:{date,id,merchant,desc}, signed:+credit/−debit, secondary }). Money is added in paise so totals are exact.
//   bank / cash : opening balance (the balance at the end of the day before `from`) + rows = closing balance, with a running balance per row.
//   credit card : no balance (the card's ledger has none): charges, credits and the net for the period, rows without a running balance.
// Rows dated before `ignoreBefore` (the account's opening-balance date) are not part of the account's balance and are left out of a bank statement.

const pad = n => String(n).padStart(2, "0");
const toPaise = n => Math.round((Number(n) || 0) * 100);
const dayKey = d => String(d || "").slice(0, 10);

export function monthBounds(year, month) {                       // month 1-12
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}
export function shiftMonth({ year, month }, delta) {
  const i = year * 12 + (month - 1) + delta;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}
export function dayBefore(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/**
 * @param {{rows:Array, from:string, to:string, openingBalance?:number|null, ignoreBefore?:string}} a
 * @returns {{from,to,hasBalance:boolean,openingPaise:number|null,closingPaise:number|null,totalInPaise:number,totalOutPaise:number,count:number,lines:Array<{id,date,description,debitPaise,creditPaise,balancePaise:number|null,t:object}>}}
 */
export function buildStatement({ rows, from, to, openingBalance = null, ignoreBefore = "" }) {
  const hasBalance = openingBalance !== null && openingBalance !== undefined;
  const inRange = (rows || []).filter(r => r && r.t && dayKey(r.t.date) >= from && dayKey(r.t.date) <= to && (!ignoreBefore || dayKey(r.t.date) >= ignoreBefore))
    .sort((a, b) => dayKey(a.t.date).localeCompare(dayKey(b.t.date)) || String(a.t.id).localeCompare(String(b.t.id), undefined, { numeric: true }));
  let run = hasBalance ? toPaise(openingBalance) : null, totalIn = 0, totalOut = 0;
  const lines = inRange.map(r => {
    const p = toPaise(r.signed), debit = p < 0 ? -p : 0, credit = p > 0 ? p : 0;
    totalIn += credit; totalOut += debit;
    if (run !== null) run += p;
    const desc = [r.t.merchant || r.t.desc, r.secondary].filter(Boolean).filter((x, i, arr) => arr.indexOf(x) === i).join(" · ");
    return { id: r.id || r.t.id, date: dayKey(r.t.date), description: desc, debitPaise: debit, creditPaise: credit, balancePaise: run, t: r.t };
  });
  return { from, to, hasBalance, openingPaise: hasBalance ? toPaise(openingBalance) : null, closingPaise: run, totalInPaise: totalIn, totalOutPaise: totalOut, count: lines.length, lines };
}

const money = p => (p / 100).toFixed(2);
const q = s => (/[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
/** CSV of a built statement: Date,Description,Debit,Credit,Balance (Balance empty for a card). Dates as DD-MM-YYYY like a bank's. */
export function statementCsv(st) {
  const dmy = d => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;
  const out = ["Date,Description,Debit,Credit,Balance"];
  if (st.hasBalance) out.push(`${dmy(st.from)},Opening balance,,,${money(st.openingPaise)}`);
  for (const l of st.lines) out.push([dmy(l.date), q(l.description), l.debitPaise ? money(l.debitPaise) : "", l.creditPaise ? money(l.creditPaise) : "", l.balancePaise === null ? "" : money(l.balancePaise)].join(","));
  if (st.hasBalance) out.push(`${dmy(st.to)},Closing balance,,,${money(st.closingPaise)}`);
  return out.join("\n") + "\n";
}
