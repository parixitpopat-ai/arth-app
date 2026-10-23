// Synthetic data only. The column layout below is an ASSUMED bank-statement layout, not a verified IDFC FIRST export.
import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { parseCsv } from "./csv.js";
import { readXlsx } from "./xlsx.js";
import { parseStatementRows, parseStatementDate, parseAmountPaise, withImportKeys } from "./statement.js";
import { matchStatement } from "./matchStatement.js";

const CSV = `\uFEFFAccount Statement,,,,,,
Customer Name,TEST PERSON,,,,,
Transaction Date,Value Date,Particulars,Cheque No.,Debit,Credit,Balance
01-Apr-2026,01-Apr-2026,"UPI/GROCER, MAIN ROAD/123",,"1,250.50",,"98,749.50"
02-Apr-2026,02-Apr-2026,SALARY APR,,,"50,000.00","148,749.50"
02-Apr-2026,02-Apr-2026,UPI/TEA STALL,,20.00,,"148,729.50"
02-Apr-2026,02-Apr-2026,UPI/TEA STALL,,20.00,,"148,709.50"
Closing Balance,,,,,,"148,709.50"
`;

test("csv: BOM, quoted comma, CRLF, delimiter detection", () => {
  const rows = parseCsv(CSV.replace(/\n/g, "\r\n"));
  assert.equal(rows[2][0], "Transaction Date");
  assert.equal(rows[3][2], "UPI/GROCER, MAIN ROAD/123");
  assert.equal(parseCsv("a;b;c\n1;2;3")[1][2], "3");
  assert.deepEqual(parseCsv(""), []);
});

test("dates: day-first, month names, serials, rejects impossible", () => {
  assert.equal(parseStatementDate("03/04/2026"), "2026-04-03");
  assert.equal(parseStatementDate("01-Apr-2026"), "2026-04-01");
  assert.equal(parseStatementDate("2026-04-30"), "2026-04-30");
  assert.equal(parseStatementDate(46113), "2026-04-01");     // Excel serial 46113 = 2026-04-01
  assert.equal(parseStatementDate("31/02/2026"), null);
  assert.equal(parseStatementDate("hello"), null);
  assert.equal(parseStatementDate(12), null);
});

test("amounts: lakh commas, brackets, Dr/Cr, blanks", () => {
  assert.equal(parseAmountPaise("1,23,456.78"), 12345678);
  assert.equal(parseAmountPaise("(20.00)"), -2000);
  assert.deepEqual(parseAmountPaise("5.00 Dr"), { dr: 500 });
  assert.equal(parseAmountPaise(""), null);
  assert.equal(parseAmountPaise("abc"), null);
  assert.equal(parseAmountPaise(10.1), 1010);
});

test("statement: header found below preamble, signs, skipped footer, balance continuity", () => {
  const p = parseStatementRows(parseCsv(CSV));
  assert.equal(p.ok, true);
  assert.deepEqual(p.rows.map(r => r.amountPaise), [-125050, 5000000, -2000, -2000]);
  assert.equal(p.rows[0].desc, "UPI/GROCER, MAIN ROAD/123");
  assert.equal(p.balance.order, "oldest-first");
  assert.deepEqual(p.balance.mismatches, []);
  assert.deepEqual(p.period, { from: "2026-04-01", to: "2026-04-02" });
});

test("statement: a tampered balance is reported, not hidden", () => {
  const p = parseStatementRows(parseCsv(CSV.replace("148,749.50\"\n02-Apr-2026,02-Apr-2026,UPI/TEA STALL,,20.00,,\"148,729.50", "149,749.50\"\n02-Apr-2026,02-Apr-2026,UPI/TEA STALL,,20.00,,\"148,729.50")));
  assert.ok(p.balance.mismatches.length > 0);
});

test("statement: newest-first order is recognised", () => {
  const rows = parseCsv(CSV.split("\n").filter(l => !/Closing|Account Statement|Customer/.test(l)).filter((l, i) => i === 0 || true).join("\n"));
  const header = rows[0], body = rows.slice(1).reverse();
  const p = parseStatementRows([header, ...body]);
  assert.equal(p.balance.order, "newest-first");
  assert.deepEqual(p.balance.mismatches, []);
});

test("statement: unrecognised file is refused with a reason", () => {
  const p = parseStatementRows([["foo", "bar"], ["1", "2"]]);
  assert.equal(p.ok, false);
  assert.match(p.reason, /column headings/);
});

test("statement: row with both debit and credit is skipped, not guessed", () => {
  const p = parseStatementRows([["Date", "Narration", "Debit", "Credit"], ["01/04/2026", "X", "5", "5"], ["02/04/2026", "Y", "7", ""]]);
  assert.equal(p.rows.length, 1);
  assert.equal(p.skipped[0].why, "both debit and credit filled");
});

test("keys: identical rows in one file stay distinct; re-import gives identical keys; other account differs", () => {
  const p = parseStatementRows(parseCsv(CSV)), a = withImportKeys(p.rows, "acc1"), b = withImportKeys(p.rows, "acc1"), c = withImportKeys(p.rows, "acc2");
  assert.equal(new Set(a.map(r => r.importKey)).size, 4);
  assert.deepEqual(a.map(r => r.importKey), b.map(r => r.importKey));
  assert.notEqual(a[0].importKey, c[0].importKey);
});

