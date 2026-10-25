// src/domain/invoices/amazonInvoice.js — reads ONE Amazon.in tax invoice page (positioned PDF text items) into a read-only preview. Pure.
// Layout knowledge comes from one real order (two invoices: Amazon's own "Offer Processing Fees" and one seller's single-item invoice); anything else is
// reported as needs-review, not guessed. PRIVACY (INVOICE-IMPORT-005): only the SELLER column and the item table are read. The Billing/Shipping address,
// the customer name, phone/e-mail, the payment transaction ids and the payment mode are never read, returned, stored or logged. The seller name is taken
// from the left-most cell of the line under "Sold By" only, so whatever sits beside it (the customer column) is never touched.

const Y_TOL = 2.5;
const MONEY = "₹([\\d,]+\\.\\d{2})";
const paise = s => Math.round(parseFloat(String(s).replace(/,/g, "")) * 100);
const HEAD_WORDS = new Set(["sl.", "sl. no", "no", "description", "unit", "price", "unit price", "qty", "net", "amount", "net amount", "tax", "rate", "tax rate", "type", "tax type", "tax amount", "total", "total amount"]);
const TAX_WORDS = /^(IGST|CGST|SGST|UTGST)$/i;

function toLines(items) {
  const out = [];
  for (const it of items.slice().sort((a, b) => b.y - a.y || a.x - b.x)) {
    const l = out.find(l => Math.abs(l.y - it.y) <= Y_TOL);
    l ? l.cells.push(it) : out.push({ y: it.y, cells: [it] });
  }
  out.forEach(l => l.cells.sort((a, b) => a.x - b.x));
  return out;
}
const lineText = l => l.cells.map(c => c.str).join(" ").replace(/\s+/g, " ").trim();

/** Does this page look like an Amazon.in tax invoice? (title + an Amazon order number) */
export function looksLikeAmazonInvoice(items) {
  const t = (items || []).map(i => i.str).join(" ");
  return /Tax Invoice\/Bill of Supply\/Cash Memo/.test(t) && /Order Number\s*:?\s*\d{3}-\d{7}-\d{7}/.test(t);
}

const finding = (code, level, message) => ({ code, level, message });

/** @param {Array<{str:string,x:number,y:number,w?:number}>} items */
export function parseAmazonInvoicePage(items) {
  const lines = toLines(items), texts = lines.map(lineText), all = texts.join(" ");
  const findings = [], no = (reasonCode, reason) => ({ ok: false, reasonCode, reason, findings });
  if (!looksLikeAmazonInvoice(items)) return no("layout-not-recognised", "This page is not an Amazon.in tax invoice layout Arth can read.");

  const orderNumber = (/Order Number\s*:?\s*(\d{3}-\d{7}-\d{7})/.exec(all) || [])[1] || null;
  const invoiceNumber = (/Invoice Number\s*:?\s*([A-Z0-9][A-Z0-9-]*)/.exec(all) || [])[1] || null;
  const d = /Invoice Date\s*:?\s*(\d{2})\.(\d{2})\.(\d{4})/.exec(all);
  const invoiceDate = d ? `${d[3]}-${d[2]}-${d[1]}` : null;

  // Seller: left-most cell of the line under "Sold By". Nothing to its right is read.
  const sb = texts.findIndex(t => /^Sold By\b/.test(t));
  const sellerName = sb >= 0 && lines[sb + 1] ? lines[sb + 1].cells[0].str : null;
  const gstLine = texts.find(t => /GST Registration No/.test(t)) || "";
  const sellerGstin = (/GST Registration No\s*:?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])/.exec(gstLine) || [])[1] || null;

  // Item table: between the "Invoice Date" line and the "TOTAL:" line, minus heading words.
  const start = texts.findIndex(t => /Invoice Date\s*:/.test(t)), end = texts.findIndex(t => /^TOTAL:/.test(t));
  if (start < 0 || end < 0 || end <= start) return no("table-not-found", "The item table was not found.");
  const cells = lines.slice(start + 1, end).flatMap(l => l.cells).map(c => c.str)
    .filter(s => !HEAD_WORDS.has(s.toLowerCase()) && !TAX_WORDS.test(s));
  const region = cells.join(" ").replace(/\s+/g, " ");

  const productRe = new RegExp(`${MONEY}\\s+(\\d+)\\s+${MONEY}\\s+(\\d{1,2}(?:\\.\\d+)?)%\\s+${MONEY}\\s+${MONEY}`, "g");
  const serviceRe = new RegExp(`(?:^|\\s)(\\d+)\\s+(?:\\S.*?\\s+)?${MONEY}\\s+${MONEY}\\s+(\\d{1,2}(?:\\.\\d+)?)%\\s+${MONEY}\\s+${MONEY}`, "g");
  let rowsRaw = [...region.matchAll(productRe)].map(m => ({ m, unit: paise(m[1]), qty: parseInt(m[2], 10), net: paise(m[3]), rate: parseFloat(m[4]), tax: paise(m[5]), total: paise(m[6]) }));
  if (!rowsRaw.length) rowsRaw = [...region.matchAll(serviceRe)].map(m => ({ m, unit: paise(m[2]), qty: 1, net: paise(m[3]), rate: parseFloat(m[4]), tax: paise(m[5]), total: paise(m[6]) }));
  if (!rowsRaw.length) return no("rows-not-recognised", "No item row with unit price, quantity, tax and total was found.");
  if (rowsRaw.length > 1) findings.push(finding("multi-row-unverified", "warn", "This invoice lists several rows. Only single-row Amazon invoices have been seen, so the description of each row is not read."));

  // The description is built from whole cells, so digits inside a product name ("ECR 11 MC") survive; money, rates and the row number are not part of it.
  const labelCells = cells.filter(c => !/^₹/.test(c) && !/%$/.test(c) && !/^\d{1,2}$/.test(c) && !/^[|]+$/.test(c));
  const labelOf = () => {
    if (rowsRaw.length > 1) return null;
    const rest = labelCells.filter(c => !/^HSN\s*:/.test(c)).join(" ");
    const asinAt = rest.search(/\bB0[A-Z0-9]{8}\b/);
    return (asinAt >= 0 ? rest.slice(0, asinAt) : rest).replace(/[()]/g, " ").replace(/\s+/g, " ").trim() || null;
  };
  const asin = (/\b(B0[A-Z0-9]{8})\b/.exec(region) || [])[1] || null;
  const hsn = (/\bHSN\s*:\s*(\d+)/.exec(region) || [])[1] || null;

  const rows = rowsRaw.map(r => {
    const label = labelOf();
    const isFee = /processing fee/i.test(label || region) && /Amazon Seller Services/i.test(sellerName || "");
    const isShip = /shipping|delivery|handling/i.test(label || "") && !/Offer/i.test(label || "");
    return { kind: isFee || isShip ? "charge" : "item", chargeType: isFee ? "other" : isShip ? (/handling/i.test(label) ? "handling" : "delivery") : null,
      label, asin: rowsRaw.length === 1 ? asin : null, hsn: rowsRaw.length === 1 ? hsn : null, qty: r.qty, unitPaise: r.unit, netPaise: r.net, ratePct: r.rate, taxPaise: r.tax, totalPaise: r.total };
  });

  const decl = new RegExp(`TOTAL:\\s*${MONEY}\\s+${MONEY}`).exec(texts[end] || "");
  const declared = decl ? { taxPaise: paise(decl[1]), totalPaise: paise(decl[2]) } : null;
  if (!declared) findings.push(finding("no-declared-total", "warn", "The invoice's own TOTAL line could not be read, so the rows could not be checked against it."));
  for (const [i, r] of rows.entries()) {
    if (Math.abs(r.qty * r.unitPaise - r.netPaise) > 1) findings.push(finding("net-mismatch", "error", `Row ${i + 1}: quantity × unit price does not equal the net amount.`));
    if (Math.abs(r.netPaise + r.taxPaise - r.totalPaise) > 1) findings.push(finding("total-mismatch", "error", `Row ${i + 1}: net + tax does not equal the total.`));
    if (Math.abs(Math.round(r.netPaise * r.ratePct / 100) - r.taxPaise) > 2) findings.push(finding("tax-rate-mismatch", "error", `Row ${i + 1}: the tax does not match ${r.ratePct}% of the net amount.`));
  }
  const sum = rows.reduce((s, r) => s + r.totalPaise, 0);
  if (declared && sum !== declared.totalPaise) findings.push(finding("declared-total-mismatch", "error", "The rows do not add up to the invoice's own TOTAL."));
  for (const [k, v] of [["order number", orderNumber], ["invoice number", invoiceNumber], ["invoice date", invoiceDate], ["seller name", sellerName]]) if (!v) findings.push(finding("missing-field", "error", `The ${k} was not found.`));

  const bad = findings.some(f => f.level === "error"), review = findings.some(f => f.level === "warn");
  return { ok: true, retailer: "amazon", status: bad || review ? "needs-review" : "supported", importable: !bad && !review,
    seller: { name: sellerName, gstin: sellerGstin }, orderNumber, invoiceNumber, invoiceDate, rows, declared, totalPaise: sum, findings };
}

