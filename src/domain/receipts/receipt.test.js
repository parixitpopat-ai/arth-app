import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseReceiptLines, checkReceipt, suggestReceiptFix, toPaise } from "./receiptParse.js";
import { readReceiptFromImage } from "./ocrReceipt.js";

// An INVENTED receipt shaped like a thermal shop bill (made-up shop, phone, e-mail and numbers).
const RECEIPT = [
  "SAMPLE GROCERS TESTVILLE", "GSTIN : 99ZZZZZ0000Z1ZZ", "Near Test Yard, Testville,", "FSSAI 00000000000000", "Phone : 9000000000", "Email : shop@example.test",
  "TAX INVOICE", "Bill No : T001-000001 Bill Dt : 30/10/2026 ( 9:32AM", "Vou. No : S000001 Cashier : XX/000001", "HSN Particulars Qty/Kg N/Rate Value",
  "1) CGST @ 0.00%, SGST @ 0.00%", "1904 TEST BISCUIT-250g 2 22.50 45.00", "2) CGST @ 2.50%, SGST @ 2.50%", "0713 TEST DAL-500g 4 56.00 224.00", "0713 TEST OIL-1lt 20 173.00 3460.00",
  "1701 TEST SUGAR-2kg 2 114.00 228.00", "1905 TEST GLUCOSE-90g 2 9.80 19.60", "Items: 4 Qty: 30 3976.60", "Amount Received From Customer", "UPI Payment : 3976.60 /-",
];
const parsed = () => parseReceiptLines(RECEIPT);
const input = p => ({ items: p.items, printed: p.printed, paidPaise: p.paidPaise });

test("a printed receipt: shop, date, every item row, the printed items total and the amount paid are read", () => {
  const p = parsed();
  assert.equal(p.merchant, "SAMPLE GROCERS TESTVILLE");
  assert.equal(p.date, "2026-10-30");
  assert.deepEqual(p.items.map(i => [i.label, i.qty, i.ratePaise, i.valuePaise]), [["TEST BISCUIT-250g", 2, 2250, 4500], ["TEST DAL-500g", 4, 5600, 22400], ["TEST OIL-1lt", 20, 17300, 346000], ["TEST SUGAR-2kg", 2, 11400, 22800], ["TEST GLUCOSE-90g", 2, 980, 1960]]);
  assert.deepEqual(p.printed, { count: 4, qty: 30, totalPaise: 397660 });
  assert.equal(p.paidPaise, 397660);
  const c = checkReceipt(input(p));
  assert.equal(c.sumPaise, 397660);
  assert.deepEqual([c.e1.status, c.e2.status, c.qty.status, c.linesOk, c.allHold], ["holds", "holds", "holds", true, true]);
});

test("PRIVACY: phone, e-mail, GSTIN, FSSAI, address, bill and cashier numbers are never part of the result", () => {
  const text = JSON.stringify(parsed());
  for (const secret of ["9000000000", "shop@example", "99ZZZZZ", "00000000000000", "Test Yard", "T001-000001", "S000001", "XX/000001"]) assert.equal(text.includes(secret), false, secret);
  assert.deepEqual(Object.keys(parsed()).sort(), ["conflictingPayments", "date", "items", "merchant", "paidPaise", "printed", "unreadable"]);
});

test("a misread amount is SHOWN as failing, never corrected: the row does not multiply and the items do not add up", () => {
  const lines = RECEIPT.map(l => l.replace("3460.00", "3480.00"));
  const p = parseReceiptLines(lines);
  assert.equal(p.items[2].valuePaise, 348000);                       // left exactly as read
  const c = checkReceipt(input(p));
  assert.equal(c.rows[2].ok, false);
  assert.equal(c.rows[2].expectedPaise, 346000);
  assert.deepEqual([c.e1.status, c.e2.status, c.allHold], ["fails", "fails", false]);
});

test("a single-row suggestion exists only when fixing that one row makes the items add up; it is not applied", () => {
  const p = parseReceiptLines(RECEIPT.map(l => l.replace("3460.00", "3480.00")));
  assert.deepEqual(suggestReceiptFix(input(p)), { index: 2, valuePaise: 346000 });
  assert.equal(p.items[2].valuePaise, 348000);
  const two = parseReceiptLines(RECEIPT.map(l => l.replace("3460.00", "3480.00").replace("224.00", "225.00")));
  assert.equal(suggestReceiptFix(input(two)), null);                  // two rows wrong: no guess
  assert.equal(suggestReceiptFix(input(parsed())), null);             // nothing wrong: no suggestion
});

test("a row the engine missed shows up as a shortfall against the amount paid and the printed quantity", () => {
  const p = parseReceiptLines(RECEIPT.filter(l => !l.includes("TEST SUGAR")));
  const c = checkReceipt(input(p));
  assert.equal(p.items.length, 4);
  assert.deepEqual([c.e1.status, c.e2.status, c.qty.status, c.allHold], ["fails", "fails", "fails", false]);
  assert.equal(c.e2.expectedPaise - c.e2.actualPaise, 22800);
});

