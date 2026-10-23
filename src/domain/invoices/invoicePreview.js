// src/domain/invoices/invoicePreview.js — turns an analysed Blinkit PDF into what the PHASE 1 PREVIEW shows. Pure. Creates nothing, links nothing, stores nothing.
//
// Decisions it implements (INVOICE-IMPORT-001): items keep their printed MRP / discount / quantity / line total (discount stays inside the line, no negative line);
// repeated delivery rows become ONE handling charge only when rows and annexure verify, with the source rows kept; the invoice date is shown, a payment date
// is a separate editable value and no order time is invented; matches are SUGGESTIONS (including similar amounts) and never links; duplicates are explained.
import { assessInvoiceDuplicates } from "./invoiceDuplicates.js";
import { localIsoDate } from "../vehicles/fuelFills.js";

// Matching tolerances are a PROPOSAL (unverified against real data): same-amount needs no merchant text; a similar amount also needs Blinkit-like text.
export const MATCH = Object.freeze({ dayWindow: 3, minTolPaise: 2500, pctTol: 0.05 });
const MERCHANT_RE = /blink\s*it|blinkit|grofers|blink commerce/i;
const rup = milli => (milli == null ? null : milli / 1000);
const dayNum = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
const inr = p => `₹${(Math.abs(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ---------- outcomes the person can act on ----------
const A = { choose: { id: "choose-another", label: "Choose another file" }, hand: { id: "add-by-hand", label: "Add it by hand" }, close: { id: "close", label: "Close" } };
export function describeOutcome(status, codes = [], reason = "") {
  const has = c => codes.includes(c);
  switch (status) {
    case "unreadable": return { tone: "amb", title: "Couldn't open this file", message: "The file is empty, damaged or not a PDF. Download the invoice again from the Blinkit app and choose that file.", actions: [A.choose, A.hand] };
    case "password": return { tone: "amb", title: "Password-protected PDF", message: "Arth can't open a password-protected PDF. Download an unprotected copy of the invoice and choose that.", actions: [A.choose, A.hand] };
    case "too-large": return { tone: "amb", title: "File too large", message: `${reason || "This file is larger than Arth reads."} Invoices are normally far smaller, so this may not be an invoice.`, actions: [A.choose] };
    case "too-many-pages": return { tone: "amb", title: "Too many pages", message: `${reason || "This PDF has too many pages."} Choose a single invoice.`, actions: [A.choose] };
    case "requires-ocr": return { tone: "amb", title: "This PDF is a picture, not text", message: "It looks like a scan or photo. Reading pictures needs OCR, which Arth does not do. Download the PDF invoice from the Blinkit app, or add the purchase by hand.", actions: [A.choose, A.hand] };
    case "unsupported":
      if (has("title-not-tax-invoice") || has("header-refund-words") || has("negative-amounts"))
        return { tone: "info", title: "This isn't a purchase invoice", message: "It looks like a credit note, refund or cancellation document, or another kind of document. Arth will not add it as a purchase. Nothing was added.", actions: [A.close, A.choose] };
      if (has("no-readable-text")) return { tone: "amb", title: "No readable text", message: "This page has no readable text. Download the invoice PDF again from the Blinkit app.", actions: [A.choose, A.hand] };
      return { tone: "amb", title: "Couldn't recognise this invoice", message: "The layout doesn't match the Blinkit tax invoice Arth knows. Blinkit may have changed its format. You can add the purchase by hand.", actions: [A.hand, A.choose] };
    case "needs-review": return { tone: "amb", title: "Check this before relying on it", message: "Arth read this invoice but something needs a look. The details below are shown exactly as printed; nothing is corrected.", actions: [] };
    default: return null;
  }
}

// ---------- diagnostics: codes and counts only. No names, amounts, identifiers, file names or dates. ----------
export function diagnosticEntry(analysis, byteLength = 0) {
  const codes = new Set();
  for (const p of analysis.pages || []) {
    (p.reasonCodes || []).forEach(c => codes.add(c));
    if (p.parsed) p.parsed.findings.filter(f => f.level === "warn" || f.level === "error").forEach(f => codes.add(`${f.code}:${f.level}`));
  }
  return { status: analysis.status, pages: (analysis.pages || []).length, pageStatuses: (analysis.pages || []).map(p => p.status), codes: [...codes].sort(), sizeBucket: byteLength < 1048576 ? "<1MB" : byteLength < 5242880 ? "1-5MB" : ">=5MB" };
}

// ---------- the invoice itself, as printed ----------
function buildInvoiceView(parsed) {
  const items = parsed.items.map(i => ({
    srNo: i.srNo, upc: i.upc, hsn: i.hsn, name: i.description.replace(/\s*\(HSN-\d+\)\s*$/, ""), qty: i.qty, mrp: rup(i.mrpMilli), discount: rup(i.discountMilli),
    taxable: rup(i.taxableMilli), cgstRate: i.cgstRate, cgst: rup(i.cgstMilli), sgstRate: i.sgstRate, sgst: rup(i.sgstMilli), lineTotal: rup(i.totalMilli),
    perUnitAfterDiscount: i.qty && i.totalMilli != null ? Math.round(i.totalMilli / i.qty) / 1000 : null,      // derived, not printed
    category: null, source: i.source.raw,
  }));
  const rows = parsed.chargeRows, ca = parsed.chargeAllocation, sumOf = k => rows.reduce((s, c) => s + (c[k] || 0), 0);
  let handling = null;
  if (rows.length) {
    const sourceRows = rows.map(c => ({ afterItem: c.followsSrNo, taxable: rup(c.taxableMilli), cgst: rup(c.cgstMilli), sgst: rup(c.sgstMilli), total: rup(c.totalMilli), raw: c.source.raw }));
    if (ca && ca.linked && parsed.annexure.length >= 1 && parsed.annexure.every(x => String(x.nature || "").trim().toLowerCase() === String(parsed.annexure[0].nature || "").trim().toLowerCase())) {
      const a = parsed.annexure[0];     // one kind of charge; the invoice may list it once per tax rate (e.g. 5% and 18%)
      handling = { verified: true, consolidated: true, label: a.nature || "Handling charge", taxable: rup(sumOf("taxableMilli")), cgst: rup(sumOf("cgstMilli")), sgst: rup(sumOf("sgstMilli")), total: rup(sumOf("totalMilli")), taxRate: parsed.annexure.every(x => x.taxRate === a.taxRate) ? a.taxRate : null,
        annexure: { taxable: rup(parsed.annexure.reduce((t, x) => t + x.taxableMilli, 0)), cgst: rup(parsed.annexure.reduce((t, x) => t + x.cgstMilli, 0)), sgst: rup(parsed.annexure.reduce((t, x) => t + x.sgstMilli, 0)) }, sourceRows,
        note: `Printed as ${rows.length} "Delivery and other charges" rows, one under each item. They add up to the invoice's ${a.nature || "charge"} table, so they are one shared charge.` };
    } else {
      handling = { verified: false, consolidated: false, label: "Delivery and other charges", total: rup(sumOf("totalMilli")), sourceRows,
        note: ca && ca.linked ? "The charge table lists more than one kind of charge, so the rows are shown as printed." : "These rows could not be matched to the invoice's charge table, so they are shown as printed and not combined." };
    }
  }
  const d = parsed.declaredTotals, issues = parsed.findings.filter(f => f.level === "warn" || f.level === "error");
  const level = issues.some(f => f.level === "error") ? "does-not-add-up" : issues.some(f => /sum|grand|row-identity|charges-vs/.test(f.code) && f.level === "warn") ? "adds-up-with-printed-rounding" : "adds-up";
  return {
    merchant: parsed.merchant.legalName, merchantFormerly: parsed.merchant.formerName, sellerGstin: parsed.seller ? parsed.seller.gstin : null, placeOfSupply: parsed.placeOfSupply,
    invoiceDate: parsed.invoiceDateIso, invoiceDateAsPrinted: parsed.invoiceDate, orderId: parsed.identifiers.orderId, invoiceNumber: parsed.identifiers.invoiceNumber, importKey: parsed.importKey,
    paymentMethod: { shown: false, note: "Blinkit invoices don't say how you paid." },
    items, handling, totals: d ? { qty: d.qty, taxable: rup(d.taxableMilli), cgst: rup(d.cgstMilli), sgst: rup(d.sgstMilli), invoiceTotal: rup(d.totalMilli), invoiceTotalMilli: d.totalMilli } : null,
    reconciliation: { level, issues: issues.map(f => ({ level: f.level, message: f.message })) },
    findings: parsed.findings,
    split: { known: false, message: "Arth can't tell from one file whether this order has other invoices. If the amount you paid is higher than this invoice total, another invoice may exist. Nothing is treated as a complete order." },
  };
}

