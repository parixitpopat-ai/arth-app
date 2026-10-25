// Writes SYNTHETIC Amazon.in-style test PDFs (invented names and numbers, no real customer data) for the Android smoke test.
// Usage: node tools/invoice-import/make-amazon-test-pdfs.mjs <output-directory>
import { writeFileSync, mkdirSync } from "node:fs"; import { join } from "node:path";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
import { productPage, feePage } from "../../src/domain/invoices/fixtures/amazonInvoice.fixture.js";
const out = process.argv[2]; if (!out) { console.error("usage: node tools/invoice-import/make-amazon-test-pdfs.mjs <output-directory>"); process.exit(2); }
mkdirSync(out, { recursive: true });
const draw = (...pages) => makePdf(pages.map(items => ({ texts: items.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })) })));
const fee = n => feePage().map(i => (i.str === "AMZ-2002" ? { ...i, str: `AMZ-${3000 + n}` } : i));
const item = (n, o = {}) => productPage({ orderNo: "123-4567890-1234567", invNo: `SMP-${n}`, ...o });
const files = {
  "A1-order-1-seller-invoice.pdf": draw(item(1)),
  "A2-order-1-fee-invoices-merged-3-pages.pdf": draw(fee(1), fee(2), fee(3)),
  "A3-order-1-second-seller-invoice.pdf": draw(item(2, { sellerName: "Second Sample Seller", gstin: "29FGHIJ5678K1Z9", pan: "FGHIJ5678K" })),
  "A4-order-2-other-order.pdf": draw(item(9, { orderNo: "999-0000000-0000000", sellerName: "Other Sample Seller" })),
  "A5-same-as-A1-repeat.pdf": draw(item(1)),
  "A6-picture-only-no-text.pdf": makePdf([{ texts: [], image: { x: 0, y: 0, w: 595, h: 842 } }]),
  "A7-damaged-file.pdf": new TextEncoder().encode("%PDF-1.4\ngarbage"),
};
for (const [name, bytes] of Object.entries(files)) writeFileSync(join(out, name), bytes);
console.log(`wrote ${Object.keys(files).length} files to ${out}`);
