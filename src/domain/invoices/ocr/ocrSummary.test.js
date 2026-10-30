import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkImage, labelOfLine, planAmountReads, assembleFigures, parsePassA, readSummaryFromImage, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS } from "./ocrSummary.js";
import { checkEquations } from "../orderSummary.js";

const W = 1000, SIZE = { width: W, height: 1400 };
// a recognised line: words laid out left to right, 100 px each
const line = (y, ...texts) => ({ text: texts.join(" "), bbox: { x0: 20, y0: y, x1: 20 + texts.length * 100, y1: y + 30 }, words: texts.map((t, i) => ({ text: t, bbox: { x0: 20 + i * 100, y0: y, x1: 20 + (i + 1) * 100, y1: y + 30 } })) });
// the SAMPLE as the engine reads it on the whole page: the rupee sign comes out as a digit (INVOICE-IMPORT-008)
const PAGE = [
  line(100, "Order", "Summary"), line(150, "Pat", "Example"), line(190, "12", "Sample", "Street"), line(230, "Visa", "ending", "in", "0000"),
  line(300, "Item(s)", "Subtotal:", "2329.00"), line(340, "Shipping:", "350.00"), line(380, "Offer", "Processing", "Fee:", "31.35"),
  line(420, "Total:", "7380.35"), line(460, "Instant", "Bank", "Discount:", "-17.33"), line(500, "Grand", "Total:", "363.02"),
];
const png = (o = {}) => ({ type: "image/png", size: 1000, ...o });

test("images: only PNG, JPG or WebP within the size limits; a bigger one is declined, never shrunk", () => {
  assert.equal(checkImage(png(), SIZE).ok, true);
  assert.equal(checkImage({ type: "image/gif", size: 1 }, SIZE).reason, "type");
  assert.equal(checkImage({ type: "application/pdf", size: 1 }, SIZE).reason, "type");
  assert.equal(checkImage(png({ size: MAX_IMAGE_BYTES + 1 }), SIZE).reason, "too-big");
  assert.equal(checkImage(png(), { width: 5000, height: Math.ceil(MAX_IMAGE_PIXELS / 5000) + 1 }).reason, "too-many-pixels");
  assert.equal(checkImage(png(), null).reason, "unreadable");
  assert.equal(checkImage(null, SIZE).reason, "type");
});

test("a line is a figure's label only when it is one of the six allow-listed labels", () => {
  const key = i => (labelOfLine(PAGE[i]) || {}).key;
  assert.deepEqual([4, 5, 6, 7, 8, 9].map(key), ["subtotal", "shipping", "fee", "total", "discount", "grandTotal"]);
  assert.deepEqual([0, 1, 2, 3].map(key), [undefined, undefined, undefined, undefined]);   // heading, name, address, card line: never a label
  assert.equal(labelOfLine(PAGE[9]).key, "grandTotal");                                      // "Grand Total" is not "Total"
  assert.equal(labelOfLine({ text: "", bbox: { y0: 0, y1: 1 }, words: [] }), null);
});

test("the label ends where its last word ends; the amount is read to the right of it, one line high", () => {
  const rows = planAmountReads(PAGE, SIZE);
  assert.deepEqual(rows.map(r => r.key).sort(), ["discount", "fee", "grandTotal", "shipping", "subtotal", "total"]);
  const sub = rows.find(r => r.key === "subtotal").rectangle;
  assert.equal(sub.left, 20 + 200 + 2);          // right edge of "Subtotal:" + 2
  assert.equal(sub.left + sub.width, W);          // to the edge of the picture
  assert.ok(sub.top < 300 && sub.top + sub.height > 330);
  assert.equal(rows.some(r => r.rectangle.top < 250), false);   // nothing is read from the name, address or card lines
});

test("the first row for a label is the one read; a repeated label never overrides it", () => {
  const rows = planAmountReads([line(300, "Shipping:", "50.00"), line(900, "Shipping:", "99.00")], SIZE);
  assert.equal(rows.length, 1);
  assert.ok(rows[0].rectangle.top < 400);
});

test("pass B beats pass A when it is a plain amount; otherwise pass A stays; nothing is corrected", () => {
  const a = parsePassA(PAGE);
  assert.equal(a.figures.subtotal, 232900);      // read as-is: the rupee sign came out as a "2"
  const out = assembleFigures(a, { subtotal: "329.00\n", shipping: "50.00", fee: "1.35", total: "3380.35", discount: "17.33", grandTotal: "363.02" });
  assert.deepEqual(out.figures, { subtotal: 32900, shipping: 5000, fee: 135, total: 338035, discount: 1733, grandTotal: 36302 });
  assert.equal(checkEquations(out.figures).e1.status, "fails");   // 3380.35 is left as read: the equation judges it, nothing fixes it
  const kept = assembleFigures(a, { subtotal: "??", shipping: "" });
  assert.equal(kept.figures.subtotal, 232900);
  assert.equal(kept.figures.shipping, 35000);
});

test("Rs. and INR are ways of writing the rupee sign; no other text is rewritten", () => {
  const a = parsePassA([line(0, "Item(s)", "Subtotal:", "Rs.", "329.00"), line(30, "Grand", "Total:", "INR", "363.02")].map(l => ({ ...l, text: l.text.replace(/\s+/g, " ") })));
  assert.equal(a.figures.subtotal, 32900);
  assert.equal(a.figures.grandTotal, 36302);
});

