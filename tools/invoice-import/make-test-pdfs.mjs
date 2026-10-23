// Writes five SYNTHETIC test PDFs for the phone smoke test (redacted fixture content; no customer data): node tools/invoice-import/make-test-pdfs.mjs <outdir>
import { writeFileSync, mkdirSync } from "node:fs"; import { join } from "node:path";
import { BLINKIT_FIXTURE_3_ITEMS as ITEMS } from "../../src/domain/invoices/fixtures/blinkitGstInvoiceItems.fixture.js";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";
const out = process.argv[2]; if (!out) { console.error("usage: node tools/invoice-import/make-test-pdfs.mjs <outdir>"); process.exit(2); }
mkdirSync(out, { recursive: true });
const draw = (items, extra = {}) => makePdf([{ texts: items.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })), ...extra }]);
const swap = (pred, str) => ITEMS.map(i => (pred(i) ? { ...i, str } : i));
const files = {
  "1-valid-invoice.pdf": draw(ITEMS, { image: { x: 40, y: 780, w: 40, h: 20 } }),
  "2-wrong-total-needs-review.pdf": draw(swap(i => i.str === "932.00", "902.00")),
  "3-credit-note-not-a-purchase.pdf": draw(swap(i => i.str === "Tax Invoice", "Credit Note")),
  "4-scanned-picture-no-text.pdf": makePdf([{ texts: [], image: { x: 0, y: 0, w: 595, h: 842 } }]),
  "5-damaged-file.pdf": new TextEncoder().encode("%PDF-1.4\nthis file is damaged on purpose\n%%EOF"),
};
for (const [n, b] of Object.entries(files)) { writeFileSync(join(out, n), b); console.log(n, b.length, "bytes"); }
