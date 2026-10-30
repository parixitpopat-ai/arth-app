// src/domain/receipts/receiptParse.js - a SHOP RECEIPT (a photo of a printed bill) as data. PURE: no OCR, no I/O, nothing saved.
//
// Reads, from recognised text lines, ONLY: the shop name (first lines), the bill date, the item rows ("[HSN] name  qty  rate  value"), the printed
// "Items: N Qty: M <amount>" line and the amount paid. A phone number, e-mail, GSTIN, FSSAI number, address, cashier or card line is never read.
// Money is whole paise. Nothing is ever corrected: a line that does not multiply, or items that do not add up, are SHOWN as failing; a single-figure
// suggestion is offered, never applied. The person's check and tap are required (see ReceiptPhotoReview).

export const toPaise = text => {
  const t = String(text == null ? "" : text).replace(/[₹\s]/g, "");
  if (!/^(\d{1,3}(,\d{2})*,\d{3}|\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(t)) return null;
  const [w, f = ""] = t.replace(/,/g, "").split(".");
  return parseInt(w, 10) * 100 + parseInt((f + "00").slice(0, 2), 10);
};
const qtyOf = text => { const n = Number(text); return Number.isFinite(n) && n > 0 && n < 100000 ? n : null; };
const lineValue = (qty, ratePaise) => Math.round(qty * ratePaise);       // paise, to the nearest paisa

const ITEM = /^\s*(?:\d{4,8}\s+)?([A-Za-z0-9][A-Za-z0-9 .,&'()/+%-]{1,48}?)\s+(\d+(?:\.\d{1,3})?)\s+(\d+(?:,\d{3})*\.\d{2})\s+(\d+(?:,\d{3})*\.\d{2})\s*$/;
const ITEMS_TOTAL = /\bitems?\s*[:.]?\s*(\d+)\s+qty\s*[:.]?\s*(\d+(?:\.\d{1,3})?)\s+(\d+(?:,\d{3})*\.\d{2})/i;
const PAID = /\b(upi|cash|card|paytm|phonepe|gpay|google\s*pay|net\s*banking|amount\s*received)[^\d\n]{0,28}?(\d+(?:,\d{3})*\.\d{2})/i;
const NOT_A_SHOP = /tax\s*invoice|\bgstin\b|\bfssai\b|phone|e-?mail|bill\s*(no|dt)|cashier|invoice|^\W*$|@|\d{6,}/i;

/** @param {string[]} lines recognised text, one per line */
export function parseReceiptLines(lines) {
  const all = (Array.isArray(lines) ? lines : []).map(l => String(l == null ? "" : l).replace(/\s+/g, " ").trim()).filter(Boolean);
  let merchant = "";
  for (const l of all.slice(0, 6)) {
    const letters = (l.match(/[A-Za-z]/g) || []).length;
    if (!NOT_A_SHOP.test(l) && letters >= 5 && letters / l.length > 0.6 && /\s/.test(l)) { merchant = l.replace(/[^A-Za-z0-9 .&'-]/g, "").trim(); break; }
  }
  let date = null;
  for (const l of all) {
    const m = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/.exec(l);
    const real = m && new Date(+m[3], +m[2] - 1, +m[1]);
    if (m && real.getFullYear() === +m[3] && real.getMonth() === +m[2] - 1 && real.getDate() === +m[1]) { date = `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`; break; }
  }
  const items = [];
  let printed = null; const paid = [];
  for (const l of all) {
    const t = ITEMS_TOTAL.exec(l);
    if (t && !printed) { printed = { count: +t[1], qty: Number(t[2]), totalPaise: toPaise(t[3]) }; continue; }
    const p = PAID.exec(l);
    if (p && !ITEM.test(l)) { const v = toPaise(p[2]); if (v != null) paid.push(v); continue; }
    const m = ITEM.exec(l);
    if (!m) continue;
    const qty = qtyOf(m[2]), rate = toPaise(m[3]), value = toPaise(m[4]);
    if (qty == null || rate == null || value == null) continue;
    items.push({ label: m[1].replace(/\s+/g, " ").trim(), qty, ratePaise: rate, valuePaise: value });
  }
  const uniquePaid = [...new Set(paid)];
  return { merchant, date, items, printed, paidPaise: uniquePaid.length === 1 ? uniquePaid[0] : null, conflictingPayments: uniquePaid.length > 1 };
}

/**
 * Judge a (possibly edited) receipt. Nothing here changes a figure.
 *  line:   qty x rate = value for every row.
 *  e1:     the item values add up to the printed "Items" total (when one is printed).
 *  e2:     the item values add up to the amount paid.
 *  qty:    the quantities add up to the printed quantity (when one is printed).
 */
export function checkReceipt({ items, printed = null, paidPaise = null }) {
  const rows = (items || []).map((it, i) => { const expected = it.qty > 0 && it.ratePaise != null ? lineValue(it.qty, it.ratePaise) : null; return { index: i, expectedPaise: expected, ok: expected != null && expected === it.valuePaise }; });
  const sum = (items || []).reduce((s, it) => s + (it.valuePaise || 0), 0);
  const eq = (expected, actual) => ({ status: expected == null || actual == null ? "incomplete" : expected === actual ? "holds" : "fails", expectedPaise: expected, actualPaise: actual });
  const e1 = printed && printed.totalPaise != null ? eq(printed.totalPaise, sum) : { status: "incomplete", expectedPaise: null, actualPaise: sum };
  const e2 = eq(paidPaise, items && items.length ? sum : null);
  const qtySum = (items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const qty = printed && printed.qty != null ? { status: Math.abs(printed.qty - qtySum) < 1e-9 ? "holds" : "fails", expected: printed.qty, actual: qtySum } : { status: "incomplete", expected: null, actual: qtySum };
  const linesOk = rows.length > 0 && rows.every(r => r.ok);
  const sumsHold = e2.status === "holds" && e1.status !== "fails";
  return { rows, sumPaise: sum, e1, e2, qty, linesOk, allHold: linesOk && sumsHold && qty.status !== "fails" };
}

/**
 * A SUGGESTION, never applied: if exactly one row does not multiply and replacing its value by qty x rate would make the items add up to the
 * amount paid, return it. Otherwise null.
 */
export function suggestReceiptFix({ items, printed = null, paidPaise = null }) {
  const c = checkReceipt({ items, printed, paidPaise });
  const bad = c.rows.filter(r => !r.ok && r.expectedPaise != null);
  if (bad.length !== 1 || paidPaise == null) return null;
  const fixed = items.map((it, i) => (i === bad[0].index ? { ...it, valuePaise: bad[0].expectedPaise } : it));
  return checkReceipt({ items: fixed, printed, paidPaise }).e2.status === "holds" ? { index: bad[0].index, valuePaise: bad[0].expectedPaise } : null;
}
