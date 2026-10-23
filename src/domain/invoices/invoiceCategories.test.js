// Categories for invoice lines: delivery/handling are FEES that follow their item's category; item categories are remembered in the app's item catalogue.
import test from "node:test";
import assert from "node:assert/strict";
import { BLINKIT_FIXTURE_3_ITEMS as ITEMS } from "./fixtures/blinkitGstInvoiceItems.fixture.js";
import { analysePage } from "./blinkitPdf.js";
import { buildInvoicePreviews } from "./invoicePreview.js";
import { planConfirm, buildLineItems, suggestLineCats } from "./invoiceImport.js";

const page = items => ({ number: 1, items, textChars: 9999, imageOps: 0 });
const previewOf = items => buildInvoicePreviews({ status: "supported", fileHash: "h", pages: [analysePage(page(items))] }).invoices[0];
const base = () => ITEMS.map(i => ({ ...i }));
// Same invoice, but the charge table does not match the rows, so the three delivery rows stay as printed lines (the situation in the phone screenshot).
const unverified = () => base().map(i => (i.str === "12.381" ? { ...i, str: "9.000" } : i.str === "0.310" ? { ...i, str: "0.225" } : i));
// The invoice reconciles, but its delivery rows could not be tied to ONE charge (e.g. the charge table lists several kinds): rows stay as printed lines.
const rowsAsPrinted = () => { const v = JSON.parse(JSON.stringify(previewOf(base()).view)); v.handling = { ...v.handling, verified: false, consolidated: false }; return v; };
let n = 0; const genId = () => `id${++n}`;
const ACCS = [{ id: "b1", name: "Bank" }];
const run = (view, o = {}, ctx = {}) => planConfirm({ view, status: "supported", mode: "create", accountId: "b1", paymentDate: "2026-01-15", ...o }, { accounts: ACCS, txns: [], records: [], genId, today: "2026-10-23", ...ctx });

test("screenshot case: no order category, each item categorised on its own: every delivery row takes the category of ITS item, none is left needing one", () => {
  const v = rowsAsPrinted();
  assert.equal(v.handling.consolidated, false);
  const r = run(v, { orderCatId: null, lineCats: { 1: "snacks", 2: "snacks", 3: "groceries" } });
  assert.equal(r.ok, true);
  const lines = r.create.lineItems;
  assert.equal(lines.length, 6);
  assert.deepEqual(lines.map(l => l.catId), ["snacks", "snacks", "groceries", "snacks", "snacks", "groceries"]);   // items, then each item's delivery row
  assert.ok(lines.slice(3).every(l => /^Delivery and other charges · /.test(l.label)));
  assert.ok(lines.every(l => l.catId));
  assert.equal(r.uncategorised, 0);
});

test("a delivery row's label names its item, and the lines still add up to the invoice total", () => {
  const v = previewOf(unverified()).view;
  const lines = buildLineItems(v, { orderCatId: null, lineCats: { 3: "groceries" }, genId });
  assert.match(lines[3].label, /Haldiram/); assert.match(lines[5].label, /Pillsbury/);
  assert.equal(Math.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100), 112500);
});

test("a combined handling charge takes the order category, else the category of the biggest categorised item", () => {
  const v = previewOf(base()).view;
  assert.equal(v.handling.consolidated, true);
  assert.equal(buildLineItems(v, { orderCatId: "groceries", lineCats: { 3: "food" }, genId }).pop().catId, "groceries");
  assert.equal(buildLineItems(v, { orderCatId: null, lineCats: { 1: "snacks", 2: "snacks", 3: "household" }, genId }).pop().catId, "household");   // item 3 (₹932) is the biggest
});

test("a fee line is left without a category only when no item has one", () => {
  const v = rowsAsPrinted();
  const r = run(v, { orderCatId: null, lineCats: {} });
  assert.equal(r.ok, true);
  assert.equal(r.uncategorised, 6);
  assert.ok(r.create.lineItems.every(l => !l.catId));
});

test("what Arth remembers for an item name is suggested (exact name, any capitalisation); entries without a category are ignored", () => {
  const v = previewOf(base()).view;
  const catalog = [{ id: "c1", name: "PILLSBURY FRESH CHAKKI ATTA (0% MAIDA)(BAG)", catId: "groceries" }, { id: "c2", name: "Haldiram's Nagpur Sev Bhujia(Pack)", catId: "" }, { id: "c3", name: "Something else", catId: "food" }];
  assert.deepEqual(suggestLineCats(v, catalog), { 3: "groceries" });
});

test("precedence for an item: the person's own choice, then what Arth remembers, then the order category", () => {
  const v = previewOf(base()).view;
  const lines = buildLineItems(v, { orderCatId: "household", lineCats: { 1: "food" }, suggestedCats: { 1: "snacks", 2: "snacks" }, genId });
  assert.deepEqual(lines.slice(0, 3).map(l => l.catId), ["food", "snacks", "household"]);
});

test("learning: new item names are remembered with their final category; a known name changes only on an explicit different choice; 'remember' off learns nothing", () => {
  const v = previewOf(base()).view;
  const known = [{ id: "k1", name: "Pillsbury Fresh Chakki Atta (0% Maida)(Bag)", catId: "groceries" }];
  const a = run(v, { orderCatId: "groceries" }, { catalog: known });
  assert.deepEqual(a.learn.map(l => [l.op, l.catId]), [["add", "groceries"], ["add", "groceries"]]);          // items 1 and 2 are new, item 3 is known and unchanged
  const b = run(v, { orderCatId: "groceries", lineCats: { 3: "household" } }, { catalog: known });
  assert.ok(b.learn.some(l => l.op === "update" && l.id === "k1" && l.catId === "household"));
  const c = run(v, { orderCatId: "groceries", rememberCats: false }, { catalog: known });
  assert.deepEqual(c.learn, []);
  const d = run(v, { orderCatId: null }, { catalog: [] });
  assert.deepEqual(d.learn, []);                                                                           // nothing to remember when an item has no category
});

test("learning never happens for a plan that is refused", () => {
  const v = previewOf(base()).view;
  const r = run(v, { orderCatId: "groceries", accountId: "" });
  assert.equal(r.ok, false);
  assert.equal(r.learn, undefined);
});

test("a remembered category that no longer exists in the person's categories is not suggested", () => {
  const v = previewOf(base()).view;
  const catalog = [{ id: "c1", name: "Pillsbury Fresh Chakki Atta (0% Maida)(Bag)", catId: "deleted-cat" }];
  assert.deepEqual(suggestLineCats(v, catalog, ["groceries", "food"]), {});
  assert.deepEqual(suggestLineCats(v, catalog, ["deleted-cat"]), { 3: "deleted-cat" });
});

test("delivery / handling lines are marked as CHARGES (shared by splits, not by item); items are not", () => {
  const items = buildLineItems(rowsAsPrinted(), { orderCatId: "groceries", genId });
  assert.deepEqual(items.map(l => l.kind || "item"), ["item", "item", "item", "charge", "charge", "charge"]);
  assert.ok(items.slice(3).every(l => l.chargeType === "delivery"));
  const one = buildLineItems(previewOf(base()).view, { orderCatId: "groceries", genId });
  const h = one[one.length - 1];
  assert.equal(h.kind, "charge");
  assert.equal(h.chargeType, "handling");
  assert.deepEqual(h.taxIncluded, { cgst: 0.31, sgst: 0.31 });          // the GST inside the ₹13.00, for the breakup
  assert.equal(one.slice(0, -1).some(l => l.kind), false);
});
