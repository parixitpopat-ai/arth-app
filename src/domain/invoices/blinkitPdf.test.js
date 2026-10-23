// Prototype tests for local PDF text extraction + layout reading + classification. SYNTHETIC / REDACTED data only: fixture 3 is positioned text
// from one real invoice with the customer block removed and identifiers replaced; test PDFs are drawn by testing/pdfMaker.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BLINKIT_FIXTURE_3_ITEMS as ITEMS } from "./fixtures/blinkitGstInvoiceItems.fixture.js";
import { BLINKIT_FIXTURE_2 as P } from "./fixtures/blinkitGstInvoicePdf.fixture.js";
import { layoutToBlinkitInput } from "./blinkitLayout.js";
import { parseBlinkitGstInvoice } from "./blinkitGst.js";
import { classifyBlinkitDocument } from "./blinkitClassify.js";
import { analyseBlinkitPdf, analysePage } from "./blinkitPdf.js";
import { readPdfLayout, PDF_LIMITS } from "./pdfText.js";
import { assessInvoiceDuplicates } from "./invoiceDuplicates.js";
import { makePdf } from "./testing/pdfMaker.js";

const here = dirname(fileURLToPath(import.meta.url));
const base = () => ITEMS.map(i => ({ ...i }));
const without = pred => base().filter(i => !pred(i));
const swap = (pred, str) => base().map(i => (pred(i) ? { ...i, str } : i));
const page = items => ({ number: 1, items, textChars: items.reduce((s, i) => s + i.str.replace(/\s+/g, "").length, 0), imageOps: 0 });
const drawn = (items, extra = {}) => makePdf([{ texts: items.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })), ...extra }]);
const pick = r => ({ items: r.items.map(i => [i.srNo, i.upc, i.qty, i.mrpMilli, i.discountMilli, i.taxableMilli, i.cgstMilli, i.sgstMilli, i.totalMilli]), charges: r.chargeRows.map(c => [c.followsSrNo, c.taxableMilli, c.cgstMilli, c.sgstMilli, c.totalMilli]), totals: r.declaredTotals && [r.declaredTotals.qty, r.declaredTotals.taxableMilli, r.declaredTotals.cgstMilli, r.declaredTotals.sgstMilli, r.declaredTotals.totalMilli], annexure: r.annexure.map(x => [x.nature, x.taxableMilli, x.cgstMilli, x.sgstMilli]), ids: r.identifiers, key: r.importKey });

// ---------------- layout reader (pure) ----------------
test("layout reader: positioned items rebuild the same table the PDF table extractor gave (fixture 2), figure for figure", () => {
  const lay = layoutToBlinkitInput(base());
  assert.equal(lay.ok, true);
  assert.equal(lay.titleText, "Tax Invoice");
  assert.deepEqual(pick(parseBlinkitGstInvoice(lay)), pick(parseBlinkitGstInvoice(JSON.parse(JSON.stringify(P)))));
});

test("layout reader: wrapped cells are rebuilt (UPC, description, the Total '1125.0' + '0') and the headings are the 14 columns", () => {
  const lay = layoutToBlinkitInput(base());
  assert.equal(lay.itemRows[0].length, 14);
  assert.deepEqual(lay.itemRows[1].slice(0, 3), ["1", "8904004403\n732", "Haldiram's Nagpur Moong Dal\nNamkeen(Pack) (HSN-21069099)"]);
  const total = lay.itemRows[lay.itemRows.length - 1];
  assert.equal(total[0], "Total");
  assert.equal(total[13], "1125.0\n0");
});

test("layout reader: the customer block is skipped entirely, even if present, and appears nowhere in the output", () => {
  const inv = ITEMS.find(i => i.str === "Invoice To");
  const customer = [["Name : Test Customer", 37, inv.y - 10], ["Address : 1 Example Road, Testville", 37, inv.y - 20], ["Pin code : 000000", 37, inv.y - 30], ["State : Goa", 37, inv.y - 40]].map(([str, x, y]) => ({ str, x, y, w: 80, h: 8 }));
  const lay = layoutToBlinkitInput([...base(), ...customer]);
  assert.equal(lay.ok, true);
  const blob = JSON.stringify(lay) + JSON.stringify(parseBlinkitGstInvoice(lay));
  assert.doesNotMatch(blob, /Test Customer|Example Road|Testville|Pin code/);
  assert.deepEqual(pick(parseBlinkitGstInvoice(lay)), pick(parseBlinkitGstInvoice(layoutToBlinkitInput(base()))));
});

test("layout reader: missing table heading, missing Total row and an unexpected line are reported, never guessed", () => {
  assert.match(layoutToBlinkitInput(without(i => i.str === "UPC")).reason, /heading/);
  assert.match(layoutToBlinkitInput(without(i => i.y < 472 && i.y > 458)).reason, /Total row/);
});

