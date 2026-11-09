import test from "node:test";
import assert from "node:assert/strict";
import { statementBalances, planBalanceMatch, applyBalanceMatch, undoBalanceMatch } from "./statementBalances.js";
import { parseStatementRows } from "./statement.js";

const oldest = parseStatementRows([["Date", "Narration", "Debit", "Credit", "Balance"],
  ["01/04/2026", "A", "100.00", "", "900.00"], ["02/04/2026", "B", "", "50.00", "950.00"], ["03/04/2026", "C", "30.00", "", "920.00"]]);

test("balances: opening = first balance minus first amount; closing = last balance (oldest-first)", () => {
  const sb = statementBalances(oldest);
  assert.deepEqual(sb, { openingPaise: 100000, openingDate: "2026-04-01", closingPaise: 92000, closingDate: "2026-04-03" });
});
test("balances: newest-first file gives the same answer", () => {
  const p = parseStatementRows([["Date", "Narration", "Debit", "Credit", "Balance"],
    ["03/04/2026", "C", "30.00", "", "920.00"], ["02/04/2026", "B", "", "50.00", "950.00"], ["01/04/2026", "A", "100.00", "", "900.00"]]);
  assert.equal(p.balance.order, "newest-first");
  assert.deepEqual(statementBalances(p), statementBalances(oldest));
});
test("balances: no offer when the balance does not add up, when a balance is missing, or with a single row", () => {
  const bad = parseStatementRows([["Date", "Narration", "Debit", "Credit", "Balance"], ["01/04/2026", "A", "100.00", "", "900.00"], ["02/04/2026", "B", "", "50.00", "999.00"], ["03/04/2026", "C", "30.00", "", "10.00"]]);
  assert.equal(statementBalances(bad), null);
  const nobal = parseStatementRows([["Date", "Narration", "Debit", "Credit"], ["01/04/2026", "A", "100.00", ""], ["02/04/2026", "B", "", "50.00"]]);
  assert.equal(statementBalances(nobal), null);
  assert.equal(statementBalances(parseStatementRows([["Date", "Narration", "Debit", "Credit", "Balance"], ["01/04/2026", "A", "100.00", "", "900.00"]])), null);
  assert.equal(statementBalances(null), null);
});
test("plan/apply/undo: opening and the 'balance as of' note are set; undo restores exactly (including no checkpoint, no date)", () => {
  const sb = statementBalances(oldest), acc = { id: "a1", name: "X", openingBalance: 5, openingBalanceDate: "2026-01-01" };
  const txns = [{ date: "2026-03-01", accId: "a1" }, { date: "2026-03-02", accId: "other" }, { date: "2026-04-02", accId: "a1" }];
  const plan = planBalanceMatch(acc, null, sb, txns, "a1");
  assert.equal(plan.entriesBeforeOpening, 1); assert.equal(plan.opening.to, 1000); assert.equal(plan.current.from, null);
  const out = applyBalanceMatch(acc, null, plan);
  assert.deepEqual(out.account, { id: "a1", name: "X", openingBalance: 1000, openingBalanceDate: "2026-04-01" });
  assert.deepEqual(out.checkpoint, { amount: 920, date: "2026-04-03" });
  const back = undoBalanceMatch(out.account, out.undo);
  assert.deepEqual(back.account, acc); assert.equal(back.checkpoint, null);
  const noDate = { id: "a2", openingBalance: 1 };
  const o2 = applyBalanceMatch(noDate, { amount: 7, date: "2026-02-02" }, planBalanceMatch(noDate, { amount: 7, date: "2026-02-02" }, sb, [], "a2"));
  const b2 = undoBalanceMatch(o2.account, o2.undo);
  assert.deepEqual(b2.account, noDate); assert.deepEqual(b2.checkpoint, { amount: 7, date: "2026-02-02" });
});
test("plan: paise become exact rupees (no float drift)", () => {
  const p = parseStatementRows([["Date", "Narration", "Debit", "Credit", "Balance"], ["01/04/2026", "A", "0.10", "", "0.20"], ["02/04/2026", "B", "0.10", "", "0.10"]]);
  assert.equal(planBalanceMatch({}, null, statementBalances(p), [], "x").opening.to, 0.3);
});
