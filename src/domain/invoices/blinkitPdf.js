// src/domain/invoices/blinkitPdf.js — PDF bytes -> read-only preview data for a Blinkit GST invoice. Creates no transaction, chooses no account, uploads nothing.
import { readPdfLayout, sha256Hex, PDF_LIMITS } from "./pdfText.js";
import { layoutToBlinkitInput } from "./blinkitLayout.js";
import { parseBlinkitGstInvoice } from "./blinkitGst.js";
import { classifyBlinkitDocument } from "./blinkitClassify.js";

const RANK = ["unreadable", "password", "too-large", "too-many-pages", "requires-ocr", "unsupported", "needs-review", "supported"];

export function analysePage(page) {
  if (page.textChars < PDF_LIMITS.minTextChars) {
    return page.imageOps > 0
      ? { page: page.number, status: "requires-ocr", reasonCodes: ["no-text-layer"], reason: "This page is a picture with no text layer (a scan or photo). Reading it needs OCR, which Arth does not do. Download the original invoice PDF instead." }
      : { page: page.number, status: "unsupported", reasonCodes: ["no-readable-text"], reason: "This page has no readable text." };
  }
  const layout = layoutToBlinkitInput(page.items);
  if (!layout.ok) return { page: page.number, status: "unsupported", reasonCodes: ["layout-not-recognised"], reason: `This page is not a Blinkit tax invoice layout Arth can read: ${layout.reason}` };
  const parsed = parseBlinkitGstInvoice(layout), cls = classifyBlinkitDocument(layout, parsed);
  return { page: page.number, status: cls.status, reasons: cls.reasons, reasonCodes: cls.reasonCodes, title: cls.title, importable: cls.importable, parsed: cls.status === "unsupported" ? null : parsed };
}

/** @param {Uint8Array} bytes @param {{pdfjs?:object, workerSrc?:string}} [opts] */
export async function analyseBlinkitPdf(bytes, opts = {}) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  const fileHash = u8.length ? await sha256Hex(u8) : null, layout = await readPdfLayout(u8, opts);
  if (layout.status !== "ok") return { status: layout.status, reason: layout.reason, fileHash, pages: [] };
  const pages = layout.pages.map(analysePage);
  const status = RANK.find(r => pages.some(p => p.status === r)) || "unsupported";
  const notes = pages.length > 1 ? ["This PDF has several pages. Only one single-page layout has been seen; each page is read separately and none is assumed to continue another."] : [];
  return { status, fileHash, pages, notes };
}
