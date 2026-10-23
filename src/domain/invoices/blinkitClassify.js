// src/domain/invoices/blinkitClassify.js — decides whether a parsed page is a supported Blinkit TAX INVOICE. The title alone is never enough.
// Statuses: "supported" (preview may be shown) | "needs-review" (shown with flags, not importable) | "unsupported" (rejected; nothing is read as a purchase).
// A credit note, debit note, refund or cancellation document must never become a purchase: any such signal rejects the page.

const NEGATIVE = /credit\s*note|debit\s*note|refund|return(?:ed)?\b|cancel(?:l?ed|lation)|reversal|chargeback/i;
const negativeCell = s => /^\(?\s*-\s*\d|^\(\s*\d[\d.,]*\s*\)$/.test(String(s).replace(/\s+/g, ""));

/** @param {{titleText:string|null, sellerText:string, metaText:string, itemRows:string[][]}} layout @param {object} parsed result of parseBlinkitGstInvoice */
export function classifyBlinkitDocument(layout, parsed) {
  const reasons = [], reasonCodes = [], title = layout.titleText;
  let status = "supported";
  const reject = (code, r) => { status = "unsupported"; reasons.push(r); reasonCodes.push(code); };
  const review = (code, r) => { if (status === "supported") status = "needs-review"; reasons.push(r); reasonCodes.push(code); };

  if (title && !/^tax invoice$/i.test(title)) reject("title-not-tax-invoice", `The document title is "${title}", not "Tax Invoice".`);
  else if (!title) review("no-title", "No document title was found.");
  if (NEGATIVE.test([title, layout.metaText, layout.sellerText].join("\n"))) reject("header-refund-words", "The header mentions a credit note, debit note, refund, return or cancellation. It is not treated as a purchase.");
  const body = layout.itemRows.slice(1);
  if (body.some(r => r.slice(3).some(negativeCell))) reject("negative-amounts", "Negative amounts appear in the item table (typical of a credit note).");
  else if (body.some(r => NEGATIVE.test(String(r[2] || "")))) review("description-return-word", "An item description mentions a return, refund or cancellation.");
  if (!parsed.declaredTotals) review("no-total", "No readable grand total.");
  if (!(parsed.seller && parsed.seller.gstin)) review("no-seller-gstin", "No seller GSTIN.");
  if (!parsed.identifiers.invoiceNumber) review("no-invoice-number", "No invoice number.");
  if (!parsed.reconciled) review("not-reconciled", "The figures do not reconcile (see the findings).");
  return { status, reasons, reasonCodes, title, importable: status === "supported" };
}
