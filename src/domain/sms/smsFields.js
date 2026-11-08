// domain/sms/smsFields.js
//
// Two fields of a bank SMS that the Add screen's reader missed:
//   - the date written as 04-Nov-26 (day, month NAME, year; with - / . or spaces between)
//   - the merchant of a UPI card/bank debit written as "... for UPI--PAX INNO." or "UPI/P2M/412345678901/PAX INNO"
// Both return "" / null when the text does not clearly contain them, so the caller's other readers still run.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const D_MON_Y = /\b(\d{1,2})(?:st|nd|rd|th)?[-/. ]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[-/. ,]\s*(\d{4}|\d{2})\b/i;

/** "04-Nov-26", "4/Nov/2026", "04 Nov 26" -> "2026-11-04"; "" when absent or not a real calendar date. Two-digit years: 70-99 -> 19xx, else 20xx (as the app does). */
export function extractDMonYDate(text) {
  const m = String(text || "").match(D_MON_Y);
  if (!m) return "";
  const day = Number(m[1]), month = MONTHS[m[2].toLowerCase().slice(0, 3)];
  const y = Number(m[3]), year = y >= 100 ? y : (y >= 70 ? 1900 + y : 2000 + y);
  if (!month || day < 1 || day > new Date(year, month, 0).getDate()) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const NOT_A_NAME = /^(p2m|p2a|upi|ref|txn|imps|neft|rtgs|info|na|nil|credit|debit)$/i;
const titleCase = s => s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase());

/**
 * The merchant of a "UPI-..." / "UPI--..." / "UPI/P2M/<ref>/<name>" description, or null. A VPA (name@bank) is left to the existing reader.
 * The first segment (split on - or /) that is not a reference number, a channel word (P2M, P2A), or a VPA and that has letters is the name.
 */
export function extractUpiMerchant(text) {
  const m = String(text || "").match(/\bUPI\s*[-/:]+\s*([^\n]*)/i);
  if (!m) return null;
  let rest = m[1];
  const cut = rest.search(/\.(?:\s|$)|,|\s+on\s+\d|\s+ref\b|\s+avl\b|\s+bal\b|\s+not\s+you\b|\s+if\s+not\b|\s+to\s+dispute\b/i);
  if (cut >= 0) rest = rest.slice(0, cut);
  for (const seg of rest.split(/\s*[-/]+\s*/)) {
    const name = seg.trim().replace(/\s+/g, " ");
    if (!name || name.includes("@") || /^\d[\d\s]*$/.test(name) || NOT_A_NAME.test(name) || !/[A-Za-z]{2}/.test(name)) continue;
    if (name.length < 2 || name.length > 40 || !/^[A-Za-z0-9][A-Za-z0-9 &'.]*$/.test(name)) return null;
    return titleCase(name);
  }
  return null;
}