// ---------------- whole path through pdf.js (synthetic PDF drawn from fixture 3) ----------------
test("pdf.js path: a synthetic PDF with the invoice layout (and a picture) is read as a supported invoice reconciling to Rs 1,125.00", async () => {
  const r = await analyseBlinkitPdf(drawn(ITEMS, { image: { x: 40, y: 780, w: 40, h: 20 } }));
  assert.equal(r.status, "supported");
  const p = r.pages[0];
  assert.equal(p.importable, true);
  assert.equal(p.parsed.declaredTotals.totalMilli, 1125000);
  assert.equal(p.parsed.reconciled, true);
  assert.equal(p.parsed.importKey, "blinkit|30AAFCG9846E1ZO|C00000T000000001");
  assert.equal(r.fileHash.length, 64);
});

test("pdf.js path: pdf.js is asked not to run scripts or eval, and the caller's bytes are not detached", async () => {
  const seen = []; const bytes = drawn(ITEMS), len = bytes.length;
  const fake = { getDocument: o => { seen.push(o); return { promise: Promise.resolve({ numPages: 0, destroy: async () => {} }) }; }, OPS: {} };
  await readPdfLayout(bytes, { pdfjs: fake });
  assert.equal(seen[0].isEvalSupported, false);
  assert.equal(seen[0].enableScripting, false);
  assert.equal(bytes.length, len);
});

// ---------------- malformed / unreadable ----------------
test("malformed input: empty, not a PDF, junk after the header, truncated PDF, oversize and too many pages are refused with a status and plain reason", async () => {
  assert.equal((await analyseBlinkitPdf(new Uint8Array(0))).status, "unreadable");
  assert.match((await analyseBlinkitPdf(new TextEncoder().encode("hello world, not a pdf"))).reason, /not a PDF/);
  assert.equal((await analyseBlinkitPdf(new TextEncoder().encode("%PDF-1.4\nthis is garbage\n%%EOF"))).status, "unreadable");
  const good = drawn(ITEMS); assert.equal((await analyseBlinkitPdf(good.slice(0, Math.floor(good.length * 0.45)))).status, "unreadable");
  const big = new Uint8Array(PDF_LIMITS.maxBytes + 1); big.set(new TextEncoder().encode("%PDF-1.4")); assert.equal((await analyseBlinkitPdf(big)).status, "too-large");
  const many = makePdf(Array.from({ length: PDF_LIMITS.maxPages + 1 }, () => ({ texts: [{ str: "x", x: 10, y: 10 }] }))); assert.equal((await analyseBlinkitPdf(many)).status, "too-many-pages");
});

test("password-protected PDF is reported as such (pdf.js PasswordException)", async () => {
  const fake = { getDocument: () => ({ promise: Promise.reject(Object.assign(new Error("x"), { name: "PasswordException" })) }) };
  const r = await readPdfLayout(drawn(ITEMS), { pdfjs: fake });
  assert.equal(r.status, "password");
});

// ---------------- scanned / image-only ----------------
test("scanned / image-only PDF is reported as requiring OCR (out of scope); nothing is parsed", async () => {
  const r = await analyseBlinkitPdf(makePdf([{ texts: [], image: { x: 0, y: 0, w: 595, h: 842 } }]));
  assert.equal(r.status, "requires-ocr");
  assert.match(r.pages[0].reason, /OCR/);
  assert.equal(r.pages[0].parsed, undefined);
  const stray = await analyseBlinkitPdf(makePdf([{ texts: [{ str: "scan 01", x: 20, y: 20 }], image: { x: 0, y: 0, w: 595, h: 842 } }]));
  assert.equal(stray.status, "requires-ocr");
});

test("a page with little text and no picture is 'unsupported: no readable text', not 'requires OCR'", async () => {
  const r = await analyseBlinkitPdf(makePdf([{ texts: [{ str: "hi", x: 20, y: 20 }] }]));
  assert.equal(r.status, "unsupported");
  assert.match(r.pages[0].reason, /no readable text/);
});

test("a normal text PDF with pictures (logos, QR) is NOT mistaken for a scan", async () => {
  const r = await readPdfLayout(drawn(ITEMS, { image: { x: 40, y: 780, w: 40, h: 20 } }));
  assert.ok(r.pages[0].imageOps >= 1 && r.pages[0].textChars > PDF_LIMITS.minTextChars);
});

// ---------------- document classification ----------------
const cls = items => { const lay = layoutToBlinkitInput(items); return lay.ok ? classifyBlinkitDocument(lay, parseBlinkitGstInvoice(lay)) : { status: "layout-failed", reasons: [lay.reason] }; };

test("classification: the genuine invoice is supported and importable", () => {
  const c = cls(base());
  assert.deepEqual([c.status, c.importable], ["supported", true]);
});

test("a credit note must never be read as a purchase: title, header wording and negative amounts each reject it", () => {
  assert.equal(cls(swap(i => i.str === "Tax Invoice", "Credit Note")).status, "unsupported");
  assert.equal(cls(swap(i => i.str === "Tax Invoice", "Credit Note")).importable, false);
  assert.equal(cls(swap(i => i.str === "Tax Invoice", "Bill of Supply")).status, "unsupported");
  // title still says Tax Invoice but the header carries a refund marker
  const hdr = base().map(i => (i.str === "Place of Supply" ? { ...i, str: "Refund against Place of Supply" } : i));
  assert.equal(cls(hdr).status, "unsupported");
  // title still says Tax Invoice but amounts are negative
  const neg = swap(i => i.str === "60.00" && i.x > 500, "-60.00");
  assert.equal(cls(neg).status, "unsupported");
  const neg2 = swap(i => i.str === "60.00" && i.x > 500, "(60.00)");
  assert.equal(cls(neg2).status, "unsupported");
});

