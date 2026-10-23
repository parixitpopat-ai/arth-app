// Phase 1 preview model: critical paths. Synthetic/redacted data only (fixture 3 + PDFs drawn by testing/pdfMaker.js).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BLINKIT_FIXTURE_3_ITEMS as ITEMS } from "./fixtures/blinkitGstInvoiceItems.fixture.js";
import { analyseBlinkitPdf, analysePage } from "./blinkitPdf.js";
import { buildInvoicePreviews, suggestMatches, validatePaymentDate, describeNextStep, diagnosticEntry, MATCH } from "./invoicePreview.js";
import { makePdf } from "./testing/pdfMaker.js";

const here = dirname(fileURLToPath(import.meta.url));
const base = () => ITEMS.map(i => ({ ...i }));
const swap = (pred, str) => base().map(i => (pred(i) ? { ...i, str } : i));
const drawn = items => makePdf([{ texts: items.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })) }]);
const preview = async (items, ctx) => buildInvoicePreviews(await analyseBlinkitPdf(drawn(items)), ctx);
const TXNS = [
  { id: "t1", type: "expense", merchant: "Blinkit", date: "2026-01-16", amount: 1125, accId: "b1" },
  { id: "t2", type: "expense", merchant: "Blinkit", date: "2026-01-15", amount: 1135, accId: "b1" },
  { id: "t3", type: "expense", merchant: "Blinkit", date: "2026-01-15", amount: 2000, accId: "b1" },
  { id: "t4", type: "expense", merchant: "Cafe", date: "2026-01-15", amount: 1130, accId: "b1" },
  { id: "t5", type: "expense", merchant: "Blinkit", date: "2026-01-30", amount: 1125, accId: "b1" },
  { id: "t6", type: "cc_payment", merchant: "", date: "2026-01-15", amount: 1125, fromAccId: "b1", toAccId: "c1" },
  { id: "t7", type: "expense", merchant: "Blinkit", date: "2026-01-15", amount: 1125, accId: "b1", isRefund: true },
];
const ACCS = [{ id: "b1", name: "Test Bank" }];

test("valid invoice: header as printed, items with MRP / discount / qty / line total, one verified handling charge, total Rs 1,125.00", async () => {
  const r = await preview(base(), { transactions: [], accounts: ACCS });
  assert.equal(r.status, "supported");
  const v = r.invoices[0].view;
  assert.deepEqual([v.invoiceDate, v.orderId, v.invoiceNumber, v.sellerGstin, v.placeOfSupply], ["2026-01-15", "0000000001", "C00000T000000001", "30AAFCG9846E1ZO", "Goa"]);
  assert.deepEqual(v.items.map(i => [i.qty, i.mrp, i.discount, i.lineTotal]), [[1, 60, 0, 60], [1, 120, 0, 120], [2, 606, 280, 932]]);
  assert.deepEqual(v.items.map(i => [i.cgst, i.sgst]), [[1.43, 1.43], [2.86, 2.86], [22.19, 22.19]]);
  assert.equal(v.items[2].perUnitAfterDiscount, 466);                       // derived, labelled as derived in the UI
  assert.equal(v.totals.invoiceTotal, 1125);
  assert.equal(r.invoices[0].duplicate.status, "new");
  assert.equal(v.paymentMethod.shown, false);
});

test("discounts stay inside the line: no negative amount anywhere in the preview", async () => {
  const v = (await preview(base())).invoices[0].view;
  const nums = []; JSON.stringify({ items: v.items, handling: v.handling, totals: v.totals }, (k, x) => { if (typeof x === "number") nums.push(x); return x; });
  assert.ok(nums.every(n => n >= 0), "no negative numbers");
  assert.equal(v.items[2].mrp * v.items[2].qty - v.items[2].discount, v.items[2].lineTotal);
});

test("the three delivery rows become ONE handling charge of Rs 13.00 because rows and annexure verify; the source rows are kept", async () => {
  const h = (await preview(base())).invoices[0].view.handling;
  assert.deepEqual([h.verified, h.consolidated, h.label, h.total, h.taxRate], [true, true, "Handling charge", 13, 5]);
  assert.deepEqual(h.sourceRows.map(r => [r.afterItem, r.total]), [[1, 0.7], [2, 1.4], [3, 10.9]]);
  assert.equal(h.sourceRows[0].raw[2], "Delivery and other charges");
  assert.deepEqual(h.annexure, { taxable: 12.381, cgst: 0.31, sgst: 0.31 });
});

test("delivery rows that do NOT verify against the annexure are shown as printed and NOT combined into one charge", async () => {
  const items = base().map(i => (i.str === "12.381" ? { ...i, str: "9.000" } : i.str === "0.310" ? { ...i, str: "0.225" } : i));
  const r = await preview(items);
  const h = r.invoices[0].view.handling;
  assert.deepEqual([h.verified, h.consolidated, h.label], [false, false, "Delivery and other charges"]);
  assert.equal(h.sourceRows.length, 3);
  assert.match(h.note, /not combined|shown as printed/);
  assert.equal(r.invoices[0].status, "needs-review");
});

