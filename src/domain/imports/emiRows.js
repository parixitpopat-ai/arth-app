// src/domain/imports/emiRows.js — a card EMI instalment printed on a statement as SEVERAL rows becomes ONE group. Pure; reads only.
// Seen format (one bank, one card): "Principal Amount Amortization - <6/6>SHOP NAME", "Interest Amount Amortization - <6/6>SHOP NAME" and
// "IGST-CI@18%" on the same date. Only this wording is recognised: a statement worded differently is left as plain rows (nothing is guessed).
// Principal is NOT new spending (the purchase was recorded when it was bought); interest and GST are the new cost. The group total is what the
// card was charged for the instalment, and is what Arth's single instalment entry holds.
//
// A GST row carries no instalment number, so it is attached to an interest row only when it is that row's interest x the printed rate (within 2 paise)
// on the same date, and only when exactly one interest row fits. Otherwise it stays a plain row.

const PRINCIPAL = /principal\s+amount\s+amortiz\w*[^<]*<\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*>\s*(.*)$/i;
const INTEREST = /interest\s+amount\s+amortiz\w*[^<]*<\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*>\s*(.*)$/i;
const GST = /\b(?:[ics]?gst)\b[^@]*@\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i;

const cents = r => Math.abs(Math.round(Number(r && r.amountPaise) || 0));
const merchantKey = s => String(s || "").trim().replace(/\s+/g, " ").toUpperCase();

/**
 * @param {Array<{importKey:string,date:string,amountPaise:number,desc?:string}>} rows statement rows (a card charge has a negative amountPaise)
 * @returns {{groups:Array, grouped:Set<string>}} groups: { id, date, merchant, n, N, principalPaise, interestPaise, gstPaise, gstRate, totalPaise, rowKeys, checks }
 */
export function groupEmiRows(rows) {
  const list = Array.isArray(rows) ? rows.filter(r => r && r.importKey && r.date && Number(r.amountPaise) < 0) : [];   // charges only
  const used = new Set(), groups = [];
  for (const p of list) {
    if (used.has(p.importKey)) continue;
    const pm = PRINCIPAL.exec(String(p.desc || ""));
    if (!pm) continue;
    const n = +pm[1], N = +pm[2], mk = merchantKey(pm[3]);
    const interest = list.filter(r => !used.has(r.importKey) && r.importKey !== p.importKey && r.date === p.date && (() => { const m = INTEREST.exec(String(r.desc || "")); return m && +m[1] === n && +m[2] === N && merchantKey(m[3]) === mk; })());
    if (interest.length > 1) continue;                                         // two interest rows for one instalment: ambiguous, leave all as plain rows
    const iRow = interest[0] || null, interestPaise = iRow ? cents(iRow) : 0;
    let gstRow = null, gstRate = 0;
    if (iRow) {
      const fit = list.filter(r => !used.has(r.importKey) && r.date === p.date && r !== iRow && r !== p).map(r => ({ r, m: GST.exec(String(r.desc || "")) })).filter(x => x.m)
        .filter(x => Math.abs(cents(x.r) - Math.round(interestPaise * parseFloat(x.m[1]) / 100)) <= 2);
      if (fit.length === 1) { gstRow = fit[0].r; gstRate = parseFloat(fit[0].m[1]); }
    }
    const rowsOf = [p, iRow, gstRow].filter(Boolean);
    rowsOf.forEach(r => used.add(r.importKey));
    const principalPaise = cents(p), gstPaise = gstRow ? cents(gstRow) : 0;
    const checks = [];
    checks.push({ id: "count", ok: n >= 1 && n <= N, text: n >= 1 && n <= N ? `Instalment ${n} of ${N}` : `Instalment ${n} of ${N} does not add up` });
    if (iRow) checks.push(gstRow ? { id: "gst", ok: true, text: `GST ${gstRate}% of the interest matches` } : { id: "gst", ok: false, text: "No GST row that matches the interest was found" });
    groups.push({ id: p.importKey, date: p.date, merchant: pm[3].trim(), n, N, principalPaise, interestPaise, gstPaise, gstRate, totalPaise: principalPaise + interestPaise + gstPaise, rowKeys: rowsOf.map(r => r.importKey), checks });
  }
  return { groups, grouped: used };
}
