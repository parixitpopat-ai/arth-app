import test from "node:test";
import assert from "node:assert/strict";
import { makePdf } from "./testing/pdfMaker.js";
import { analyseAmazonPdf, isAmazonAnalysis } from "./amazonPdf.js";
import { groupAmazonOrders } from "./amazonInvoice.js";
import { productPage, feePage, BUYER, ADDR, PHONE, TXN, T } from "./fixtures/amazonInvoice.fixture.js";

const draw = (...pages) => makePdf(pages.map(items => ({ texts: items.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })) })));

test("a real PDF file (two pages, two invoices of one order) is read end to end", async () => {
  const a = await analyseAmazonPdf(draw(feePage(), productPage()));
  assert.equal(a.status, "supported"); assert.equal(isAmazonAnalysis(a), true); assert.match(a.fileHash, /^[0-9a-f]{64}$/);
  const g = groupAmazonOrders(a.pages.map(p => p.parsed));
  assert.equal(g.length, 1); assert.deepEqual([g[0].itemsPaise, g[0].chargesPaise, g[0].invoicedPaise], [96900, 333, 97233]);
});

test("PRIVACY: nothing from the buyer block or payment block survives the whole PDF path", async () => {
  const a = await analyseAmazonPdf(draw(feePage(), productPage()));
  const dump = JSON.stringify({ ...a, fileHash: undefined });
  for (const s of [BUYER, ADDR, PHONE, TXN, "Credit Card"]) assert.ok(!dump.includes(s), s);
});

test("a picture-only page needs OCR and is not guessed at; a non-Amazon page is unsupported", async () => {
  const scanned = await analyseAmazonPdf(makePdf([{ texts: [], image: { x: 0, y: 0, w: 595, h: 842 } }]));
  assert.equal(scanned.pages[0].status, "requires-ocr"); assert.equal(isAmazonAnalysis(scanned), false);
  const other = await analyseAmazonPdf(draw([T("Some other document with enough text to be read as a text page, not an invoice.", 20, 700)]));
  assert.equal(other.status, "unsupported"); assert.equal(isAmazonAnalysis(other), false);
});

test("junk and empty files fail safely", async () => {
  assert.equal((await analyseAmazonPdf(new Uint8Array(0))).status, "unreadable");
  assert.equal((await analyseAmazonPdf(new TextEncoder().encode("%PDF-1.4\ngarbage"))).status, "unreadable");
});