// ---------- suggestions, never links ----------
/** @param {{invoiceTotalMilli:number}} totals @param {string[]} refDates ISO dates (invoice date, optionally the chosen payment date) */
export function suggestMatches(totalMilli, refDates, { transactions = [], accounts = [] } = {}) {
  const inv = Math.round(totalMilli / 10), tol = Math.max(MATCH.minTolPaise, Math.round(inv * MATCH.pctTol)), refs = refDates.filter(Boolean), matches = [], hints = [];
  for (const t of Array.isArray(transactions) ? transactions : []) {
    if (!t || t.type !== "expense" || t.isRefund || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.date || "")) || !(Number(t.amount) > 0) || !refs.length) continue;
    const days = Math.min(...refs.map(r => Math.abs(dayNum(t.date) - dayNum(r)))); if (days > MATCH.dayWindow) continue;
    const amt = Math.round(Number(t.amount) * 100), diff = amt - inv, text = `${t.merchant || ""} ${t.desc || ""} ${t.who || ""}`, merch = MERCHANT_RE.test(text);
    const acc = (accounts || []).find(a => String(a.id) === String(t.accId));
    const base = { id: String(t.id), label: t.merchant || t.desc || t.who || "Expense", date: t.date, amount: amt / 100, account: acc ? acc.name : null, daysApart: days, amountDiff: diff / 100 };
    if (diff === 0 || (Math.abs(diff) <= tol && merch)) {
      const reasons = [diff === 0 ? "Same amount." : `${inr(diff)} ${diff > 0 ? "more" : "less"} than the invoice${diff > 0 ? " (could include a tip or another fee)" : ""}.`, days === 0 ? "Same day." : `${days} day${days === 1 ? "" : "s"} from the invoice date.`];
      if (merch) reasons.push("Merchant text matches."); else reasons.push("Merchant text does not mention Blinkit.");
      reasons.push("The invoice does not say which account was used, so the account is not compared.");
      matches.push({ ...base, strength: diff === 0 ? "same-amount" : "similar", reasons });
    } else if (diff > tol && merch) hints.push({ ...base, message: `${inr(diff)} more than this invoice. The order may have another invoice.` });
  }
  const rank = m => [m.strength === "same-amount" ? 0 : 1, m.daysApart, Math.abs(m.amountDiff)];
  matches.sort((a, b) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
  return { matches: matches.slice(0, 5), hints: hints.slice(0, 3) };
}

