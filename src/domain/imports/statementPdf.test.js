// SYNTHETIC statement PDF (invented names/amounts) laid out like a common bank PDF: 7 columns, wrapped narration, a repeated heading on page 2.
import test from "node:test";
import assert from "node:assert/strict";
import { makePdf } from "../invoices/testing/pdfMaker.js";
import { readPdfLayout } from "../invoices/pdfText.js";
import { pdfPagesToRows } from "./statementPdf.js";
import { parseStatementRows } from "./statement.js";

const X = [30, 95, 160, 330, 385, 450, 510]; // left edges of: date, value date, particulars, cheque, debit, credit, balance
const head = y => [["Transaction Date", X[0]], ["Value Date", X[1]], ["Particulars", X[2]], ["Cheque No.", X[3]], ["Debit", X[4]], ["Credit", X[5]], ["Balance", X[6]]].map(([str, x]) => ({ str, x, y, size: 8 }));
const num = (str, rightX, y) => ({ str, x: rightX - str.length * 4.4, y, size: 8 });
const row = (y, d, desc, deb, cred, bal, extra = []) => [{ str: d, x: X[0], y, size: 8 }, { str: d, x: X[1], y, size: 8 }, { str: desc, x: X[2], y, size: 8 }, ...extra,
  ...(deb ? [num(deb, 430, y)] : []), ...(cred ? [num(cred, 495, y)] : []), num(bal, 560, y)];

test("pdf statement: columns, wrapped narration, second page with repeated heading -> parsed rows with balance check", async () => {
  const p1 = [...head(780), ...row(760, "21-05-2021", "IFT/111/SHOP ONE", "", "100.00", "900.00"), { str: "/1448800", x: X[2], y: 750, size: 8 },
    ...row(730, "22-05-2021", "IMPS-RIB/Fund Trf/222/", "50.00", "", "950.00"),
    ...row(710, "23-05-2021", "BB/CHQ DEP/092964/SOMEONE", "", "30.50", "919.50", [{ str: "092964", x: X[3], y: 710, size: 8 }])];
  const p2 = [...head(780), ...row(760, "24-05-2021", "ATM/CASH WITHDRAWAL/1365", "", "19.50", "900.00")];
  const pdf = makePdf([{ texts: p1 }, { texts: p2 }]);
  const lay = await readPdfLayout(pdf);
  assert.equal(lay.status, "ok");
  const t = pdfPagesToRows(lay.pages);
  assert.equal(t.ok, true);
  assert.equal(t.rows.length, 5);
  assert.match(t.rows[1][2], /SHOP ONE \/1448800/);
  assert.equal(t.rows[3][3], "092964");
  const s = parseStatementRows(t.rows);
  assert.equal(s.ok, true);
  assert.equal(s.rows.length, 4);
  assert.equal(s.balance.signsReversed, true);               // this layout, like the sample, has amounts that move the balance the other way
  assert.equal(s.balance.mismatches.length, 0);
  assert.deepEqual(s.rows.map(r => r.amountPaise), [-10000, 5000, -3050, -1950]);
  assert.equal(s.rows[0].date, "2021-05-21");
});

test("pdf statement: a PDF with no text and one with no table are refused with reasons", async () => {
  assert.equal(pdfPagesToRows([{ number: 1, items: [], textChars: 0 }]).ok, false);
  const lay = await readPdfLayout(makePdf([{ texts: [{ str: "Hello this is a long letter with no table at all", x: 30, y: 700, size: 8 }] }]));
  const r = pdfPagesToRows(lay.pages);
  assert.equal(r.ok, false); assert.match(r.reason, /headings/);
});
