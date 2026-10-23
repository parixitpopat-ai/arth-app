// Brand removal for item names: the expense shows the plain product; the brand is remembered in the background. Synthetic names only.
import test from "node:test";
import assert from "node:assert/strict";
import { BLINKIT_FIXTURE_3_ITEMS as ITEMS } from "./fixtures/blinkitGstInvoiceItems.fixture.js";
import { analysePage } from "./blinkitPdf.js";
import { buildInvoicePreviews } from "./invoicePreview.js";
import { splitBrand, cleanProduct, sizeOf } from "./brands.js";
import { planConfirm, resolveItemNames, suggestLineCats } from "./invoiceImport.js";

const previewOf = items => buildInvoicePreviews({ status: "supported", fileHash: "h", pages: [analysePage({ number: 1, items, textChars: 9999, imageOps: 0 })] }).invoices[0];
const view = () => previewOf(ITEMS.map(i => ({ ...i }))).view;
let n = 0; const genId = () => `id${++n}`;
const plan = (o = {}, ctx = {}) => planConfirm({ view: view(), status: "supported", mode: "create", accountId: "b1", paymentDate: "2026-01-15", orderCatId: "groceries", ...o }, { accounts: [{ id: "b1", name: "Bank" }], txns: [], records: [], genId, today: "2026-10-23", ...ctx });

test("the brand is removed from the start of the name and the plain product is kept", () => {
  const cases = [
    ["Lay's India's Magic Masala Chips", "Lay's", "India's Magic Masala Chips"],
    ["Haldiram's Nagpur Moong Dal Namkeen(Pack)", "Haldiram's Nagpur", "Moong Dal Namkeen"],      // the longer brand wins over "Haldiram's"
    ["Pillsbury Fresh Chakki Atta (0% Maida)(Bag)", "Pillsbury", "Fresh Chakki Atta (0% Maida)"],  // the generic "(Bag)" goes, the meaningful bracket stays
    ["4700BC Cheese & Jalapeno Nachos(Packet)", "4700BC", "Cheese & Jalapeno Nachos"],
    ["Surf Excel Matic 1 kg", "Surf Excel", "Matic 1 kg"],
  ];
  for (const [name, brand, product] of cases) { const r = splitBrand(name); assert.deepEqual([r.brand, r.product], [brand, product], name); }
});

test("curly apostrophes and capitalisation do not matter", () => {
  assert.equal(splitBrand("LAY’S Classic Salted Chips").brand, "LAY’S".replace("’", "'"));
  assert.equal(splitBrand("lay's classic chips").product, "classic chips");
});

test("a name that only starts like a brand is NOT stripped (Amulya is not Amul); an unknown brand keeps the full name; a brand with nothing after it is kept whole", () => {
  assert.deepEqual([splitBrand("Amulya Dairy Whitener").brand, splitBrand("Amulya Dairy Whitener").product], [null, "Amulya Dairy Whitener"]);
  assert.deepEqual([splitBrand("Zorro Crunchy Bites 100 g").brand, splitBrand("Zorro Crunchy Bites 100 g").product], [null, "Zorro Crunchy Bites 100 g"]);
  assert.deepEqual([splitBrand("Amul").brand, splitBrand("Amul").product], [null, "Amul"]);
});

test("the size printed in the name is kept for comparison", () => {
  assert.equal(sizeOf("Amul Taaza Toned Milk 1 L"), "1 l");
  assert.equal(sizeOf("Dettol Handwash 200 ml"), "200 ml");
  assert.equal(sizeOf("Aashirvaad Atta 5 kg"), "5 kg");
  assert.equal(sizeOf("Chips"), null);
  assert.equal(cleanProduct("Chips(Pack)"), "Chips");
});

test("what the person told Arth about a barcode last time wins over the list, even 'no brand'", () => {
  const remembered = [{ upc: "123", brand: "Amul", product: "Taaza Toned Milk 1 L" }];
  assert.equal(splitBrand("Amul Taaza Toned Milk 1 L", { upc: "123", remembered }).source, "remembered");
  const none = [{ upc: "123", brand: null, product: "Amul Taaza Toned Milk 1 L" }];
  const r = splitBrand("Amul Taaza Toned Milk 1 L", { upc: "123", remembered: none });
  assert.deepEqual([r.brand, r.product], [null, "Amul Taaza Toned Milk 1 L"]);
});

