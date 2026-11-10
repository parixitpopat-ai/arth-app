import test from "node:test";
import assert from "node:assert/strict";
import { compareStatements, bankBalancesWithin, DAY_WINDOW } from "./compareStatement.js";
import { parseStatementRows } from "../imports/statement.js";

const parsed = parseStatementRows([["Date", "Narration", "Ref No", "Debit", "Credit", "Balance"],
  ["02/10/2026", "SALARY", "R1", "", "5000.00", "6000.00"], ["05/10/2026", "SHOP", "R2", "100.10", "", "5899.90"], ["07/10/2026", "ONLY BANK", "R3", "40.00", "", "5859.90"], ["20/10/2026", "CAFE", "R4", "49.90", "", "5810.00"]]);
const line = (id, date, debit, credit, extra = {}) => ({ id, date, description: "x", debitPaise: Math.round(debit * 100), creditPaise: Math.round(credit * 100), t: extra });

test("compare: matches by signed amount within the day window, reports each side's leftovers, uses each entry once", () => {
  const arth = [line("a", "2026-10-02", 0, 5000), line("b", "2026-10-06", 100.1, 0), line("c", "2026-10-20", 49.9, 0), line("d", "2026-10-12", 75, 0)];
  const r = compareStatements({ parsed, arthLines: arth, from: "2026-10-01", to: "2026-10-31" });
  assert.equal(r.matched.length, 3);
  assert.deepEqual(r.onlyInBank.map(x => x.desc), ["ONLY BANK"]);
  assert.deepEqual(r.onlyInArth.map(x => x.id), ["d"]);
  assert.equal(r.bankCount, 4); assert.equal(r.arthCount, 4);
  assert.equal(r.bankIn, 500000); assert.equal(r.bankOut, 4000 + 10010 + 4990); assert.equal(r.arthIn, 500000); assert.equal(r.arthOut, 10010 + 4990 + 7500);
});
test("compare: two identical bank rows need two Arth entries; a date 3 days away does not match; a reference match is preferred", () => {
  const two = parseStatementRows([["Date", "Narration", "Ref No", "Debit", "Credit"], ["05/10/2026", "A", "X1", "10.00", ""], ["05/10/2026", "A", "X2", "10.00", ""]]);
  const one = compareStatements({ parsed: two, arthLines: [line("a", "2026-10-05", 10, 0)], from: "2026-10-01", to: "2026-10-31" });
  assert.equal(one.matched.length, 1); assert.equal(one.onlyInBank.length, 1);
  const far = compareStatements({ parsed: two, arthLines: [line("a", "2026-10-09", 10, 0)], from: "2026-10-01", to: "2026-10-31" });
  assert.equal(far.matched.length, 0); assert.equal(DAY_WINDOW, 2);
  const pref = compareStatements({ parsed: two, arthLines: [line("far", "2026-10-07", 10, 0, { transactionRef: "X2" }), line("near", "2026-10-05", 10, 0, { transactionRef: "Z" })], from: "2026-10-01", to: "2026-10-31" });
  const x2 = pref.matched.find(m => m.bank.ref === "X2"); assert.equal(x2.arth.id, "far");
});
test("compare: bank rows outside the period are ignored; balances within the period come from the file's own balance column", () => {
  const r = compareStatements({ parsed, arthLines: [], from: "2026-10-03", to: "2026-10-10" });
  assert.equal(r.bankCount, 2);
  assert.deepEqual(r.bankBalances, { openingPaise: 600000, closingPaise: 585990 });
  assert.deepEqual(bankBalancesWithin(parsed, "2026-10-01", "2026-10-31"), { openingPaise: 100000, closingPaise: 581000 });
  assert.equal(bankBalancesWithin(parsed, "2026-11-01", "2026-11-30"), null);
  assert.equal(bankBalancesWithin(null, "2026-10-01", "2026-10-31"), null);
});
test("compare: a file that is not readable gives an empty comparison, never a throw", () => {
  const r = compareStatements({ parsed: { ok: false }, arthLines: [line("a", "2026-10-02", 1, 0)], from: "2026-10-01", to: "2026-10-31" });
  assert.equal(r.bankCount, 0); assert.equal(r.onlyInArth.length, 1);
});