test("two different payment lines are not guessed between", () => {
  const p = parseReceiptLines([...RECEIPT, "Cash : 100.00"]);
  assert.equal(p.paidPaise, null);
  assert.equal(p.conflictingPayments, true);
  assert.equal(checkReceipt(input(p)).allHold, false);
});

test("without a printed items line the items must still add up to the amount paid; nothing is accepted on a partial reading", () => {
  const p = parseReceiptLines(RECEIPT.filter(l => !l.startsWith("Items:")));
  assert.equal(p.printed, null);
  assert.equal(checkReceipt(input(p)).allHold, true);
  assert.equal(checkReceipt({ items: [], printed: null, paidPaise: 100 }).allHold, false);
  assert.equal(checkReceipt({ items: p.items, printed: null, paidPaise: null }).allHold, false);
});

test("quantities may be decimal (kg), amounts may have thousands commas, dates are validated", () => {
  const p = parseReceiptLines(["TEST SHOP NAME", "Bill Dt : 31/02/2026", "0100 LOOSE RICE 1.5 60.00 90.00", "0100 BIG ITEM 1 1,200.00 1,200.00", "UPI Payment : 1,290.00"]);
  assert.equal(p.date, null);                                          // 31 Feb is not a date
  assert.deepEqual(p.items.map(i => [i.qty, i.ratePaise, i.valuePaise]), [[1.5, 6000, 9000], [1, 120000, 120000]]);
  assert.equal(checkReceipt(input(p)).allHold, true);
  assert.equal(toPaise("1,290.00"), 129000);
  assert.equal(toPaise("12,34"), null);
  assert.equal(parseReceiptLines(["X", "Bill Dt : 30/13/2026"]).date, null);
  assert.equal(parseReceiptLines(["X", "Bill Dt : 28/02/2026"]).date, "2026-02-28");
});

// ---- the reader, with the engine replaced by a fake ----
const png = (o = {}) => ({ type: "image/png", size: 1000, ...o });
const SIZE = { width: 600, height: 1500 };
const fake = (text, opts = {}) => { const c = { terminate: 0, params: null, calls: 0 }; return { c, async setParameters(p) { c.params = p; }, async recognize() { c.calls++; if (opts.fail) throw new Error("x"); return { data: { text } }; }, async terminate() { c.terminate++; } }; };
const deps = w => ({ baseUrl: "https://app.test/", makeWorker: async () => w, sizeOf: async () => SIZE });

