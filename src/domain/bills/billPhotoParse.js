// Reads the text of a printed UTILITY BILL photo (water / electricity style) into the few fields Arth's Add bill form needs.
// Pure. Only fields it can verify are returned with confidence; anything unclear is left null and shown empty for the person to fill.
// It never keeps the name or address printed on the bill.
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const DATE = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g;
const isoDate = (d, m, y) => { const dd = Number(d), mm = Number(m), yy = Number(y); const t = new Date(yy, mm - 1, dd); return t.getFullYear() === yy && t.getMonth() === mm - 1 && t.getDate() === dd ? `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}` : null; };
const datesIn = s => [...String(s).matchAll(DATE)].map(m => isoDate(m[1], m[2], m[3])).filter(Boolean);
const upper = s => String(s || "").toUpperCase();

const DIGIT_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const SMALL = { ...DIGIT_WORDS, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALE = { hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000, lac: 100000, crore: 10000000 };

/** "Five Nine Zero Four" (digit by digit) or "Five Thousand Nine Hundred Four" (ordinary words) -> number; null when it is not clearly either. */
export function wordsToAmount(words) {
  const toks = String(words || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(t => t && t !== "and" && t !== "rupees" && t !== "rupee" && t !== "only" && t !== "rs");
  if (!toks.length) return null;
  if (toks.length >= 2 && toks.every(t => t in DIGIT_WORDS)) return Number(toks.map(t => DIGIT_WORDS[t]).join(""));
  let total = 0, cur = 0;
  for (const t of toks) {
    if (t in SMALL) cur += SMALL[t];
    else if (t === "hundred") cur = (cur || 1) * 100;
    else if (t in SCALE) { total += (cur || 1) * SCALE[t]; cur = 0; }
    else return null;
  }
  return total + cur;
}

const nextLines = (lines, i, n = 3) => lines.slice(i + 1, i + 1 + n);
const numbersIn = s => [...String(s).matchAll(/(?<![\d\/.])(\d{1,9}(?:\.\d{1,2})?)(?![\d\/])/g)].map(m => Number(m[1]));

/**
 * @param {string} text raw OCR text
 * @returns {{consumerId:string|null, billDate:string|null, dueDate:string|null, amount:number|null, amountInWords:number|null, billNo:string|null,
 *   periodFrom:string|null, periodTo:string|null, previousReading:number|null, currentReading:number|null, units:number|null,
 *   checks:{amountMatchesWords:boolean|null, readingsMatchUnits:boolean|null, dueAfterBill:boolean|null}, found:boolean}}
 */
export function parseBillText(text) {
  const lines = String(text || "").split(/\r?\n/).map(l => l.replace(/[|_]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const out = { consumerId: null, billDate: null, dueDate: null, amount: null, amountInWords: null, billNo: null, periodFrom: null, periodTo: null, previousReading: null, currentReading: null, units: null,
    checks: { amountMatchesWords: null, readingsMatchUnits: null, dueAfterBill: null }, found: false };

  // consumer id + bill date + due date: the line under "CONSUMER ID  BILL DATE  DUE DATE"
  const h = lines.findIndex(l => /BILL\s*DATE/.test(upper(l)) && /DUE\s*DATE/.test(upper(l)));
  if (h >= 0) {
    for (const l of nextLines(lines, h, 2)) {
      const ds = datesIn(l);
      if (ds.length >= 2) {
        out.billDate = ds[0]; out.dueDate = ds[1];
        const id = l.replace(DATE, " ").match(/\b\d{5,}\b/);
        out.consumerId = id ? id[0] : null;
        break;
      }
    }
  }
  // bill number: the line under "BILL NO ..."
  const b = lines.findIndex(l => /^BILL\s*NO\b/.test(upper(l)));
  if (b >= 0) { const m = (lines[b + 1] || "").match(/\b\d{6,}\b/); out.billNo = m ? m[0] : null; }
  // period: the line under "FROM DATE ... TO DATE"
  const p = lines.findIndex(l => /FROM\s*DATE/.test(upper(l)) && /TO\s*DATE/.test(upper(l)));
  if (p >= 0) { const ds = datesIn(lines[p + 1] || ""); if (ds.length >= 2) { out.periodFrom = ds[0]; out.periodTo = ds[1]; } }
  // readings: the line under "CURRENT PREVIOUS UNITS ..."
  const r = lines.findIndex(l => /CURRENT/.test(upper(l)) && /PREVIOUS/.test(upper(l)));
  if (r >= 0) {
    const ns = numbersIn(lines[r + 1] || "");
    if (ns.length >= 3) { out.currentReading = ns[0]; out.previousReading = ns[1]; out.units = ns[2]; }
  }
  // amount: "NET PAYABLE" (same line or the next two lines), the last plain number
  const n = lines.findIndex(l => /NET\s*PAYABLE/.test(upper(l)));
  if (n >= 0) {
    const cand = [lines[n].replace(/.*NET\s*PAYABLE/i, ""), ...nextLines(lines, n, 2)];
    for (const c of cand) { const ns = numbersIn(c.replace(/\d+\s*\/\s*\d+/g, " ")); if (ns.length) { out.amount = r2(ns[ns.length - 1]); break; } }
  }
  // amount in words
  const w = lines.find(l => /^RUPEES\b/i.test(l) || /\bRUPEES\b.*\bONLY\b/i.test(l));
  if (w) out.amountInWords = wordsToAmount(w);

  if (out.amount != null && out.amountInWords != null) out.checks.amountMatchesWords = out.amount === out.amountInWords;
  if (out.currentReading != null && out.previousReading != null && out.units != null) out.checks.readingsMatchUnits = r2(out.currentReading - out.previousReading) === out.units;
  if (out.billDate && out.dueDate) out.checks.dueAfterBill = out.dueDate >= out.billDate;
  out.found = Boolean(out.consumerId || out.amount != null || out.dueDate);
  return out;
}
