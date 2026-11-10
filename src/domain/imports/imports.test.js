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

test("match: new / probable / already-imported; each existing record claimed once; a same-amount entry on another account is offered as a match (otherAccount)", () => {
  const keyed = withImportKeys(parseStatementRows(parseCsv(CSV)).rows, "acc1");
  const m = matchStatement(keyed, { transactions: txns, accountId: "acc1", importedKeys: [keyed[1].importKey] });
  assert.deepEqual(m.results.map(r => r.status), ["probable-match", "already-imported", "probable-match", "probable-match"]);
  assert.equal(m.results[3].otherAccount, true);
  assert.equal(m.results[0].matchId, "t1");
  assert.equal(m.results[2].matchId, "t3");           // transfer out of acc1 on 3 Apr, within 2 days
  assert.deepEqual(m.summary, { total: 4, new: 0, probableMatch: 3, alreadyImported: 1 });
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

test("statement: debit/credit labels reversed relative to the running balance are corrected by the balance column (and flagged)", () => {
  // synthetic numbers shaped like a statement whose "Debit" column raises the balance
  const p = parseStatementRows([["Transaction Date", "Value Date", "Particulars", "Cheque No.", "Debit", "Credit", "Balance"],
    ["21-05-2021", "21-05-2021", "IFT/1/SHOP A", "", "", "100.00", "900.00"],
    ["22-05-2021", "22-05-2021", "IMPS/2/", "", "50.00", "", "950.00"],
    ["23-05-2021", "23-05-2021", "IFT/3/SHOP A", "", "", "30.50", "919.50"]]);
  assert.equal(p.ok, true);
  assert.equal(p.balance.signsReversed, true);
  assert.deepEqual(p.rows.map(r => r.amountPaise), [-10000, 5000, -3050]);
  assert.equal(p.balance.mismatches.length, 0);
});

test("match: entries recorded against a UPI handle / debit card linked to the bank count as the bank's; a part-paid expense counts only its slice", () => {
  const rows = withImportKeys([{ date: "2026-04-02", desc: "UPI/SHOP", ref: "", amountPaise: -12000 }, { date: "2026-04-03", desc: "FEES", ref: "", amountPaise: -50000 }, { date: "2026-04-04", desc: "OTHER", ref: "", amountPaise: -7700 }], "bank1");
  const txns = [
    { id: "u1", type: "expense", amount: 120, date: "2026-04-02", accId: "upi1" },                                   // paid through the linked UPI handle
    { id: "p1", type: "expense", amount: 800, date: "2026-04-03", accId: "cc1", paymentLines: [{ accId: "bank1", amount: 500 }, { accId: "cc1", amount: 300 }] },
    { id: "x1", type: "expense", amount: 77, date: "2026-04-04", accId: "upi-other" },                               // a UPI handle linked to another bank
  ];
  const without = matchStatement(rows, { transactions: txns, accountId: "bank1", importedKeys: [] });
  assert.deepEqual(without.results.map(r => [r.status, r.otherAccount === true]), [["probable-match", true], ["probable-match", false], ["probable-match", true]]);   // without the link list the rail entries are only "on another account"
  const withRail = matchStatement(rows, { transactions: txns, accountId: "bank1", importedKeys: [], linkedIds: ["upi1"] });
  assert.deepEqual(withRail.results.map(r => [r.status, r.matchId, r.otherAccount === true]), [["probable-match", "u1", false], ["probable-match", "p1", false], ["probable-match", "x1", true]]);
});

test("headings: split, dotted or unit-carrying headings are still recognised (loose reading, only when the exact aliases fail)", () => {
  const raw = [["Date", "SerNo.", "Transaction", "Details", "Reward Points", "Intl. amount", "Amount", "(in \u20B9)"], ["06/10/2026", "1", "SHOP", "", "7", "", "375.10", ""]];
  const p = parseStatementRows(raw, { kind: "card" });
  assert.equal(p.ok, true, p.reason); assert.equal(p.rows[0].amountPaise, -37510); assert.equal(p.rows[0].ref, "1");
  const q = parseStatementRows([["Txn Date", "Value Date", "Remarks", "Withdrawals (Dr.)", "Deposits (Cr.)", "Closing Balance"], ["01/04/2026", "01/04/2026", "X", "5.00", "", "95.00"]]);
  assert.equal(q.ok, true);
  assert.equal(parseStatementRows([["Foo", "Bar", "Baz"], ["1", "2", "3"]]).ok, false);          // still refused when nothing fits
});

import { extractUtr } from "./utr.js";
test("utr: read from UPI / IMPS narrations in both layouts; cheque numbers, card serials and NEFT text are not UTRs", () => {
  assert.equal(extractUtr({ desc: "UPI/CR/104354172499/NPCI BHI/HDFC/bhimcas/BHIMCASHBACK" }), "104354172499");
  assert.equal(extractUtr({ desc: "UPI-211737389994-VIPULACH AL ENTE" }), "211737389994");
  assert.equal(extractUtr({ desc: "IMPS-RIB/Fund Trf/906920699478/" }), "906920699478");
  assert.equal(extractUtr({ desc: "BB/CHQ DEP/092964/SOMEONE", ref: "092964" }), "");
  assert.equal(extractUtr({ desc: "ZOMATO CYBS NEWDELHI IN", ref: "14308206086" }), "");          // a card statement serial number (11 digits)
  assert.equal(extractUtr({ desc: "NEFT-HDFCN52026101012345-SALARY" }), "");
  assert.equal(extractUtr({ desc: "FUND TRF", ref: "906920699478" }), "906920699478");              // a 12-digit reference column
  assert.equal(extractUtr({ desc: "UPI/DR/1234567890123/X" }), "");                                    // 13 digits: not a UTR
});
test("match: the same UPI reference matches the entry whatever the date gap (same amount), and an imported UTR is 'already imported'", () => {
  const rows = withImportKeys([{ date: "2026-04-20", desc: "UPI/DR/412345678901/SWIGGY/HDFC/s@ic/x", ref: "", amountPaise: -7700 }, { date: "2026-04-20", desc: "UPI/DR/999999999999/OTHER/HDFC/o@ic/x", ref: "", amountPaise: -7700 }], "bank1");
  const txns = [{ id: "m1", type: "expense", amount: 77, date: "2026-04-01", accId: "bank1", transactionRef: "UTR 412345678901" }];     // 19 days earlier
  const r = matchStatement(rows, { transactions: txns, accountId: "bank1", importedKeys: [] });
  assert.deepEqual(r.results.map(x => [x.status, x.matchId, x.byUtr]), [["probable-match", "m1", true], ["new", undefined, undefined]]);
  const again = matchStatement(rows, { transactions: [], accountId: "bank1", importedKeys: [], importedUtrs: ["412345678901"] });
  assert.deepEqual(again.results.map(x => [x.status, x.byUtr]), [["already-imported", true], ["new", undefined]]);
  const diffAmt = matchStatement(rows.slice(0, 1), { transactions: [{ ...txns[0], amount: 78 }], accountId: "bank1", importedKeys: [] });
  assert.equal(diffAmt.results[0].status, "new");                                                       // same UTR but a different amount is not offered as the same payment
});
test("match: the same amount near the same date on ANOTHER account is offered as a match (unticked, linked not moved); a linked or other-amount entry is not", () => {
  const rows = withImportKeys([{ date: "2026-10-16", desc: "UPI-171831146733-MCDONALD S IN", ref: "", amountPaise: -36571 }], "cc1");
  const mk = extra => [{ id: "e1", type: "expense", amount: 365.71, date: "2026-10-16", accId: "bank1", ...extra }];
  const r = matchStatement(rows, { transactions: mk({}), accountId: "cc1", importedKeys: [] });
  assert.deepEqual([r.results[0].status, r.results[0].matchId, r.results[0].otherAccount], ["probable-match", "e1", true]);
  assert.equal(matchStatement(rows, { transactions: mk({ importKey: "k" }), accountId: "cc1", importedKeys: [] }).results[0].status, "new");
  assert.equal(matchStatement(rows, { transactions: mk({ amount: 365.7 }), accountId: "cc1", importedKeys: [] }).results[0].status, "new");
  assert.equal(matchStatement(rows, { transactions: mk({ date: "2026-10-20" }), accountId: "cc1", importedKeys: [] }).results[0].status, "new");
});

test("match: a settlement received (settlement_in) and a purchase paid from the account (investment) are recognised; a transfer matches on both accounts", () => {
  const rows = withImportKeys([{ date: "2026-10-06", desc: "IMPS FROM RAJ", ref: "", amountPaise: 250000 }, { date: "2026-10-07", desc: "SIP", ref: "", amountPaise: -100000 }, { date: "2026-10-08", desc: "IFT TO ICICI", ref: "", amountPaise: -800000 }], "idfc");
  const txns = [{ id: "s1", type: "settlement_in", amount: 2500, date: "2026-10-05", accId: "idfc" }, { id: "v1", type: "investment", amount: 1000, date: "2026-10-07", accId: "idfc" }, { id: "t1", type: "transfer", amount: 8000, date: "2026-10-08", fromAccId: "idfc", toAccId: "icici" }];
  const r = matchStatement(rows, { transactions: txns, accountId: "idfc", importedKeys: [] });
  assert.deepEqual(r.results.map(x => [x.status, x.matchId]), [["probable-match", "s1"], ["probable-match", "v1"], ["probable-match", "t1"]]);
  const icici = withImportKeys([{ date: "2026-10-08", desc: "IFT FROM IDFC", ref: "", amountPaise: 800000 }], "icici");
  assert.deepEqual(matchStatement(icici, { transactions: txns, accountId: "icici", importedKeys: [] }).results.map(x => [x.status, x.matchId]), [["probable-match", "t1"]]);
});