test("invoice date is the printed date; the payment date is a separate value that defaults to it; no order time exists anywhere", async () => {
  const r = await preview(base(), { paymentDates: { 1: "2026-01-16" } });
  assert.equal(r.invoices[0].view.invoiceDate, "2026-01-15");
  assert.equal(r.invoices[0].paymentDate, "2026-01-16");
  assert.equal((await preview(base())).invoices[0].paymentDate, "2026-01-15");
  assert.doesNotMatch(JSON.stringify(r.invoices[0].view), /\d{1,2}:\d{2}|\bpm\b|\bam\b|orderTime|order_time/i);
});

test("payment date validation: real date, not in the future", () => {
  assert.equal(validatePaymentDate("2026-01-15", "2026-10-01").ok, true);
  assert.equal(validatePaymentDate("2026-02-31", "2026-10-01").ok, false);
  assert.equal(validatePaymentDate("2026-11-01", "2026-10-01").ok, false);
  assert.equal(validatePaymentDate("", "2026-10-01").ok, false);
});

test("duplicate invoice: already imported (stored key) and the same file chosen twice are explained, not guessed", async () => {
  const key = "blinkit|30AAFCG9846E1ZO|C00000T000000001";
  const stored = await preview(base(), { existingKeys: [key] });
  assert.equal(stored.invoices[0].duplicate.status, "already-imported");
  assert.match(stored.invoices[0].duplicate.why, /imported before/);
  const bytes = drawn(base()), a = await analyseBlinkitPdf(bytes);
  const again = buildInvoicePreviews(await analyseBlinkitPdf(bytes), { existingFileHashes: [a.fileHash] });
  assert.equal(again.invoices[0].duplicate.status, "same-file");
});

test("missing invoice number: duplicates cannot be checked, and that is said plainly; the invoice needs review", async () => {
  const r = await preview(base().filter(i => i.str !== "C00000T000000001"));
  const inv = r.invoices[0];
  assert.equal(inv.status, "needs-review");
  assert.equal(inv.duplicate.status, "no-key");
  assert.match(inv.duplicate.why, /cannot be checked for duplicates/);
  assert.ok(inv.reasonCodes.includes("no-invoice-number"));
});

test("unreadable / unsupported inputs each get a title, a plain message and next actions; nothing is parsed", async () => {
  const junk = buildInvoicePreviews(await analyseBlinkitPdf(new TextEncoder().encode("%PDF-1.4\ngarbage")));
  assert.equal(junk.status, "unreadable"); assert.match(junk.outcome.message, /Download the invoice again/); assert.deepEqual(junk.outcome.actions.map(a => a.id), ["choose-another", "add-by-hand"]); assert.equal(junk.invoices.length, 0);
  const scan = buildInvoicePreviews(await analyseBlinkitPdf(makePdf([{ texts: [], image: { x: 0, y: 0, w: 595, h: 842 } }])));
  assert.equal(scan.invoices[0].outcome.title, "This PDF is a picture, not text"); assert.match(scan.invoices[0].outcome.message, /OCR/); assert.equal(scan.invoices[0].view, null);
  const other = buildInvoicePreviews(await analyseBlinkitPdf(makePdf([{ texts: Array.from({ length: 10 }, (_, n) => ({ str: `some other document line ${n}`, x: 20, y: 700 - n * 14 })) }])));
  assert.equal(other.invoices[0].outcome.title, "Couldn't recognise this invoice"); assert.ok(other.invoices[0].outcome.actions.some(a => a.id === "add-by-hand"));
});

