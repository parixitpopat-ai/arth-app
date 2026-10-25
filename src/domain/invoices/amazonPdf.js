// src/domain/invoices/amazonPdf.js — PDF bytes -> read-only preview data for Amazon.in tax invoices. Creates no transaction, chooses no account, uploads nothing.
import { readPdfLayout, sha256Hex, PDF_LIMITS } from "./pdfText.js";
import { looksLikeAmazonInvoice, parseAmazonInvoicePage } from "./amazonInvoice.js";

const RANK = ["unreadable", "password", "too-large", "too-many-pages", "requires-ocr", "unsupported", "needs-review", "supported"];

/** Pure: pdf.js-style pages ({number, items, textChars, imageOps}) -> per-page results. */
export function analyseAmazonPages(pages) {
  const out = pages.map(page => {
    if (page.textChars < PDF_LIMITS.minTextChars) {
      return page.imageOps > 0
        ? { page: page.number, status: "requires-ocr", reason: "This page is a picture with no text layer. Reading it would need OCR, which Arth does not do. Download the original invoice PDF from Amazon instead." }
        : { page: page.number, status: "unsupported", reason: "This page has no readable text." };
    }
    if (!looksLikeAmazonInvoice(page.items)) return { page: page.number, status: "unsupported", reason: "This page is not an Amazon.in tax invoice." };
    const parsed = parseAmazonInvoicePage(page.items);
    return parsed.ok ? { page: page.number, status: parsed.status, parsed } : { page: page.number, status: "unsupported", reason: parsed.reason };
  });
  return { status: RANK.find(r => out.some(p => p.status === r)) || "unsupported", pages: out };
}

/** True when at least one page is an Amazon invoice (so the screen can choose this reader). */
export const isAmazonAnalysis = a => !!a && a.pages.some(p => p.parsed);

/** @param {Uint8Array} bytes @param {{pdfjs?:object, workerSrc?:string}} [opts] */
export async function analyseAmazonPdf(bytes, opts = {}) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  const fileHash = u8.length ? await sha256Hex(u8) : null, layout = await readPdfLayout(u8, opts);
  if (layout.status !== "ok") return { status: layout.status, reason: layout.reason, fileHash, pages: [] };
  return { fileHash, ...analyseAmazonPages(layout.pages) };
}