test("a rejected page produces no parsed purchase at all", () => {
  const p = analysePage(page(swap(i => i.str === "Tax Invoice", "Credit Note")));
  assert.equal(p.status, "unsupported");
  assert.equal(p.parsed, null);
});

test("classification: a missing title or a missing invoice number / seller GSTIN / total needs review and is not importable", () => {
  assert.equal(cls(without(i => i.str === "Tax Invoice")).status, "needs-review");
  const noNo = cls(without(i => i.str === "C00000T000000001"));
  assert.deepEqual([noNo.status, noNo.importable], ["needs-review", false]);
  assert.match(noNo.reasons.join(" "), /invoice number/);
  assert.equal(cls(without(i => /^: 30AAFCG9846E1ZO$/.test(i.str))).status, "needs-review");
});

test("classification: a return/refund word inside an item description needs review (it may be a real product name)", () => {
  const c = cls(swap(i => /^Haldiram's Nagpur Sev$/.test(i.str), "Return gift Sev"));
  assert.equal(c.status, "needs-review");
  assert.match(c.reasons.join(" "), /description/);
});

test("classification: figures that do not reconcile need review; the printed value is kept as printed", () => {
  const items = swap(i => i.str === "932.00", "902.00"), lay = layoutToBlinkitInput(items), parsed = parseBlinkitGstInvoice(lay);
  assert.equal(classifyBlinkitDocument(lay, parsed).status, "needs-review");
  assert.equal(parsed.items[2].totalMilli, 902000);
  assert.equal(parsed.findings.find(f => f.code === "sum-line-totals").level, "error");
});

test("a different document that merely has a table is not a Blinkit invoice layout", () => {
  const items = [{ str: "Statement", x: 10, y: 800, w: 40, h: 8 }, ...Array.from({ length: 12 }, (_, n) => ({ str: `row ${n} some words here`, x: 10, y: 700 - n * 12, w: 80, h: 8 }))];
  assert.equal(analysePage(page(items)).status, "unsupported");
});

// ---------------- duplicates ----------------
test("duplicate invoices are explained, never merged or deleted", () => {
  const K = "blinkit|30AAFCG9846E1ZO|C00000T000000001";
  const input = [{ importKey: K, fileHash: "h1", totalMilli: 1125000 }, { importKey: K, fileHash: "h2", totalMilli: 1125000 }, { importKey: K, fileHash: "h3", totalMilli: 1000000 }, { importKey: "blinkit|30AAFCG9846E1ZO|OTHER", fileHash: "h1", totalMilli: 5 }, { importKey: null, fileHash: "h9" }];
  const snap = JSON.stringify(input);
  const r = assessInvoiceDuplicates(input);
  assert.deepEqual(r.map(x => x.status), ["new", "duplicate-in-batch", "conflict", "same-file", "no-key"]);
  assert.ok(r.every(x => x.why.length > 10));
  assert.equal(JSON.stringify(input), snap);
  assert.equal(assessInvoiceDuplicates([{ importKey: K, totalMilli: 1 }], { existingKeys: [K] })[0].status, "already-imported");
  assert.equal(assessInvoiceDuplicates([{ importKey: "x|y|z", fileHash: "abc", totalMilli: 1 }], { existingFileHashes: ["abc"] })[0].status, "same-file");
});

test("duplicate detection through the PDF path: the same file twice is caught by key and content hash", async () => {
  const bytes = drawn(ITEMS), a = await analyseBlinkitPdf(bytes), b = await analyseBlinkitPdf(bytes);
  assert.equal(a.fileHash, b.fileHash);
  const cand = r => ({ importKey: r.pages[0].parsed.importKey, fileHash: r.fileHash, totalMilli: r.pages[0].parsed.declaredTotals.totalMilli });
  assert.deepEqual(assessInvoiceDuplicates([cand(a), cand(b)]).map(x => x.status), ["new", "duplicate-in-batch"]);
});

// ---------------- local-only guarantees ----------------
test("local processing: no source file in the invoice module uses the network", () => {
  for (const f of readdirSync(here).filter(f => f.endsWith(".js") && !f.endsWith(".test.js"))) {
    const src = readFileSync(join(here, f), "utf8");
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|https?:\/\//, f);
  }
});

test("fixtures contain no customer data", () => {
  for (const f of ["blinkitGstInvoiceItems.fixture.js", "blinkitGstInvoicePdf.fixture.js", "blinkitGstInvoice.fixture.js"]) {
    const src = readFileSync(join(here, "fixtures", f), "utf8");
    assert.doesNotMatch(src, /\bName\s*:|Pin code\s*:|Address\s*:/, f);                  // no customer-block labels or values (the real values are deliberately not listed here)
  }
});