/** Hash of the duplicate keys, so the synced import record holds neither the invoice number, the order number nor the seller's GSTIN (which contains a sole trader's PAN). */
export async function amazonKeys(parsed, sha = async s => { const { sha256Hex } = await import("./pdfText.js"); return sha256Hex(new TextEncoder().encode(s)); }) {
  const h = async s => (await sha(s)).slice(0, 32);
  return {
    invoiceKey: parsed.invoiceNumber && parsed.seller && parsed.seller.gstin ? `amazon|${await h(`${parsed.seller.gstin}|${parsed.invoiceNumber}`)}` : null,
    orderKey: parsed.orderNumber ? `amazon-order|${await h(parsed.orderNumber)}` : null,
  };
}

/** Invoices of the same order, from one or several PDFs. Shipping, discounts and other sellers' invoices are not on these pages, so the group says what it lacks. */
export function groupAmazonOrders(parsedInvoices) {
  const byOrder = new Map();
  for (const p of parsedInvoices.filter(p => p && p.ok)) {
    const g = byOrder.get(p.orderNumber) || { orderNumber: p.orderNumber, invoices: [] };
    if (!g.invoices.some(i => i.invoiceNumber === p.invoiceNumber)) g.invoices.push(p);
    byOrder.set(p.orderNumber, g);
  }
  return [...byOrder.values()].map(g => {
    const rows = g.invoices.flatMap(i => i.rows.map(r => ({ ...r, sellerName: i.seller.name, invoiceNumber: i.invoiceNumber })));
    const itemsPaise = rows.filter(r => r.kind === "item").reduce((s, r) => s + r.totalPaise, 0);
    const chargesPaise = rows.filter(r => r.kind === "charge").reduce((s, r) => s + r.totalPaise, 0);
    return { orderNumber: g.orderNumber, invoiceDate: g.invoices[0].invoiceDate, invoices: g.invoices, rows, itemsPaise, chargesPaise, invoicedPaise: itemsPaise + chargesPaise,
      notOnTheseInvoices: ["Shipping that Amazon bills outside these invoices", "Discounts (including instant bank discounts)", "Invoices from other sellers in the same order"],
      status: g.invoices.every(i => i.importable) ? "supported" : "needs-review" };
  });
}
