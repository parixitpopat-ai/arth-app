// src/domain/invoices/blinkitGst.js — READ-ONLY parser/previewer for a Blinkit GST invoice table. Pure; creates no transaction, picks no account.
//
// Input is table CELLS (rows of strings) plus plain text lines, i.e. what a PDF text extractor would give. No extractor exists in the app yet;
// the supplied invoice was an image, so the first fixture is a hand transcription (see fixtures/). Layout facts below come from that ONE invoice.
//
// Every money value is kept as integer THOUSANDTHS of a rupee (the annexure prints 3 decimals, items print 2) next to the printed source string.
// Printed values are never altered: where the document disagrees with itself the parser reports a finding with expected, actual and difference.
// Tolerance for "printed rounding" is ₹0.01; a finding inside tolerance is a `warn`, outside it an `error`. `reconciled` is true only with no error.

const TOL = 10;                                                    // ₹0.01 in thousandths
const strip = s => String(s == null ? "" : s).toLowerCase().replace(/[^a-z]/g, "");   // header match survives printed line wraps ("Discou"+"nt")
const milli = s => { const t = String(s == null ? "" : s).replace(/[,\s₹]/g, ""); return /^\d+(\.\d{1,3})?$/.test(t) ? Math.round(parseFloat(t) * 1000) : null; };
const pct = s => { const m = milli(s); return m === null ? null : m / 1000; };

// The two CGST/SGST/Cess columns share a name; the one with "(%)" is the rate and the one with "(INR)" is the amount.
function mapItemHeader(cells) {
  const col = {};
  cells.forEach((c, i) => {
    const raw = String(c).toLowerCase(), k = strip(c);
    if (k === "srno") col.srNo = i; else if (k === "upc") col.upc = i; else if (k === "itemdescription") col.desc = i; else if (k === "mrp") col.mrp = i;
    else if (k === "discount") col.discount = i; else if (k === "qty") col.qty = i; else if (k === "taxablevalue") col.taxable = i;
    else if (k === "additionalcessval") col.addCess = i; else if (k === "total") col.total = i;
    else if (/^(cgst|sgst|cess)/.test(k)) col[`${k.slice(0, 4)}${raw.includes("%") ? "Rate" : ""}`] = i;
  });
  return ["srNo", "desc", "taxable", "cgst", "sgst", "total"].every(k => col[k] !== undefined) ? col : null;
}

