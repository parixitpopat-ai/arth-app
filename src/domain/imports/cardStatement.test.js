// SYNTHETIC credit-card statement PDF (invented figures) laid out like one ICICI card statement seen as a picture: a side panel with the dates and
// totals, a summary strip, offers/charts, then a table "Date | SerNo. | Transaction Details | Reward Points | Intl. amount | Amount (in₹)".
import test from "node:test";
import assert from "node:assert/strict";
import { makePdf } from "../invoices/testing/pdfMaker.js";
import { readStatementFile } from "./readStatementFile.js";
import { parseLongDate, extractCardSummary, checkCardSummary } from "./cardSummary.js";
import { parseStatementRows } from "./statement.js";

const t = (str, x, y, size = 7) => ({ str, x, y, size });
const sidebar = [
  t("STATEMENT DATE", 90, 700), t("October 16, 2026", 88, 682), t("PAYMENT DUE DATE", 82, 650), t("November 3, 2026", 88, 632),
  t("Total Amount due", 90, 580), t("₹575.10", 105, 562), t("Minimum Amount due", 84, 520), t("₹100.00", 105, 502),
  t("Dining-100%", 40, 390), t("Get 2.5% cashback on fuel", 30, 300), t("Statement period : September 17, 2026 to October 16, 2026", 30, 120),
];
const strip = [
  t("Previous Balance", 340, 560, 6), t("₹1,000.00", 346, 545, 6),
  t("Purchases / Charges", 395, 560, 6), t("₹575.10", 412, 545, 6),
  t("Cash Advances", 468, 560, 6), t("₹0.00", 480, 545, 6),
  t("Payments / Credits", 523, 560, 6), t("₹1,000.00", 532, 545, 6),
];
const head = [t("Date", 342, 420), t("SerNo.", 385, 420), t("Transaction Details", 430, 420), t("Reward", 505, 420), t("Points", 507, 411), t("Amount (in₹)", 545, 420)];
const right = (s, y) => t(s, 590 - s.length * 3.6, y);
const rows = [
  t("4501XXXXXXXX0001", 342, 395), 
  t("06/10/2026", 342, 380), t("14308206086", 385, 380), t("ZOMATO CYBS DELHI", 430, 380), t("7", 505, 380), right("375.10", 380),
  t("08/10/2026", 342, 365), t("14308206999", 385, 365), t("AMAZON PAY MUMBAI", 430, 365), right("200.00", 365),
  t("09/10/2026", 342, 350), t("14308207000", 385, 350), t("PAYMENT RECEIVED", 430, 350), right("1,000.00 CR", 350),
];

test("parseLongDate: the formats statements print", () => {
  assert.equal(parseLongDate("October 16, 2026"), "2026-10-16");
  assert.equal(parseLongDate("3 Nov 2026"), "2026-11-03");
  assert.equal(parseLongDate("February 30, 2026"), null);
  assert.equal(parseLongDate("garbage"), null);
});

test("card statement pdf: rows (charge plain, CR is a credit), side panel ignored, summary read and it adds up", async () => {
  const pdf = makePdf([{ texts: [...sidebar, ...strip, ...head, ...rows] }]);
  const r = await readStatementFile(pdf, { accountKind: "card" });
  assert.equal(r.ok, true, r.reason);
  assert.deepEqual(r.rows.map(x => [x.date, x.amountPaise, x.ref]), [["2026-10-06", -37510, "14308206086"], ["2026-10-08", -20000, "14308206999"], ["2026-10-09", 100000, "14308207000"]]);
  assert.equal(r.rows[0].desc, "ZOMATO CYBS DELHI");
  assert.equal(r.summary.statementDate, "2026-10-16"); assert.equal(r.summary.dueDate, "2026-11-03");
  assert.equal(r.summary.totalDuePaise, 57510); assert.equal(r.summary.minDuePaise, 10000);
  assert.equal(r.summary.previousBalancePaise, 100000); assert.equal(r.summary.purchasesPaise, 57510); assert.equal(r.summary.cashAdvancesPaise, 0); assert.equal(r.summary.paymentsPaise, 100000);
  assert.equal(r.summary.periodFrom, "2026-09-17"); assert.equal(r.summary.periodTo, "2026-10-16");
  assert.equal(r.summaryCheck.ok, true, JSON.stringify(r.summaryCheck));
});

test("card statement: a statement whose rows do not match its printed totals is reported, not hidden", () => {
  const rowsP = [{ amountPaise: -37510 }, { amountPaise: 100000 }];
  const c = checkCardSummary({ previousBalancePaise: 0, purchasesPaise: 57510, cashAdvancesPaise: 0, paymentsPaise: 100000, totalDuePaise: 999 }, rowsP);
  assert.equal(c.ok, false);
  assert.deepEqual(c.findings.map(f => [f.id, f.ok]), [["equation", false], ["charges", false], ["credits", true]]);
  assert.deepEqual(checkCardSummary({}, rowsP), { ok: false, findings: [] });
});

test("card csv: plain amount is a charge; CR and negative amounts are credits; bank-mode keeps the bank meaning", () => {
  const raw = [["Date", "SerNo.", "Transaction Details", "Amount (in₹)"], ["06/10/2026", "1", "SHOP", "375.10"], ["09/10/2026", "2", "PAYMENT", "1,000.00 CR"], ["10/10/2026", "3", "REFUND", "-50.00"]];
  assert.deepEqual(parseStatementRows(raw, { kind: "card" }).rows.map(r => r.amountPaise), [-37510, 100000, 5000]);
  assert.deepEqual(parseStatementRows(raw).rows.map(r => r.amountPaise), [37510, 100000, -5000]);
});

test("extractCardSummary: nothing found -> empty object (no guesses)", () => {
  assert.deepEqual(extractCardSummary([{ items: [t("hello", 10, 10)] }]), {});
  assert.deepEqual(extractCardSummary([]), {});
});
