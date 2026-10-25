// src/domain/invoices/amazonBatch.js — reads MANY invoice PDFs one after another, in memory, and summarises them by order (INVOICE-IMPORT-006). Pure apart from the
// injected `readFile`. Nothing is stored; file names are never read, returned or logged (a file is "File 3"). Limits are those of pdfText.js (10 pages, 10 MB per file)
// and are NOT raised here. Creates no expense; there is no Confirm for Amazon.
import { readPdfLayout, sha256Hex } from "./pdfText.js";
import { analysePage as analyseBlinkitPage } from "./blinkitPdf.js";
import { analyseAmazonPages } from "./amazonPdf.js";
import { groupAmazonOrders } from "./amazonInvoice.js";

/** What happened to one file or page. `kind` is the outcome shown to the person. */
export const OUTCOME_LABEL = {
  read: "Read", "exact-duplicate": "Exact duplicate (counted once)", "probable-duplicate": "Probable duplicate (kept, please check)",
  blinkit: "Blinkit invoice (add it on its own)", "needs-review": "Read, needs a check", "requires-ocr": "Picture only (needs OCR)", unsupported: "Not a supported invoice",
  unreadable: "Could not be read", password: "Password-protected", "too-large": "Too large", "too-many-pages": "Too many pages",
};

const FAIL_KIND = { unreadable: "unreadable", password: "password", "too-large": "too-large", "too-many-pages": "too-many-pages" };
const invoiceKey = p => (p.seller && p.seller.gstin && p.invoiceNumber ? `${p.seller.gstin}|${p.invoiceNumber}` : null);

/** @param {Array<()=>Promise<Uint8Array>>|Array<Uint8Array>} files  @param {{pdfjs?:object, workerSrc?:string, onProgress?:Function, shouldStop?:()=>boolean, readFile?:Function, known?:{files:Set<string>, invoices:Set<string>}}} [opts]  `known` carries what earlier batches in the same session already read, so repeats across batches are counted once */
export async function readInvoiceBatch(files, opts = {}) {
  const { onProgress = () => {}, shouldStop = () => false, readFile = f => (typeof f === "function" ? f() : f) } = opts;
  const known = opts.known || { files: new Set(), invoices: new Set() };
  const outcomes = [], parsedAll = [], seenFiles = known.files, seenInvoices = known.invoices;
  for (let i = 0; i < files.length; i++) {
    if (shouldStop()) { outcomes.push({ index: i + 1, kind: "unsupported", reason: "Stopped before this file was read." }); continue; }
    onProgress({ done: i, total: files.length });
    let bytes;
    try { bytes = await readFile(files[i]); } catch { outcomes.push({ index: i + 1, kind: "unreadable", reason: "This file could not be opened." }); continue; }
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
    const hash = u8.length ? await sha256Hex(u8) : null;
    if (hash && seenFiles.has(hash)) { outcomes.push({ index: i + 1, kind: "exact-duplicate", reason: "The same file was chosen twice." }); continue; }
    if (hash) seenFiles.add(hash);
    const layout = await readPdfLayout(u8, { pdfjs: opts.pdfjs, workerSrc: opts.workerSrc });
    if (layout.status !== "ok") { outcomes.push({ index: i + 1, kind: FAIL_KIND[layout.status] || "unreadable", reason: layout.reason }); continue; }
    const pageOutcomes = [];
    for (const page of layout.pages) {
      const blinkit = analyseBlinkitPage(page);
      if (blinkit && blinkit.parsed) { pageOutcomes.push({ page: page.number, kind: "blinkit", reason: "Blinkit invoices are added one at a time: choose this file on its own." }); continue; }
      const az = analyseAmazonPages([page]).pages[0];
      if (az.parsed) {
        const key = invoiceKey(az.parsed);
        if (key && seenInvoices.has(key)) { pageOutcomes.push({ page: page.number, kind: "exact-duplicate", reason: "This invoice was already read." }); continue; }
        if (key) seenInvoices.add(key);
        parsedAll.push(az.parsed);
        pageOutcomes.push({ page: page.number, kind: az.parsed.importable ? "read" : "needs-review" });
      } else pageOutcomes.push({ page: page.number, kind: az.status === "requires-ocr" ? "requires-ocr" : "unsupported", reason: az.reason });
    }
    outcomes.push({ index: i + 1, kind: pageOutcomes.length === 1 ? pageOutcomes[0].kind : "pages", pages: pageOutcomes, reason: pageOutcomes.length === 1 ? pageOutcomes[0].reason : undefined });
  }
  onProgress({ done: files.length, total: files.length });
  return { outcomes, parsed: parsedAll, known };
}

/** Probable duplicates: same seller, date, total and first description, different invoice number. Both are KEPT; they are only flagged.
 *  Fee-only invoices (one processing-fee invoice per seller invoice) are expected to look identical, so they are not flagged; they are grouped for display instead. */
export function findProbableDuplicates(parsed) {
  const sig = p => [p.seller && p.seller.name, p.invoiceDate, p.totalPaise, p.rows[0] && p.rows[0].label].join("|");
  const groups = new Map();
  for (const p of parsed.filter(p => !p.rows.every(r => r.kind === "charge"))) { const s = sig(p); (groups.get(s) || groups.set(s, []).get(s)).push(p); }
  return [...groups.values()].filter(g => g.length > 1 && new Set(g.map(p => p.invoiceNumber)).size > 1).map(g => g.map(p => p.invoiceNumber));
}

const isFee = r => r.kind === "charge" && r.chargeType === "other" && /processing fee/i.test(r.label || "");
/** Orders, each summarised by seller and with repeated processing-fee lines grouped for display (every source invoice and amount kept). */
export function summariseOrders(parsed) {
  const probable = findProbableDuplicates(parsed), flagged = new Set(probable.flat());
  return groupAmazonOrders(parsed).map(o => {
    const sellers = new Map(), fees = { count: 0, totalPaise: 0, sources: [] }, other = [];
    for (const r of o.rows) {
      if (isFee(r)) { fees.count++; fees.totalPaise += r.totalPaise; fees.sources.push({ invoiceNumber: r.invoiceNumber, sellerName: r.sellerName, totalPaise: r.totalPaise }); continue; }
      if (r.kind === "charge") { other.push(r); continue; }
      const s = sellers.get(r.sellerName) || { sellerName: r.sellerName, itemCount: 0, totalPaise: 0, rows: [] };
      s.itemCount += r.qty || 1; s.totalPaise += r.totalPaise; s.rows.push(r); sellers.set(r.sellerName, s);
    }
    return { ...o, sellers: [...sellers.values()], fees, otherCharges: other, probableDuplicates: probable.filter(g => g.some(n => o.invoices.some(i => i.invoiceNumber === n))),
      flaggedInvoiceNumbers: o.invoices.map(i => i.invoiceNumber).filter(n => flagged.has(n)),
      reconciliation: { state: "unverified", label: "Unverified — no order summary" } };
  });
}

/** The counts shown above the orders. */
export function batchCounts(outcomes, parsed) {
  const flat = outcomes.flatMap(o => (o.pages ? o.pages : [o]));
  const n = k => flat.filter(o => o.kind === k).length;
  return { files: outcomes.length, invoicesRead: parsed.length, exactDuplicates: n("exact-duplicate"), probableDuplicateGroups: findProbableDuplicates(parsed).length,
    needsReview: parsed.filter(p => !p.importable).length, unreadable: n("unreadable") + n("password") + n("too-large") + n("too-many-pages"), needsOcr: n("requires-ocr"),
    unsupported: n("unsupported"), blinkit: n("blinkit") };
}
