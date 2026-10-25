import test from "node:test";
import assert from "node:assert/strict";
import { makePdf } from "./testing/pdfMaker.js";
import { readInvoiceBatch, summariseOrders, batchCounts, findProbableDuplicates } from "./amazonBatch.js";
import { productPage, feePage, BUYER, ADDR, PHONE, TXN } from "./fixtures/amazonInvoice.fixture.js";

const draw = (...pages) => makePdf(pages.map(items => ({ texts: items.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })) })));
const item = (n, o = {}) => productPage({ orderNo: "123-4567890-1234567", invNo: `SMP-${n}`, ...o });
const fee = n => feePage().map(i => (i.str === "AMZ-2002" ? { ...i, str: `AMZ-${3000 + n}` } : i));

test("several PDFs, a merged PDF and a mixed selection are read one after another with progress", async () => {
  const progress = [];
  const files = [draw(item(1)), draw(fee(1), item(2)), makePdf([{ texts: [], image: { x: 0, y: 0, w: 595, h: 842 } }]), new TextEncoder().encode("%PDF-1.4\ngarbage")];
  const r = await readInvoiceBatch(files, { onProgress: p => progress.push(p.done) });
  assert.deepEqual(progress, [0, 1, 2, 3, 4]);
  assert.equal(r.parsed.length, 3);
  assert.deepEqual(r.outcomes.map(o => o.kind), ["read", "pages", "requires-ocr", "unreadable"]);
  const c = batchCounts(r.outcomes, r.parsed);
  assert.deepEqual([c.files, c.invoicesRead, c.needsOcr, c.unreadable], [4, 3, 1, 1]);
});

test("an exact repeat is counted once: the same file twice, and the same invoice in two different files", async () => {
  const a = draw(item(1)), b = draw(item(1), item(1));
  const r = await readInvoiceBatch([a, a, b]);
  assert.equal(r.parsed.length, 1);
  assert.equal(batchCounts(r.outcomes, r.parsed).exactDuplicates, 3);
});

test("probable duplicates (same seller, date, total and description, different invoice number) are both kept and only flagged", async () => {
  const r = await readInvoiceBatch([draw(item(1)), draw(item(2))]);
  assert.equal(r.parsed.length, 2);
  assert.deepEqual(findProbableDuplicates(r.parsed), [["SMP-1", "SMP-2"]]);
  const [o] = summariseOrders(r.parsed);
  assert.equal(o.invoicedPaise, 2 * 96900); assert.deepEqual(o.flaggedInvoiceNumbers.sort(), ["SMP-1", "SMP-2"]);
});

test("distinct invoices are never dropped: different amounts or sellers are not duplicates", async () => {
  const other = item(3, { sellerName: "Other Traders" });
  const r = await readInvoiceBatch([draw(item(1)), draw(other)]);
  assert.equal(r.parsed.length, 2); assert.deepEqual(findProbableDuplicates(r.parsed), []);
});

test("repeated processing-fee invoices are grouped for display with every source invoice and amount kept", async () => {
  const files = Array.from({ length: 5 }, (_, i) => draw(fee(i + 1)));
  const r = await readInvoiceBatch([...files, draw(item(1))]);
  const [o] = summariseOrders(r.parsed);
  assert.equal(o.fees.count, 5); assert.equal(o.fees.totalPaise, 5 * 333); assert.equal(o.fees.sources.length, 5);
  assert.deepEqual(o.fees.sources.map(s => s.totalPaise), [333, 333, 333, 333, 333]);
  assert.equal(o.sellers.length, 1); assert.equal(o.invoicedPaise, 96900 + 5 * 333);
});

test("each order is labelled unverified (no order summary) and never shows a match", async () => {
  const r = await readInvoiceBatch([draw(item(1)), draw(item(4, { orderNo: "999-0000000-0000000" }))]);
  const orders = summariseOrders(r.parsed);
  assert.equal(orders.length, 2);
  for (const o of orders) assert.deepEqual(o.reconciliation, { state: "unverified", label: "Unverified — no order summary" });
});

test("the 10-page / 10 MB limits are still enforced and reported, not raised", async () => {
  const many = makePdf(Array.from({ length: 11 }, () => ({ texts: item(1).map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })) })));
  const r = await readInvoiceBatch([many]);
  assert.equal(r.outcomes[0].kind, "too-many-pages"); assert.equal(r.parsed.length, 0);
});

test("a Blinkit invoice in a mixed selection is reported, not mixed into Amazon orders, and a stop request skips the rest", async () => {
  const r = await readInvoiceBatch([draw(item(1)), draw(item(2))], { shouldStop: (() => { let n = 0; return () => ++n > 1; })() });
  assert.equal(r.parsed.length, 1); assert.equal(r.outcomes[1].kind, "unsupported");
});

test("PRIVACY: nothing from the buyer block, the payment block or a file name appears in any outcome or summary", async () => {
  const r = await readInvoiceBatch([draw(fee(1), item(1))]);
  const dump = JSON.stringify({ outcomes: r.outcomes, orders: summariseOrders(r.parsed), counts: batchCounts(r.outcomes, r.parsed) });
  for (const s of [BUYER, ADDR, PHONE, TXN, "Credit Card", ".pdf"]) assert.ok(!dump.includes(s), s);
});

test("a 338-document batch reads in order, de-duplicates and stays within memory-free bookkeeping (stress, synthetic)", async () => {
  const files = [];
  for (let i = 0; i < 200; i++) files.push(draw(fee(i + 1)));
  for (let i = 0; i < 130; i++) files.push(draw(item(i + 1, { invNo: `SMP-${i + 1}`, sellerName: `Seller ${i % 7}` })));
  for (let i = 0; i < 4; i++) files.push(files[i]);          // 4 exact repeats
  assert.equal(files.length, 334);
  const t0 = Date.now(); const r = await readInvoiceBatch(files); const ms = Date.now() - t0;
  const c = batchCounts(r.outcomes, r.parsed);
  assert.equal(c.invoicesRead, 330); assert.equal(c.exactDuplicates, 4);
  const [o] = summariseOrders(r.parsed);
  assert.equal(o.fees.count, 200); assert.equal(o.fees.totalPaise, 200 * 333); assert.equal(o.sellers.length, 7);
  assert.ok(ms < 60000, `took ${ms} ms`);
});

test("repeats across two batches in one session are counted once (known sets carried over)", async () => {
  const first = await readInvoiceBatch([draw(item(1))]);
  const second = await readInvoiceBatch([draw(item(1)), draw(item(2))], { known: first.known });
  assert.deepEqual(second.outcomes.map(o => o.kind), ["exact-duplicate", "read"]);
  assert.equal(second.parsed.length, 1);
});

test("the same non-invoice file chosen twice (a picture-only PDF) is counted once as a repeat, not twice as a picture", async () => {
  const scan = makePdf([{ texts: [], image: { x: 0, y: 0, w: 595, h: 842 } }]);
  const r = await readInvoiceBatch([scan, scan]);
  assert.deepEqual(r.outcomes.map(o => o.kind), ["requires-ocr", "exact-duplicate"]);
});
