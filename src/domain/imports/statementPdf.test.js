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

// Layout shaped like a common savings-account PDF: a serial-number column, headings printed over two lines, dotted dates, remarks over several lines.
test("pdf statement: two-line headings, S No. column, dotted dates, multi-line remarks", async () => {
  const hx = { sno: 30, date: 70, chq: 140, rem: 215, wd: 400, dep: 460, bal: 520 };
  const c = (str, x, y, w) => ({ str, x, y, size: 8, _w: w });
  const head = [c("S No.", hx.sno, 780), c("Transaction", hx.date, 790), c("Date", hx.date + 13, 778), c("Cheque Number", hx.chq, 780), c("Transaction Remarks", hx.rem + 40, 780),
    c("Withdrawal", hx.wd, 790), c("Amount (INR)", hx.wd - 3, 778), c("Deposit", hx.dep + 3, 790), c("Amount (INR)", hx.dep - 3, 778), c("Balance", hx.bal + 8, 790), c("(INR)", hx.bal + 12, 778)];
  const num = (str, rightX, y) => ({ str, x: rightX - str.length * 4.4, y, size: 8 });
  const r1 = [{ str: "1", x: hx.sno + 4, y: 750, size: 8 }, { str: "02.04.2026", x: hx.date, y: 750, size: 8 }, { str: "UPI/SHOP ONE/412345678901/", x: hx.rem, y: 750, size: 8 },
    { str: "Payment from Ph", x: hx.rem, y: 740, size: 8 }, { str: "INV 77", x: hx.rem, y: 730, size: 8 }, num("100.00", hx.wd + 40, 750), num("900.00", hx.bal + 50, 750)];
  const r2 = [{ str: "2", x: hx.sno + 4, y: 710, size: 8 }, { str: "03.04.2026", x: hx.date, y: 710, size: 8 }, { str: "NEFT-SALARY", x: hx.rem, y: 710, size: 8 }, num("500.00", hx.dep + 40, 710), num("1,400.00", hx.bal + 50, 710)];
  const lay = await readPdfLayout(makePdf([{ texts: [...head, ...r1, ...r2] }]));
  const t = pdfPagesToRows(lay.pages);
  assert.equal(t.ok, true, t.reason);
  assert.equal(t.rows.length, 3);
  assert.match(t.rows[1].join(" "), /UPI\/SHOP ONE\/412345678901\/ Payment from Ph INV 77/);
  const s = parseStatementRows(t.rows);
  assert.equal(s.ok, true);
  assert.deepEqual(s.rows.map(r => [r.date, r.amountPaise, r.balancePaise]), [["2026-04-02", -10000, 90000], ["2026-04-03", 50000, 140000]]);
  assert.equal(s.balance.mismatches.length, 0);
});

test("csv/excel headings as printed on such statements are recognised (Withdrawal Amount (INR), Deposit Amount (INR), Balance (INR), Cheque Number, Transaction Remarks)", () => {
  const s = parseStatementRows([["S No.", "Value Date", "Transaction Date", "Cheque Number", "Transaction Remarks", "Withdrawal Amount (INR)", "Deposit Amount (INR)", "Balance (INR)"],
    ["1", "02.04.2026", "02.04.2026", "", "UPI/X", "100.00", "", "900.00"], ["2", "03.04.2026", "03.04.2026", "123456", "NEFT", "", "500.00", "1400.00"]]);
  assert.equal(s.ok, true);
  assert.deepEqual(s.rows.map(r => [r.amountPaise, r.ref]), [[-10000, ""], [50000, "123456"]]);
});
