// src/domain/imports/arthOnly.js - the other half of "does this statement agree with my books": entries Arth HAS on this account/card for the
// statement's period that NO row of the file matched. (The rows of the file that Arth lacks are the "new" rows the preview already lists.)
// It uses the SAME matcher result as the preview (matchStatement), so "Looks already in Arth 7" and "7 matched" always agree. Read-only. Pure.
//   arthOnly: [{ id, date, amountPaise, label, pending }]  pending = dated after the last row of the file (it may simply not have posted yet)
//   pairs:    [{ rowKey, arthId, why }] a new row and an Arth-only entry that look like the SAME purchase typed differently
import { accountMovements } from "./matchStatement.js";
import { extractUtr, refDigits } from "./utr.js";
import { refConflict } from "./matchStatement.js";

const dayNum = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);

/**
 * @param {{results:Array, transactions:Array, accountId:string, linkedIds?:Array, from:string, to:string, lastRowDate?:string, claimedIds?:Array}} a
 *   results = matchStatement(...).results; from/to = the period to check (inclusive)
 */
export function unmatchedInArth({ results, transactions, accountId, linkedIds = [], from, to, lastRowDate = "", claimedIds = [] }) {
  const moves = accountMovements(transactions, accountId, linkedIds).filter(m => m.date >= from && m.date <= to);
  const claimed = new Set((claimedIds || []).map(String));   // e.g. a refund just recorded from this very preview
  const byImportKey = new Map((transactions || []).filter(t => t && t.importKey).map(t => [t.importKey, t.id]));
  for (const r of results || []) {
    if (r.matchId != null) claimed.add(String(r.matchId));
    if (r.status === "already-imported") {
      const id = byImportKey.get(r.row.importKey);
      if (id != null) claimed.add(String(id));
      else { // imported before, recognised by its UTR
        const utr = extractUtr(r.row);
        const hit = utr && moves.find(m => !claimed.has(String(m.id)) && m.amountPaise === r.row.amountPaise && refDigits(m.ref).includes(utr));
        if (hit) claimed.add(String(hit.id));
      }
    }
  }
  const byId = new Map((transactions || []).map(t => [String(t.id), t]));
  const label = id => { const t = byId.get(String(id)); return (t && (t.merchant || t.desc || t.who || t.note)) || "Transaction"; };
  const seen = new Set(); const arthOnly = [];
  for (const m of moves) {
    if (claimed.has(String(m.id)) || seen.has(String(m.id))) continue;
    seen.add(String(m.id));
    arthOnly.push({ id: m.id, ref: m.ref || "", date: m.date, amountPaise: m.amountPaise, label: label(m.id), pending: Boolean(lastRowDate) && m.date > lastRowDate });
  }
  arthOnly.sort((a, b) => a.date.localeCompare(b.date));

  // a new row and an Arth-only entry that look like one purchase: same amount on another day, or the same day with another amount
  const pairs = []; const usedArth = new Set();
  for (const r of results || []) {
    if (r.status !== "new") continue;
    let best = null, why = "";
    const rutr = extractUtr(r.row);
    for (const a of arthOnly) {
      if (usedArth.has(String(a.id)) || refConflict(rutr, a.ref)) continue;
      if (a.amountPaise === r.row.amountPaise) { const gap = Math.abs(dayNum(a.date) - dayNum(r.row.date)); if (!best || gap < best.gap) { best = { a, gap }; why = gap === 0 ? "same amount, same day" : `same amount, ${gap} day${gap === 1 ? "" : "s"} apart`; } }
    }
    if (!best) for (const a of arthOnly) { if (!usedArth.has(String(a.id)) && !refConflict(rutr, a.ref) && a.date === r.row.date) { best = { a, gap: 0 }; why = "same day, a different amount"; break; } }
    if (best) { usedArth.add(String(best.a.id)); pairs.push({ rowKey: r.row.importKey, arthId: best.a.id, why }); }
  }
  return { arthOnly, pairs, totalPaise: arthOnly.filter(a => !a.pending).reduce((s, a) => s + a.amountPaise, 0) };
}

/**
 * The other side of the gap on a CARD statement: payments / refunds (credits) that the file has and Arth does not. A card statement's total due is
 * net of them, but Arth only counts purchases, so they are the usual reason "Arth has more than the statement" while every purchase matches.
 * @returns {{rows:Array, totalPaise:number}} credits among the rows classed "new"
 */
export function newCredits(results, skipKeys = []) {
  const skip = new Set(skipKeys || []);
  const rows = (results || []).filter(r => r.status === "new" && r.row.amountPaise > 0 && !skip.has(r.row.importKey)).map(r => r.row);
  return { rows, totalPaise: rows.reduce((s, r) => s + r.amountPaise, 0) };
}
