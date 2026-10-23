// Local, read-only check of ONE invoice PDF: node tools/invoice-import/extract.mjs <file.pdf>
// Everything runs on this machine (pdf.js text layer, no network, no OCR). Prints a summary that omits the customer block; writes nothing.
import { readFileSync } from "node:fs";
import { analyseBlinkitPdf } from "../../src/domain/invoices/blinkitPdf.js";
const file = process.argv[2];
if (!file) { console.error("usage: node tools/invoice-import/extract.mjs <file.pdf>"); process.exit(2); }
const r = await analyseBlinkitPdf(new Uint8Array(readFileSync(file)));
console.log("status:", r.status, r.reason || "", "| file sha256:", r.fileHash && r.fileHash.slice(0, 16) + "…");
for (const p of r.pages) {
  console.log(`page ${p.page}: ${p.status}`, p.reason || "", (p.reasons || []).join(" "));
  const x = p.parsed; if (!x) continue;
  const m = v => (v == null ? "-" : (v / 1000).toFixed(2));
  console.log("  seller GSTIN:", x.seller && x.seller.gstin, "| invoice:", x.identifiers.invoiceNumber ? "present" : "absent", "| order id:", x.identifiers.orderId ? "present" : "absent", "| date:", x.invoiceDateIso || x.invoiceDate, "| place of supply:", x.placeOfSupply);
  console.log("  importKey:", x.importKey ? "present" : null);
  x.items.forEach(i => console.log(`  item ${i.srNo} qty ${i.qty} mrp ${m(i.mrpMilli)} disc ${m(i.discountMilli)} taxable ${m(i.taxableMilli)} cgst ${m(i.cgstMilli)} sgst ${m(i.sgstMilli)} total ${m(i.totalMilli)} | charge rows: ${i.charges.map(c => m(c.totalMilli)).join(",")}`));
  const d = x.declaredTotals; console.log("  declared: qty", d && d.qty, "taxable", d && m(d.taxableMilli), "cgst", d && m(d.cgstMilli), "sgst", d && m(d.sgstMilli), "total", d && m(d.totalMilli), "| reconciled:", x.reconciled);
  if (x.chargeAllocation) console.log("  charges:", x.chargeAllocation.reading);
  x.findings.filter(f => f.level !== "ok" && f.level !== "info").forEach(f => console.log(`  [${f.level}] ${f.message}`));
}