const txns = [
  { id: "t1", type: "expense", accId: "acc1", amount: 1250.5, date: "2026-04-01" },
  { id: "t2", type: "expense", accId: "acc2", amount: 20, date: "2026-04-02" },       // other account: must not match
  { id: "t3", type: "transfer", fromAccId: "acc1", toAccId: "acc3", amount: 20, date: "2026-04-03" },
];

test("match: new / probable / already-imported; each existing record claimed once; other account ignored", () => {
  const keyed = withImportKeys(parseStatementRows(parseCsv(CSV)).rows, "acc1");
  const m = matchStatement(keyed, { transactions: txns, accountId: "acc1", importedKeys: [keyed[1].importKey] });
  assert.deepEqual(m.results.map(r => r.status), ["probable-match", "already-imported", "probable-match", "new"]);
  assert.equal(m.results[0].matchId, "t1");
  assert.equal(m.results[2].matchId, "t3");           // transfer out of acc1 on 3 Apr, within 2 days
  assert.deepEqual(m.summary, { total: 4, new: 1, probableMatch: 2, alreadyImported: 1 });
});

test("match: does not mutate inputs", () => {
  const keyed = withImportKeys(parseStatementRows(parseCsv(CSV)).rows, "acc1"), snap = JSON.stringify(txns);
  matchStatement(keyed, { transactions: txns, accountId: "acc1", importedKeys: [] });
  assert.equal(JSON.stringify(txns), snap);
});

// --- minimal stored-zip builder so the xlsx reader is tested without any library ---
const crc = (() => { const t = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }); return b => { let c = ~0; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; }; })();
function zip(files, deflate = false) {
  const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const n = enc.encode(name), raw = enc.encode(text), d = deflate ? new Uint8Array(deflateRawSync(raw)) : raw, c = crc(raw), lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(8, deflate ? 8 : 0, true); lh.setUint32(14, c, true); lh.setUint32(18, d.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, n.length, true);
    parts.push(new Uint8Array(lh.buffer), n, d);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(10, deflate ? 8 : 0, true); ch.setUint32(16, c, true); ch.setUint32(20, d.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, n.length, true); ch.setUint32(42, off, true);
    cd.push(new Uint8Array(ch.buffer), n); off += 30 + n.length + d.length;
  }
  const cdSize = cd.reduce((s, x) => s + x.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, cd.length / 2, true); end.setUint16(10, cd.length / 2, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
  const all = [...parts, ...cd, new Uint8Array(end.buffer)], out = new Uint8Array(all.reduce((s, x) => s + x.length, 0)); let p = 0;
  for (const x of all) { out.set(x, p); p += x.length; }
  return out;
}

test("xlsx: shared strings, numbers, serial dates, sparse cells, entities", async () => {
  const sheet = `<worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c><c r="E1" t="s"><v>4</v></c></row>
    <row r="2"><c r="A2"><v>46113</v></c><c r="C2" t="s"><v>3</v></c><c r="D2"><v>1250.5</v></c></row></sheetData></worksheet>`;
  const sst = `<sst><si><t>Date</t></si><si><t>Narration</t></si><si><t>Debit</t></si><si><t>A &amp; B</t></si><si><t>Credit</t></si></sst>`;
  const rows = await readXlsx(zip({ "xl/worksheets/sheet1.xml": sheet, "xl/sharedStrings.xml": sst }));
  assert.deepEqual(rows, [["Date", "", "Narration", "Debit", "Credit"], [46113, "", "A & B", 1250.5]]);
  const p = parseStatementRows(rows);
  assert.equal(p.ok, true);
  assert.deepEqual([p.rows[0].date, p.rows[0].amountPaise, p.rows[0].desc], ["2026-04-01", -125050, "A & B"]);
});

test("xlsx: deflate-compressed entries (what real Excel files use)", async () => {
  const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Date</t></is></c><c r="B1"><v>7</v></c></row></sheetData></worksheet>`;
  assert.deepEqual(await readXlsx(zip({ "xl/worksheets/sheet1.xml": sheet }, true)), [["Date", 7]]);
});

test("xlsx: refuses non-zip, old .xls and oversized input with plain messages", async () => {
  await assert.rejects(() => readXlsx(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])), /not a valid \.xlsx/);
  await assert.rejects(() => readXlsx(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), /old-format/);
});

test("statement: heading 'Transaction Date & Time' (as printed on the IDFC statement) is recognised", () => {
  const p = parseStatementRows([["Transaction Date & Time", "Value Date", "Particulars", "Cheque No", "Debit", "Credit", "Balance"], ["", "", "Opening Balance", "", "", "", "10,067.30"], ["01-Feb-2022", "01-Feb-2022", "UPI/MOB/1/Payment f rom PhonePe", "", "50.00", "", "10,017.30"], ["01-Feb-2022", "01-Feb-2022", "NEFT/2/SALARY", "", "", "75,000.00", "85,017.30"]]);
  assert.equal(p.ok, true);
  assert.deepEqual(p.rows.map(r => r.amountPaise), [-5000, 7500000]);
  assert.deepEqual(p.balance.mismatches, []);
});