export function validatePaymentDate(iso, today = localIsoDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return { ok: false, error: "Enter a valid date." };
  const t = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso) return { ok: false, error: "Enter a valid date." };
  if (iso > today) return { ok: false, error: "The date can't be in the future." };
  return { ok: true };
}

/** What a LATER (not built) confirmation would do, as a sentence. Phase 1 shows it as information only. */
export function describeNextStep(view, match) {
  if (!view.totals) return "Nothing can be done with this invoice until its total is readable.";
  const amount = inr(Math.round(view.totals.invoiceTotalMilli / 10));
  return match
    ? `If saving were available, Arth would link this invoice to your ${inr(Math.round(match.amount * 100))} expense on ${match.date} and add its ${view.items.length} item${view.items.length === 1 ? "" : "s"}. The expense's amount, date and account would stay as they are.`
    : `If saving were available, Arth would add 1 expense of ${amount} with ${view.items.length} item${view.items.length === 1 ? "" : "s"}, after you choose the account you paid from.`;
}

/**
 * @param {{status:string, reason?:string, fileHash?:string, pages:Array, notes?:string[]}} analysis result of analyseBlinkitPdf
 * @param {{transactions?:Array, accounts?:Array, existingKeys?:Iterable<string>, existingFileHashes?:Iterable<string>, paymentDates?:Object<number,string>}} ctx
 */
export function buildInvoicePreviews(analysis, ctx = {}) {
  const terminal = ["unreadable", "password", "too-large", "too-many-pages"];
  if (terminal.includes(analysis.status)) return { status: analysis.status, outcome: describeOutcome(analysis.status, [], analysis.reason), invoices: [], notes: [] };
  const withParsed = analysis.pages.filter(p => p.parsed);
  const dup = assessInvoiceDuplicates(withParsed.map((p, i) => ({ importKey: p.parsed.importKey, fileHash: i === 0 ? analysis.fileHash : undefined, totalMilli: p.parsed.declaredTotals ? p.parsed.declaredTotals.totalMilli : null })), { existingKeys: ctx.existingKeys, existingFileHashes: ctx.existingFileHashes });
  let k = 0;
  const invoices = analysis.pages.map(p => {
    if (!p.parsed) return { page: p.page, status: p.status, outcome: describeOutcome(p.status, p.reasonCodes || [], p.reason), view: null };
    const view = buildInvoiceView(p.parsed), d = dup[k++], payDate = (ctx.paymentDates && ctx.paymentDates[p.page]) || view.invoiceDate;
    const m = view.totals ? suggestMatches(view.totals.invoiceTotalMilli, [view.invoiceDate, payDate], ctx) : { matches: [], hints: [] };
    return { page: p.page, status: p.status, outcome: describeOutcome(p.status === "supported" ? "ready" : p.status, p.reasonCodes || [], p.reason), reasons: p.reasons || [], reasonCodes: p.reasonCodes || [], view, duplicate: { status: d.status, why: d.why }, paymentDate: payDate, matches: m.matches, hints: m.hints };
  });
  return { status: analysis.status, outcome: null, invoices, notes: analysis.notes || [] };
}
