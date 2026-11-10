import test from "node:test";
import assert from "node:assert/strict";
import { readStatementFile, sniffKind, STATEMENT_MAX_PAGES } from "./readStatementFile.js";
import { makePdf } from "../invoices/testing/pdfMaker.js";

const enc = s => new TextEncoder().encode(s);
test("read: CSV text (invented rows) is parsed", async () => {
  const r = await readStatementFile(enc("Date,Narration,Debit,Credit,Balance\n01/04/2026,UPI-SHOP,50.00,,950.00\n02/04/2026,SALARY,,100.00,1050.00\n"));
  assert.equal(r.kind, "text"); assert.equal(r.ok, true); assert.equal(r.rows.length, 2); assert.equal(r.balance.mismatches.length, 0);
});
test("read: kinds are detected from content, and bad files give plain reasons", async () => {
  assert.equal(sniffKind(makePdf([{ texts: [] }])), "pdf");
  assert.equal(sniffKind(Uint8Array.from([0x50, 0x4b, 3, 4])), "xlsx");
  assert.equal((await readStatementFile(new Uint8Array(0))).ok, false);
  const bin = await readStatementFile(Uint8Array.from([1, 0, 2, 0, 3]));
  assert.equal(bin.ok, false); assert.match(bin.reason, /not a CSV/);
  const old = await readStatementFile(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3, 4]));
  assert.match(old.reason, /\.xls/);
  const nope = await readStatementFile(enc("hello,world\n1,2\n"));
  assert.equal(nope.ok, false); assert.match(nope.reason, /column headings/);
});
test("read: a PDF goes through the PDF table reader", async () => {
  const t = (str, x, y) => ({ str, x, y, size: 8 });
  const pdf = makePdf([{ texts: [t("Date", 30, 780), t("Narration", 100, 780), t("Debit", 300, 780), t("Credit", 360, 780), t("Balance", 430, 780),
    t("01-04-2026", 30, 760), t("SHOP", 100, 760), t("50.00", 296, 760), t("950.00", 460, 760)] }]);
  const r = await readStatementFile(pdf);
  assert.equal(r.kind, "pdf"); assert.equal(r.ok, true); assert.equal(r.rows[0].amountPaise, -5000);
});

test("read: failures say which step failed, with the PDF's shape but none of its content", async () => {
  const bad = await readStatementFile(new TextEncoder().encode("%PDF-1.4 this is not really a pdf"));
  assert.equal(bad.ok, false); assert.match(bad.detail, /PDF reader: unreadable/);
  const t = (str, x, y) => ({ str, x, y, size: 8 });
  const noTable = await readStatementFile(makePdf([{ texts: [t("Date", 30, 780), t("Some private sentence about John Smith", 30, 760), t("Balance", 300, 780)] }]));
  assert.equal(noTable.ok, false);
  assert.match(noTable.detail, /PDF: 1 page\(s\), 3 text pieces; heading words seen: Date \| Balance/);
  assert.doesNotMatch(noTable.detail, /John Smith/);
});

test("read: a statement PDF may have up to 40 pages (the invoice reader still stops at 10)", async () => {
  const t = (str, x, y) => ({ str, x, y, size: 8 });
  const table = [t("Date", 30, 780), t("Narration", 100, 780), t("Debit", 300, 780), t("Credit", 360, 780), t("Balance", 430, 780), t("01-04-2026", 30, 760), t("SHOP", 100, 760), t("50.00", 296, 760), t("950.00", 465, 760)];
  const page = n => ({ texts: n === 0 ? table : [t("Offers and terms page " + n, 30, 700)] });
  const many = n => makePdf(Array.from({ length: n }, (_, i) => page(i)));
  const ok = await readStatementFile(many(14));
  assert.equal(ok.ok, true); assert.equal(ok.rows.length, 1);
  const over = await readStatementFile(many(STATEMENT_MAX_PAGES + 1));
  assert.equal(over.ok, false); assert.match(over.reason, /41 pages; up to 40/);
  const { readPdfLayout } = await import("../invoices/pdfText.js");
  assert.equal((await readPdfLayout(many(11))).status, "too-many-pages");
});