test("cancellation / credit note: shown as 'not a purchase', no preview, no amount, nothing created", async () => {
  for (const title of ["Credit Note", "Cancellation Note"]) {
    const r = await preview(swap(i => i.str === "Tax Invoice", title));
    const inv = r.invoices[0];
    assert.equal(inv.status, "unsupported", title);
    assert.equal(inv.view, null);
    assert.equal(inv.outcome.title, "This isn't a purchase invoice");
    assert.match(inv.outcome.message, /Nothing was added/);
  }
  const refundHeader = await preview(base().map(i => (i.str === "Place of Supply" ? { ...i, str: "Cancelled order refund Place of Supply" } : i)));
  assert.equal(refundHeader.invoices[0].view, null);
  assert.doesNotMatch(readFileSync(join(here, "invoicePreview.js"), "utf8"), /setTxns|localStorage|arth_txns|\.push\(\{ id:/);   // the model has no way to write a transaction
});

test("incorrect extraction: a wrong printed figure is NOT corrected; it is shown as printed with a 'does not add up' flag and review status", async () => {
  const r = await preview(swap(i => i.str === "932.00", "902.00"));
  const inv = r.invoices[0];
  assert.equal(inv.status, "needs-review");
  assert.equal(inv.view.reconciliation.level, "does-not-add-up");
  assert.equal(inv.view.items[2].lineTotal, 902);
  assert.ok(inv.view.reconciliation.issues.some(x => x.level === "error"));
  assert.equal(inv.outcome.title, "Check this before relying on it");
});

test("matching: same amount and a similar amount are SUGGESTED in order; far dates, other merchants, refunds and card-bill payments are not", () => {
  const r = suggestMatches(1125000, ["2026-01-15"], { transactions: TXNS, accounts: ACCS });
  assert.deepEqual(r.matches.map(m => [m.id, m.strength]), [["t1", "same-amount"], ["t2", "similar"]]);
  assert.deepEqual(r.hints.map(h => h.id), ["t3"]);                        // Rs 875 larger: another invoice may exist
  assert.equal(r.matches[0].account, "Test Bank");
  assert.ok(r.matches[1].reasons.some(x => /more than the invoice/.test(x)));
  assert.ok(r.matches.every(m => m.reasons.some(x => /does not say which account/.test(x))));
  assert.ok(!r.matches.some(m => ["t4", "t5", "t6", "t7"].includes(m.id)));   // t4 other merchant, t5 15 days away, t6 card bill, t7 refund
});

test("matching never links: no function returns a link, inputs are not changed, and a suggestion carries no 'linked' state", () => {
  const snap = JSON.stringify(TXNS), r = suggestMatches(1125000, ["2026-01-15"], { transactions: TXNS, accounts: ACCS });
  assert.equal(JSON.stringify(TXNS), snap);
  assert.ok(r.matches.every(m => !("linked" in m) && !("linkedTo" in m)));
});

test("matching uses the chosen payment date as well as the invoice date", () => {
  const far = [{ id: "x", type: "expense", merchant: "Blinkit", date: "2026-01-19", amount: 1125, accId: "b1" }];
  assert.equal(suggestMatches(1125000, ["2026-01-15"], { transactions: far }).matches.length, 0);
  assert.equal(suggestMatches(1125000, ["2026-01-15", "2026-01-18"], { transactions: far }).matches.length, 1);
});

test("what a later confirmation would do is a sentence about linking or adding; it is information only", async () => {
  const v = (await preview(base(), { transactions: TXNS, accounts: ACCS })).invoices[0];
  assert.match(describeNextStep(v.view, v.matches[0]), /would link this invoice to your ₹1,125 expense/);
  assert.match(describeNextStep(v.view, null), /would add 1 expense of ₹1,125 with 3 items, after you choose the account/);
  assert.ok(MATCH.dayWindow === 3 && MATCH.minTolPaise === 2500);
});

test("split orders: the preview never claims a complete order", async () => {
  const v = (await preview(base())).invoices[0].view;
  assert.equal(v.split.known, false);
  assert.match(v.split.message, /another invoice may exist/);
});

test("diagnostics carry status and codes only: no names, amounts, identifiers, GSTIN or dates", async () => {
  const analysis = await analyseBlinkitPdf(drawn(swap(i => i.str === "932.00", "902.00")));
  const d = JSON.stringify(diagnosticEntry(analysis, 440000));
  assert.match(d, /needs-review/);
  assert.doesNotMatch(d, /Haldiram|Pillsbury|902|1125|C00000T|0000000001|30AAFCG|2026-01|Blink/);
  assert.deepEqual(diagnosticEntry(analysis, 440000).sizeBucket, "<1MB");
});

test("a page object from the layout path carries reason codes the UI can act on", () => {
  const p = analysePage({ number: 1, items: [], textChars: 3, imageOps: 1 });
  assert.deepEqual([p.status, p.reasonCodes], ["requires-ocr", ["no-text-layer"]]);
});

// A real invoice listed ONE "Handling charge" twice in the annexure, once per tax rate (5% and 18%). The rows still add up to it, so they are one charge.
test("charge rows consolidate when the annexure lists the same charge once per tax rate; a different kind of charge does not", async () => {
  const { parseBlinkitGstInvoice } = await import("./blinkitGst.js");
  const { BLINKIT_FIXTURE_1 } = await import("./fixtures/blinkitGstInvoice.fixture.js");
  const view = rows => {
    const parsed = parseBlinkitGstInvoice({ ...BLINKIT_FIXTURE_1, annexureRows: [BLINKIT_FIXTURE_1.annexureRows[0], ...rows, ["Total", "", "", "", "12.381", "0.310", "0.310", "0.000"]] });
    const out = buildInvoicePreviews({ status: "supported", fileHash: "h", pages: [{ page: 1, status: "supported", parsed }] });
    return out.invoices ? out.invoices[0].view : out[0].view;
  };
  const same = view([["1", "Handling charge", "18.00", "0.00", "3.000", "0.270", "0.270", "0.000"], ["2", "Handling charge", "5.00", "0.00", "9.381", "0.040", "0.040", "0.000"]]);
  assert.equal(same.handling.consolidated, true);
  assert.equal(same.handling.taxRate, null);
  const mixed = view([["1", "Handling charge", "5.00", "0.00", "6.000", "0.150", "0.150", "0.000"], ["2", "Packaging fee", "5.00", "0.00", "6.381", "0.160", "0.160", "0.000"]]);
  assert.equal(mixed.handling.consolidated, false);
});