// ---- the engine, replaced by a fake that records what it is asked to do ----
const fakeWorker = (passB = {}, opts = {}) => {
  const calls = { terminate: 0, rects: [], params: null, formats: [] };
  const w = {
    calls,
    async recognize(_img, o, fmt) {
      calls.formats.push(Object.keys(fmt || {}));
      if (opts.failOnB && o && o.rectangle) throw new Error("boom");
      if (o && o.rectangle) { calls.rects.push(o.rectangle); const key = Object.keys(passB)[calls.rects.length - 1]; return { data: { text: `${passB[key]}\n` } }; }
      return { data: { text: "Pat Example\n12 Sample Street\nVisa ending in 0000", blocks: [{ paragraphs: [{ lines: PAGE }] }] } };
    },
    async setParameters(p) { calls.params = p; },
    async terminate() { calls.terminate++; },
  };
  return w;
};
const DEPS = w => ({ baseUrl: "https://app.test/", makeWorker: async () => w, sizeOf: async () => SIZE });

test("the brief's sample: the rupee sign misread everywhere, repaired by the amount pass, both equations hold", async () => {
  const w = fakeWorker({ subtotal: "329.00", shipping: "50.00", fee: "1.35", total: "380.35", discount: "17.33", grandTotal: "363.02" });
  const r = await readSummaryFromImage(png(), DEPS(w));
  assert.equal(r.ok, true);
  assert.deepEqual(r.figures, { subtotal: 32900, shipping: 5000, fee: 135, total: 38035, discount: 1733, grandTotal: 36302 });
  assert.equal(checkEquations(r.figures).allHold, true);
  assert.deepEqual(w.calls.params, { tessedit_pageseg_mode: "7", tessedit_char_whitelist: "0123456789.," });
  assert.equal(w.calls.rects.length, 6);
  assert.equal(w.calls.terminate, 1);
});

test("the engine is released after every reading, including a failed one; a failure says so and returns no figures", async () => {
  const w = fakeWorker({ subtotal: "329.00" }, { failOnB: true });
  const r = await readSummaryFromImage(png(), DEPS(w));
  assert.deepEqual(r, { ok: false, reason: "engine" });
  assert.equal(w.calls.terminate, 1);
});

test("a declined picture never starts the engine", async () => {
  let started = 0;
  const r = await readSummaryFromImage({ type: "image/gif", size: 5 }, { baseUrl: "x", makeWorker: async () => { started++; return fakeWorker(); }, sizeOf: async () => SIZE });
  assert.equal(r.ok, false); assert.equal(started, 0);
});

test("PRIVACY: nothing but the allow-listed figures, the order number and date comes back - no name, address, card line or recognised text", async () => {
  const w = fakeWorker({ subtotal: "329.00", shipping: "50.00", fee: "1.35", total: "380.35", discount: "17.33", grandTotal: "363.02" });
  const r = await readSummaryFromImage(png(), DEPS(w));
  assert.deepEqual(Object.keys(r).sort(), ["conflictingFigures", "figures", "found", "ok", "orderDate", "orderNumber", "unrecognised"]);
  const text = JSON.stringify(r);
  for (const secret of ["Pat", "Example", "Sample Street", "Visa", "0000", "ending"]) assert.equal(text.includes(secret), false, secret);
  assert.equal(r.unrecognised.every(u => Object.keys(u).join() === "amountPaise"), true);
});

test("PRIVACY: a card line with an amount-looking number is never read as a figure", () => {
  const a = parsePassA([line(0, "Visa", "ending", "in", "1234"), line(40, "Paid", "with:", "Visa", "1234.00"), line(80, "Shipping:", "50.00")]);
  assert.equal(a.figures.shipping, 5000);
  assert.equal(FIG(a).filter(v => v != null).length, 1);
});
const FIG = a => Object.values(a.figures);

test("the adapter never touches storage, the network or the console", () => {
  const src = readFileSync(fileURLToPath(new URL("./ocrSummary.js", import.meta.url)), "utf8").replace(/^\s*\/\/.*$/gm, "");
  for (const bad of ["localStorage", "sessionStorage", "indexedDB", "fetch(", "console.", "XMLHttpRequest", "sendBeacon", "data.words", "data.hocr", "data.tsv"]) assert.equal(src.includes(bad), false, bad);
});

test("the picture reader is off until switched on, loads the engine only when a picture is chosen, and records nothing itself", () => {
  const ui = readFileSync(fileURLToPath(new URL("../../../screens/OcrSummaryReview.jsx", import.meta.url)), "utf8");
  assert.match(ui, /const \[on, setOn\] = useState\(false\)/);
  assert.match(ui, /await import\("\.\.\/domain\/invoices\/ocr\/ocrSummary\.js"\)/);
  assert.equal(/^import .*ocrSummary|^import .*ocrEngine|^import .*tesseract/m.test(ui), false);
  assert.match(ui, /acknowledge\(newSummary\(\{ source: "read-from-picture"/);
  for (const bad of ["localStorage", "sessionStorage", "indexedDB", "fetch(", "console."]) assert.equal(ui.includes(bad), false, bad);
  assert.equal(/setLoans|setTxns|onConfirm/.test(ui), false);                       // nothing is saved and nothing can be confirmed from here
});
