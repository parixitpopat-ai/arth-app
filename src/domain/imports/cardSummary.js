// src/domain/imports/cardSummary.js — the figures printed on a credit-card statement (not the transaction rows): statement date, due date, total and
// minimum due, previous balance, purchases, cash advances, payments, period, credit limit. Pure; reads positioned PDF text.
// A figure is taken only when its label is found and a readable value sits directly BELOW it (statements print label over value). Anything not
// found is simply absent; nothing is guessed.
// Layout knowledge: one ICICI credit-card statement (page 1). Other issuers/layouts may print labels differently; then the fields are absent and the
// import still works from the transaction rows alone.

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = n => String(n).padStart(2, "0");
const cx = i => i.x + (i.w || 0) / 2;

/** "October 16, 2026" / "16 Oct 2026" -> "2026-10-16", else null */
export function parseLongDate(s) {
  const t = String(s || "").trim();
  let m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(t), mon, d, y;
  if (m) { mon = MONTHS[m[1].toLowerCase()]; d = +m[2]; y = +m[3]; }
  else if ((m = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4})$/.exec(t))) { d = +m[1]; mon = MONTHS[m[2].toLowerCase()]; y = +m[3]; }
  else return null;
  if (!mon || d < 1 || d > new Date(y, mon, 0).getDate()) return null;
  return `${y}-${pad(mon)}-${pad(d)}`;
}
const moneyPaise = s => { const m = /^(?:₹|Rs\.?|INR)?\s*(-?[\d,]+(?:\.\d{1,2})?)\s*(CR|DR)?$/i.exec(String(s || "").trim()); if (!m) return null; const p = Math.round(parseFloat(m[1].replace(/,/g, "")) * 100); return Number.isFinite(p) ? (/cr/i.test(m[2] || "") ? -p : p) : null; };

const LABELS = [
  ["statementDate", /^statement\s*date$/i, parseLongDate],
  ["dueDate", /^payment\s*due\s*date$/i, parseLongDate],
  ["totalDuePaise", /^total\s*amount\s*due$/i, moneyPaise],
  ["minDuePaise", /^minimum\s*amount\s*due$/i, moneyPaise],
  ["previousBalancePaise", /^previous\s*balance$/i, moneyPaise],
  ["purchasesPaise", /^purchases\s*\/?\s*charges$/i, moneyPaise],
  ["cashAdvancesPaise", /^cash\s*advances?$/i, moneyPaise],
  ["paymentsPaise", /^payments\s*\/?\s*credits?$/i, moneyPaise],
  ["creditLimitPaise", /^credit\s*limit(?:\s*\(.*\))?$/i, moneyPaise],
];

/** @param {Array<{items:Array<{str:string,x:number,y:number,w:number}>}>} pages @returns {object} only the fields that were found */
export function extractCardSummary(pages) {
  const out = {}, items = (pages && pages[0] && pages[0].items) || [];                    // the summary is on the first page
  for (const [key, labelRe, read] of LABELS) {
    const label = items.find(i => labelRe.test(i.str.replace(/\s+/g, " ").trim()));
    if (!label) continue;
    const below = items.filter(i => i !== label && i.y < label.y && label.y - i.y <= 45 && Math.abs(cx(i) - cx(label)) <= Math.max(label.w || 0, i.w || 0) / 2 + 12 && i.str !== "₹")
      .sort((a, b) => b.y - a.y);
    for (const cand of below) { const v = read(cand.str); if (v !== null && v !== undefined) { out[key] = v; break; } }
  }
  const text = items.map(i => i.str).join(" ").replace(/\s+/g, " ");
  const per = /Statement period\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s+to\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i.exec(text);
  if (per) { const a = parseLongDate(per[1]), b = parseLongDate(per[2]); if (a && b) { out.periodFrom = a; out.periodTo = b; } }
  const card = /\b(\d{4})[X*x]{4,}[X*x\d]*?(\d{4})\b/.exec(text) || /\b\d{4}[X*x]{6,8}(\d{4})\b/.exec(text);
  if (card) out.cardLast4 = card[card.length - 1];
  return out;
}

/** Does the statement add up? Returns plain-language findings; `ok` is true only when every check that could be made passed. */
export function checkCardSummary(summary, parsedRows) {
  const f = [], rows = parsedRows || [];
  const need = k => typeof summary[k] === "number";
  if (["previousBalancePaise", "purchasesPaise", "paymentsPaise", "totalDuePaise"].every(need)) {
    const calc = summary.previousBalancePaise + summary.purchasesPaise + (summary.cashAdvancesPaise || 0) - summary.paymentsPaise;
    f.push({ id: "equation", ok: calc === summary.totalDuePaise, calc, total: summary.totalDuePaise });
  }
  if (need("purchasesPaise")) {
    const charges = rows.filter(r => r.amountPaise < 0).reduce((s, r) => s - r.amountPaise, 0), expected = summary.purchasesPaise + (summary.cashAdvancesPaise || 0);
    f.push({ id: "charges", ok: charges === expected, rows: charges, stated: expected });
  }
  if (need("paymentsPaise")) {
    const credits = rows.filter(r => r.amountPaise > 0).reduce((s, r) => s + r.amountPaise, 0);
    f.push({ id: "credits", ok: credits === summary.paymentsPaise, rows: credits, stated: summary.paymentsPaise });
  }
  return { ok: f.length > 0 && f.every(x => x.ok), findings: f };
}