test("the reader reads one column of text, returns only the parsed fields, and releases the engine", async () => {
  const w = fake(RECEIPT.join("\n"));
  const r = await readReceiptFromImage(png(), deps(w));
  assert.equal(r.ok, true); assert.equal(r.found, true); assert.equal(r.items.length, 5);
  assert.deepEqual(w.c.params, { tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
  assert.equal(w.c.terminate, 1);
  const text = JSON.stringify(r);
  for (const secret of ["9000000000", "shop@example", "99ZZZZZ", "Test Yard"]) assert.equal(text.includes(secret), false, secret);
});

test("a failed reading says so, still releases the engine, and a declined picture never starts it", async () => {
  const w = fake("", { fail: true });
  assert.deepEqual(await readReceiptFromImage(png(), deps(w)), { ok: false, reason: "engine" });
  assert.equal(w.c.terminate, 1);
  let started = 0;
  const r = await readReceiptFromImage({ type: "application/pdf", size: 5 }, { baseUrl: "x", makeWorker: async () => { started++; return fake(""); }, sizeOf: async () => SIZE });
  assert.equal(r.ok, false); assert.equal(started, 0);
  assert.equal((await readReceiptFromImage(png(), deps(fake("hello\nworld")))).found, false);
});

test("the receipt code never touches storage, the network or the console", () => {
  for (const f of ["receiptParse.js", "ocrReceipt.js"]) {
    const src = readFileSync(fileURLToPath(new URL(`./${f}`, import.meta.url)), "utf8").replace(/^\s*\/\/.*$/gm, "");
    for (const bad of ["localStorage", "sessionStorage", "indexedDB", "fetch(", "console.", "XMLHttpRequest", "sendBeacon", "data.words", "data.hocr"]) assert.equal(src.includes(bad), false, `${f} ${bad}`);
  }
});

test("the receipt panel is off until switched on, loads the engine only when a photo is chosen, records nothing and cannot save an expense", () => {
  const ui = readFileSync(fileURLToPath(new URL("../../screens/ReceiptPhotoReview.jsx", import.meta.url)), "utf8");
  assert.match(ui, /const \[on, setOn\] = useState\(false\)/);
  assert.match(ui, /import\("\.\.\/domain\/receipts\/ocrReceipt\.js"\)/);
  assert.equal(/^import .*ocrReceipt|^import .*ocrEngine|^import .*tesseract/m.test(ui), false);
  assert.match(ui, /const canUse = complete && paidPaise != null && c\.allHold && validDate\(date\)/);
  for (const bad of ["localStorage", "sessionStorage", "indexedDB", "fetch(", "console.", "setTxns", "setLoans", "onConfirm"]) assert.equal(ui.includes(bad), false, bad);
  const screen = readFileSync(fileURLToPath(new URL("../../screens/InvoiceImportScreen.jsx", import.meta.url)), "utf8");
  assert.match(screen, /<ReceiptPhotoReview [^>]*onUse=\{prefill => onAddReceipt && onAddReceipt\(prefill\)\}/);
  const app = readFileSync(fileURLToPath(new URL("../../App.jsx", import.meta.url)), "utf8");
  assert.match(app, /onAddReceipt=\{prefill=>\{ setAddPrefill\(prefill\); setShowAdd\(true\); \}\}/);          // opens the existing form; saving stays the form's own Save
  assert.match(app, /Boolean\(safePrefill\.lineItems\?\.length\)/);
});

test("compensating errors are not accepted: two rows wrong in opposite directions can make the sum right, but the rows must multiply", () => {
  const p = parseReceiptLines(RECEIPT.map(l => l.replace("224.00", "234.00").replace("228.00", "218.00")));
  const c = checkReceipt(input(p));
  assert.equal(c.e2.status, "holds");                 // the total still adds up...
  assert.equal(c.linesOk, false);                     // ...but two rows do not multiply
  assert.equal(c.allHold, false);
  assert.equal(suggestReceiptFix(input(p)), null);
});

test("the printed quantity must match too: everything else holding is not enough", () => {
  const p = parseReceiptLines(RECEIPT.map(l => l.replace("Qty: 30", "Qty: 31")));
  const c = checkReceipt(input(p));
  assert.deepEqual([c.e1.status, c.e2.status, c.linesOk, c.qty.status, c.allHold], ["holds", "holds", true, "fails", false]);
});

test("a heading that merely contains a word like Phone or Email is not taken as the shop name", () => {
  assert.equal(parseReceiptLines(["Phone Helpline Number Office", "Email Support Desk Team", "REAL SHOP NAME", "Bill Dt : 30/10/2026"]).merchant, "REAL SHOP NAME");
  assert.equal(parseReceiptLines(["TAX INVOICE", "GSTIN : 99ZZZZZ0000Z1ZZ", "Phone : 9000000000"]).merchant, "");
});

// ---- rows the engine could not read: reported by AMOUNT only ----
const GARBLED = RECEIPT.map(l => l.replace("0713 TEST DAL-500g 4 56.00 224.00", "0713 TEST DAL-500g 4 56.O0 224.00").replace("1904 TEST BISCUIT-250g 2 22.50 45.00", "1904 TEST BISCUIT-250g Z 22.50 45.00"));

test("an item-area line that ends in an amount but cannot be read is reported by its amount only, never its text", () => {
  const p = parseReceiptLines(GARBLED);
  assert.deepEqual(p.unreadable, [4500, 22400]);
  assert.equal(p.items.length, 3);
  const text = JSON.stringify(p);
  assert.equal(text.includes("BISCUIT"), false);
  assert.equal(text.includes("56.O0"), false);
  const c = checkReceipt(input(p));
  assert.equal(c.allHold, false);                                   // the missing rows also show as a shortfall
  assert.equal(c.e2.expectedPaise - c.e2.actualPaise, 4500 + 22400);
});

test("headings, tax rows, the GST breakup, totals and the footer are never reported as unreadable rows", () => {
  assert.deepEqual(parsed().unreadable, []);
  const withBreakup = [...RECEIPT, "GST IND Taxable Amount CGST SGST Total Amount", "1 45.00 .... .... .... 45.00", "T: 3873.20 108.20 108.20 .... 3976.60", "Software By Test Systems Pvt Ltd, Testville", "Thank You Visit Again 100.00"];
  assert.deepEqual(parseReceiptLines(withBreakup).unreadable, []);
  assert.deepEqual(parseReceiptLines(["SOME SHOP NAME", "Phone Number Helpline 1800.00"]).unreadable, []);     // before the item area starts
});

test("the amount paid is compared with the printed total (information; the sums already block a mismatch)", () => {
  const p = parsed();
  assert.deepEqual(checkReceipt({ ...input(p), paidPaise: 397680 }).paidVsPrinted, { status: "differs", printedPaise: 397660, paidPaise: 397680 });
  assert.equal(checkReceipt(input(p)).paidVsPrinted.status, "holds");
  assert.equal(checkReceipt({ ...input(p), printed: null }).paidVsPrinted.status, "incomplete");
  assert.equal(checkReceipt({ ...input(p), paidPaise: 397680 }).allHold, false);
});

test("the review panel lets the person add a row, and says which unreadable amounts to add", () => {
  const ui = readFileSync(fileURLToPath(new URL("../../screens/ReceiptPhotoReview.jsx", import.meta.url)), "utf8");
  assert.match(ui, /data-testid="receipt-add-row"/);
  assert.match(ui, /data-testid="receipt-unreadable"/);
  assert.match(ui, /data-testid="receipt-paid-differs"/);
  assert.equal(/unreadable\.map\(v => inr/.test(ui), true);       // amounts only
});