test("the saved expense lines show the plain product names (no brand), still adding up to the invoice total", () => {
  const r = plan();
  assert.equal(r.ok, true);
  assert.deepEqual(r.create.lineItems.slice(0, 3).map(l => l.label), ["Moong Dal Namkeen", "Sev Bhujia", "Fresh Chakki Atta (0% Maida)"]);
  assert.equal(Math.round(r.create.lineItems.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100), 112500);
  assert.doesNotMatch(JSON.stringify(r.create), /Haldiram|Pillsbury/);
});

test("the brand is remembered in the background record, with the full printed name, barcode, size and price, for brand comparison", () => {
  const r = plan();
  assert.deepEqual(r.record.lines.map(l => [l.brand, l.product, l.upc]), [["Haldiram's Nagpur", "Moong Dal Namkeen", "8904004403732"], ["Haldiram's Nagpur", "Sev Bhujia", "8904004400083"], ["Pillsbury", "Fresh Chakki Atta (0% Maida)", "8906000210321"]]);
  assert.match(r.record.lines[0].full, /^Haldiram's Nagpur Moong Dal Namkeen/);
  assert.deepEqual([r.record.lines[2].qty, r.record.lines[2].amount, r.record.lines[2].unitPrice], [2, 932, 466]);
  assert.doesNotMatch(JSON.stringify(r.record), /Name|Address/);
});

test("the person can correct a name or brand; a cleared brand brings the full name back; 'keep brands' switch keeps full names but still remembers the brand", () => {
  const edited = plan({ itemNames: { 1: "Moong Dal" }, itemBrands: { 2: "" } });
  assert.equal(edited.create.lineItems[0].label, "Moong Dal");
  assert.match(edited.create.lineItems[1].label, /^Haldiram's Nagpur Sev Bhujia/);                       // brand cleared on item 2: full name
  assert.equal(edited.record.lines[1].brand, null);
  const keep = plan({ stripBrands: false });
  assert.match(keep.create.lineItems[0].label, /^Haldiram's Nagpur Moong Dal Namkeen/);
  assert.equal(keep.record.lines[0].brand, "Haldiram's Nagpur");
});

test("a correction made once is reused the next time the same barcode comes up", () => {
  const first = plan({ itemBrands: { 1: "Haldirams (Nagpur)" }, itemNames: { 1: "Moong Dal Namkeen" } });
  const second = resolveItemNames(view(), [first.record]);
  assert.equal(second[1].brand, "Haldirams (Nagpur)");
  assert.equal(second[1].source, "remembered");
});

test("category memory is keyed by the plain product name, so it carries across brands; old full-name entries still match", () => {
  const v = view(), names = resolveItemNames(v, []);
  assert.deepEqual(suggestLineCats(v, [{ id: "c1", name: "Moong Dal Namkeen", catId: "snacks" }], null, names), { 1: "snacks" });
  assert.deepEqual(suggestLineCats(v, [{ id: "c2", name: "Pillsbury Fresh Chakki Atta (0% Maida)(Bag)", catId: "groceries" }], null, names), { 3: "groceries" });
  const r = plan({}, { catalog: [] });
  assert.deepEqual(r.learn.map(l => l.name), ["Moong Dal Namkeen", "Sev Bhujia", "Fresh Chakki Atta (0% Maida)"]);
});

test("delivery lines name the plain product of their item", () => {
  const v = JSON.parse(JSON.stringify(view())); v.handling = { ...v.handling, verified: false, consolidated: false };
  const r = planConfirm({ view: v, status: "supported", mode: "create", accountId: "b1", paymentDate: "2026-01-15", orderCatId: "groceries" }, { accounts: [{ id: "b1", name: "B" }], txns: [], records: [], genId, today: "2026-10-23" });
  assert.deepEqual(r.create.lineItems.slice(3).map(l => l.label.replace("Delivery and other charges · ", "")), ["Moong Dal Namkeen", "Sev Bhujia", "Fresh Chakki Atta (0% Maida)"]);
});