const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALE = { hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000, crore: 10000000, crores: 10000000 };
/** "Rupees One Thousand One Hundred Twenty Five Only" -> 1125000 (thousandths). null when any word is not understood. */
export function wordsToMilli(text) {
  const t = String(text || "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).filter(w => !["rupees", "rupee", "only", "and", "rs"].includes(w));
  let total = 0, cur = 0;
  for (const w of t) {
    if (w in WORDS) cur += WORDS[w];
    else if (w === "hundred") cur = (cur || 1) * 100;
    else if (w in SCALE) { total += (cur || 1) * SCALE[w]; cur = 0; }
    else return null;
  }
  return (total + cur) * 1000;
}

const finding = (code, level, message, extra = {}) => ({ code, level, message, ...extra });
const cmp = (code, label, expected, actual, extra = {}) => {
  const diff = actual - expected;
  return finding(code, diff === 0 ? "ok" : Math.abs(diff) <= TOL ? "warn" : "error",
    diff === 0 ? `${label} matches (${actual / 1000}).` : `${label}: ${expected / 1000} vs ${actual / 1000}, difference ${diff / 1000}${Math.abs(diff) <= TOL ? " (within ₹0.01 printed rounding; value left as printed)" : ""}.`,
    { expectedMilli: expected, actualMilli: actual, diffMilli: diff, ...extra });
};

/** @param {{textLines?:string[], itemRows:string[][], annexureRows?:string[][]}} input */
export function parseBlinkitGstInvoice(input) {
  const findings = [], lines = input.textLines || [];
  const out = { merchant: null, identifiers: { invoiceNumber: null, orderId: null }, invoiceDate: null, placeOfSupply: null, items: [], chargeRows: [], unrecognisedRows: [], declaredTotals: null, annexure: [], amountInWordsMilli: null, findings, reconciled: false };

  // ---- merchant, seller, identifiers: separate fields, only what is printed. The customer ("Invoice To") block is deliberately never read. ----
  const docText = [input.sellerText, input.metaText, input.footerText, ...lines].filter(Boolean).join("\n");
  const sellerText = input.sellerText ?? null, metaText = input.metaText ?? docText, footerText = input.footerText ?? docText;
  const gstinOf = t => (/\bGSTIN\s*:?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/.exec(t || "") || [])[1] || null;
  const panOf = t => (/\bPAN\s*:?\s*([A-Z]{5}[0-9]{4}[A-Z])\b/.exec(t || "") || [])[1] || null;
  const cinOf = t => (/\bCIN\s*:?\s*([LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6})\b/.exec(t || "") || [])[1] || null;
  const nm = /(Blink Commerce Private Limited)/i.exec(docText);
  const sellerName = sellerText ? (/Sold By \/ Seller\s*\n\s*([^\n]+)/i.exec(sellerText) || [])[1]?.trim() || null : null;
  out.merchant = { legalName: sellerName || (nm ? nm[1] : null), formerName: ((/formerly known as ([^)]+)\)/i.exec(docText) || [])[1] || "").trim() || null, pan: panOf(footerText) || panOf(sellerText), cin: cinOf(footerText) || cinOf(sellerText) };
  out.seller = sellerText ? { gstin: gstinOf(sellerText), pan: panOf(sellerText), fssai: (/FSSAI License Number\s*:?\s*(\d{14})\b/.exec(sellerText) || [])[1] || null, address: (/^(?:Sold By[^\n]*\n[^\n]*\n)([^\n]+)/i.exec(sellerText) || [])[1]?.trim() || null } : null;
  out.registeredOfficeGstin = gstinOf(footerText);
  out.placeOfSupply = (/Place of Supply[ \t]*:[ \t]*([A-Za-z ]+)/i.exec(metaText) || /\bState[ \t]*:[ \t]*([A-Za-z ]+)/.exec(metaText) || [])[1]?.trim() || null;
  const invNo = /\bInvoice[ \t]*(?:No\.?|Number)[ \t]*:?[ \t]*([A-Z0-9\-\/]+)/i.exec(metaText), ordNo = /\bOrder[ \t]*(?:ID|No\.?|Number)[ \t]*:?[ \t]*([A-Z0-9\-\/]+)/i.exec(metaText);
  const dt = /\bInvoice[ \t]*Date[ \t]*:?[ \t]*(\d{4}-\d{2}-\d{2}|\d{1,2}[-\/ .][A-Za-z0-9]{1,3}[-\/ .]\d{2,4})/i.exec(metaText);
  if (invNo) out.identifiers.invoiceNumber = invNo[1]; if (ordNo) out.identifiers.orderId = ordNo[1]; if (dt) out.invoiceDate = dt[1];
  out.invoiceDateIso = null;
  if (out.invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(out.invoiceDate)) {
    const [y, m, d] = out.invoiceDate.split("-").map(Number), t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d) out.invoiceDateIso = out.invoiceDate;
    else findings.push(finding("invoice-date-invalid", "error", `Invoice date "${out.invoiceDate}" is not a real calendar date.`));
  } else if (out.invoiceDate) findings.push(finding("invoice-date-unnormalised", "warn", `Invoice date "${out.invoiceDate}" is not ISO (YYYY-MM-DD); day/month order is not guessed, so no normalised date is produced.`));
  for (const [k, v, label] of [["invoiceNumber", out.identifiers.invoiceNumber, "Invoice number"], ["orderId", out.identifiers.orderId, "Order ID"], ["invoiceDate", out.invoiceDate, "Invoice date"]])
    if (v === null) findings.push(finding(`${k}-absent`, "info", `${label} is not in the supplied text. Left empty; never guessed. Needed before an import could be de-duplicated.`));
  // Explainable invoice identity for duplicate detection: seller registration + invoice number. The order ID is NOT the key (one order can hold several invoices).
  out.importKey = out.seller && out.seller.gstin && out.identifiers.invoiceNumber ? `blinkit|${out.seller.gstin}|${out.identifiers.invoiceNumber}` : null;
  for (const [label, g, pn] of [["Seller", out.seller && out.seller.gstin, out.seller && out.seller.pan], ["Registered-office", out.registeredOfficeGstin, out.merchant.pan]])
    if (g && pn) findings.push(g.slice(2, 12) !== pn ? finding("pan-gstin-mismatch", "error", `${label} GSTIN ${g} does not contain PAN ${pn}.`) : finding("pan-gstin", "ok", `${label} GSTIN contains the printed PAN.`));
  // CGST+SGST is the intra-state pair. Only the two state codes seen so far are mapped (not a full GST state-code list; verify before relying on it).
  const CODES = { "06": "Haryana", "30": "Goa" };
  if (out.seller && out.seller.gstin && out.placeOfSupply) {
    const st = CODES[out.seller.gstin.slice(0, 2)];
    findings.push(!st ? finding("supply-state-unknown", "info", `Seller state code ${out.seller.gstin.slice(0, 2)} is not in the small known list; intra/inter-state not checked.`)
      : st === out.placeOfSupply ? finding("supply-intra-state", "ok", `Seller state (${st}) equals place of supply (${out.placeOfSupply}): CGST + SGST is the expected tax pair.`)
      : finding("supply-inter-state", "warn", `Seller state (${st}) differs from place of supply (${out.placeOfSupply}) but CGST + SGST are printed; IGST would be expected.`));
  }
  if (input.sellerText || input.metaText) findings.push(finding("customer-block-ignored", "info", "The customer name and address in the document are not extracted or stored."));
  const words = (/Amount in Words\s*:?\s*(.+)/i.exec(docText) || [])[1];
  out.amountInWordsMilli = words ? wordsToMilli(words) : null;

  // ---- item table ----
  const rows = input.itemRows || [], hi = rows.findIndex(r => mapItemHeader(r)), col = hi >= 0 ? mapItemHeader(rows[hi]) : null;
  if (!col) { findings.push(finding("item-header-missing", "error", "Could not find the item table headings (Sr. no, Item Description, Taxable Value, CGST, SGST, Total).")); return out; }
  const NUMERIC = new Set(["mrp", "discount", "qty", "taxable", "cgstRate", "cgst", "sgstRate", "sgst", "cessRate", "cess", "addCess", "total", "upc"]);
  const cell = (r, k) => { const raw = col[k] === undefined ? "" : String(r[col[k]] ?? "");
    return NUMERIC.has(k) ? raw.replace(/\s+/g, "") : raw.replace(/\s*\n\s*/g, " ").trim(); };
  let last = null;
  rows.slice(hi + 1).forEach((r, i) => {
    const ref = { tableRow: hi + 1 + i, raw: r.slice() }, first = String(r[0] ?? "").trim();
    if (/^total$/i.test(first)) { out.totalsRow = { raw: r.slice(), ...ref }; return; }
    const base = { description: cell(r, "desc"), taxableMilli: milli(cell(r, "taxable")), cgstRate: pct(cell(r, "cgstRate")), cgstMilli: milli(cell(r, "cgst")), sgstRate: pct(cell(r, "sgstRate")), sgstMilli: milli(cell(r, "sgst")),
      cessMilli: milli(cell(r, "addCess")) || 0, totalMilli: milli(cell(r, "total")), source: ref };
    if (/^\d+$/.test(first) && cell(r, "upc") && cell(r, "upc") !== "-") {
      const item = { ...base, srNo: Number(first), upc: cell(r, "upc"), hsn: (/\(HSN-(\d+)\)/.exec(base.description) || [])[1] || null, mrpMilli: milli(cell(r, "mrp")), discountMilli: milli(cell(r, "discount")), qty: Number(cell(r, "qty")) || null, charges: [] };
      out.items.push(item); last = item;
    } else if (first === "-" && /delivery|handling|other charges|fee/i.test(base.description)) {
      const ch = { ...base, followsSrNo: last ? last.srNo : null, relationship: last ? "follows-item (position on the invoice)" : "orphan" };
      out.chargeRows.push(ch); if (last) last.charges.push(ch); else findings.push(finding("charge-orphan", "error", "A charge row appears before any item.", { source: ref }));
    } else out.unrecognisedRows.push({ ...ref, note: "row not recognised; excluded from every figure" });
  });
  if (out.unrecognisedRows.length) findings.push(finding("unrecognised-rows", "warn", `${out.unrecognisedRows.length} row(s) were not recognised and are excluded.`));

  // ---- declared totals: the merged Total row is read as the ordered non-empty values qty, taxable, CGST, SGST, total ----
  if (out.totalsRow) {
    let v = out.totalsRow.raw.slice(1).map(x => String(x ?? "").trim()).filter(Boolean);
    const wrapped = v.findIndex(x => /\n/.test(x));
    if (wrapped >= 0) {                                                       // one cell printed over two lines: "1125.0" / "0"
      findings.push(finding("wrapped-total-cell", "warn", `A Total-row cell wrapped over lines (${JSON.stringify(v[wrapped])}) and was joined to ${v[wrapped].replace(/\s+/g, "")}; checked against the sum of line totals below.`, { cells: v[wrapped].split(/\n/) }));
      v[wrapped] = v[wrapped].replace(/\s+/g, "");
    }
    if (v.length === 6 && /^\d+$/.test(v[5]) && /^\d+\.\d$/.test(v[4])) {        // the same wrap delivered as two cells: "1125.0" + "0"
      findings.push(finding("wrapped-total-cell", "warn", `The grand total printed as two cells ("${v[4]}" + "${v[5]}") and was joined to ${v[4] + v[5]}; checked against the sum of line totals below.`, { cells: [v[4], v[5]] }));
      v = [...v.slice(0, 4), v[4] + v[5]];
    }
    if (v.length === 5 && v.every(x => milli(x) !== null)) out.declaredTotals = { qty: Number(v[0]), taxableMilli: milli(v[1]), cgstMilli: milli(v[2]), sgstMilli: milli(v[3]), totalMilli: milli(v[4]), sourceCells: v };
    else findings.push(finding("totals-row-unrecognised", "error", "The Total row did not have the five values expected (qty, taxable, CGST, SGST, total); no declared totals were read."));
  } else findings.push(finding("totals-row-missing", "error", "No Total row found."));

  // ---- annexure (separate table: what the "Delivery and other charges" rows are made of) ----
  const ar = input.annexureRows || [], ah = ar.findIndex(r => strip(r[0]) === "sno" && r.some(c => strip(c).startsWith("natureofcharge")));
  if (ah >= 0) for (const r of ar.slice(ah + 1)) {
    if (/^total$/i.test(String(r[0]).trim())) { out.annexureTotal = { taxableMilli: milli(r[4]), cgstMilli: milli(r[5]), sgstMilli: milli(r[6]), cessMilli: milli(r[7]) }; continue; }
    out.annexure.push({ srNo: Number(r[0]), nature: String(r[1]).trim(), taxRate: pct(r[2]), taxableMilli: milli(r[4]), cgstMilli: milli(r[5]), sgstMilli: milli(r[6]), cessMilli: milli(r[7]), raw: r.slice() });
  }

  // ---- reconciliation (nothing here edits a printed value) ----
  const sum = (arr, k) => arr.reduce((s, x) => s + (x[k] || 0), 0), all = [...out.items, ...out.chargeRows];
  const ok = (x, ...ks) => ks.every(k => x[k] !== null && x[k] !== undefined);
  const bad = all.filter(x => !ok(x, "taxableMilli", "cgstMilli", "sgstMilli", "totalMilli"));
  if (bad.length) findings.push(finding("row-unreadable", "error", `${bad.length} row(s) have an unreadable amount; totals cannot be checked.`));
  all.forEach(x => findings.push(cmp("row-identity", `Row ${x.srNo ? `item ${x.srNo}` : `charge after item ${x.followsSrNo}`}: taxable + CGST + SGST + cess = printed total`, x.totalMilli, (x.taxableMilli || 0) + (x.cgstMilli || 0) + (x.sgstMilli || 0) + x.cessMilli, { source: x.source })));
  out.items.forEach(x => { if (x.mrpMilli !== null && x.discountMilli !== null && x.qty) findings.push(cmp("mrp-less-discount", `Item ${x.srNo}: MRP x qty - discount = total`, x.totalMilli, x.mrpMilli * x.qty - x.discountMilli)); });
  const d = out.declaredTotals;
  if (d) {
    findings.push(cmp("sum-line-totals", "Sum of every row total vs printed grand total", d.totalMilli, sum(all, "totalMilli")));
    findings.push(cmp("sum-taxable", "Sum of taxable values vs printed taxable total", d.taxableMilli, sum(all, "taxableMilli")));
    findings.push(cmp("sum-cgst", "Sum of CGST vs printed CGST total", d.cgstMilli, sum(all, "cgstMilli")));
    findings.push(cmp("sum-sgst", "Sum of SGST vs printed SGST total", d.sgstMilli, sum(all, "sgstMilli")));
    findings.push(cmp("sum-qty", "Sum of item quantities vs printed quantity", d.qty, sum(out.items, "qty")));
    findings.push(cmp("grand-identity", "Printed taxable + CGST + SGST vs printed grand total", d.totalMilli, d.taxableMilli + d.cgstMilli + d.sgstMilli));
    if (out.amountInWordsMilli !== null) findings.push(cmp("amount-in-words", "Amount in words vs printed grand total", d.totalMilli, out.amountInWordsMilli));
    else findings.push(finding("amount-in-words-absent", "info", "Amount in words not read."));
    const w = findings.find(f => f.code === "wrapped-total-cell");
    if (w) { const f = findings.find(x => x.code === "sum-line-totals"); if (f.level === "error") w.level = "error"; }
  }
  // charge rows vs annexure: are they one charge shared across items, or independent? Decided by the numbers, not assumed.
  if (out.chargeRows.length && out.annexure.length) {
    const rowsTotal = sum(out.chargeRows, "totalMilli"), annIncl = sum(out.annexure, "taxableMilli") + sum(out.annexure, "cgstMilli") + sum(out.annexure, "sgstMilli") + sum(out.annexure, "cessMilli");
    const f = cmp("charges-vs-annexure", `Charge rows (${out.chargeRows.length}) total vs annexure charges incl. tax (${out.annexure.map(a => a.nature).join(", ")})`, annIncl, rowsTotal);
    f.linked = f.level !== "error";
    findings.push(f);
    out.chargeAllocation = { linked: f.linked, chargeRowCount: out.chargeRows.length, annexureChargeCount: out.annexure.length, chargeRowsTotalMilli: rowsTotal, annexureInclusiveMilli: annIncl,
      reading: f.linked ? `The ${out.chargeRows.length} "Delivery and other charges" rows add up to the ${out.annexure.length} annexure charge(s); they look like ONE charge shared across the items, not ${out.chargeRows.length} independent charges.` : "Charge rows do not reconcile to the annexure; treated as unlinked." };
  } else if (out.chargeRows.length) findings.push(finding("charges-unlinked", "warn", "Charge rows present but no annexure to explain them; not assumed to be one shared charge."));

  out.reconciled = findings.every(f => f.level !== "error");
  return out;
}
