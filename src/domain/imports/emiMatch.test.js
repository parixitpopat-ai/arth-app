import test from "node:test";
import assert from "node:assert/strict";
import { groupEmiRows } from "./emiRows.js";
import { matchEmiGroup } from "./emiMatch.js";
import { matchStatement } from "./matchStatement.js";

const r = (k, date, amountPaise, desc) => ({ importKey: k, date, amountPaise, desc });
const ROWS = [r("i", "2026-10-05", -3000, "Interest Amount Amortization - <3/6>SAMPLE STORE PVT LTD"), r("g", "2026-10-05", -540, "IGST-CI@18%"), r("p", "2026-10-05", -250000, "Principal Amount Amortization - <3/6>SAMPLE STORE PVT LTD")];
const G = groupEmiRows(ROWS).groups[0];            // total 2,535.40
const PLAN = { id: "pl1", name: "Sample EMI", cardId: "cc1", tenure: 6, monthlyAmount: 2535.4, status: "active" };
const inst = (id, n, amount, extra = {}) => ({ id, type: "cc_emi", accId: "cc1", ccEmiPlanId: "pl1", installmentNo: n, ccEmiTenure: 6, amount, date: "2026-09-05", ...extra });
const ctx = (o = {}) => ({ transactions: [], accountId: "cc1", plans: [PLAN], ...o });

test("the card's plan already holds this instalment: recorded", () => {
  assert.equal(matchEmiGroup(G, ctx({ transactions: [inst("a", 3, 2535.4)] })).status, "recorded");
});
test("same instalment number but another amount: shown, not overwritten", () => {
  const m = matchEmiGroup(G, ctx({ transactions: [inst("a", 3, 2500)] }));
  assert.equal(m.status, "recorded-differs"); assert.match(m.warnings[0], /2500/);
});
test("one plain entry of exactly the total within 2 days is a match to LINK; 3 days away is not", () => {
  const plain = d => ({ id: "e1", type: "expense", accId: "cc1", amount: 2535.4, date: d });
  assert.deepEqual(((m) => [m.status, m.txnId])(matchEmiGroup(G, ctx({ transactions: [plain("2026-10-07")] }))), ["match", "e1"]);
  assert.equal(matchEmiGroup(G, ctx({ transactions: [plain("2026-10-08")] })).status, "record");
});
test("no entry but an active plan on this card of the same length: record as instalment n; a plan on another card is ignored", () => {
  const m = matchEmiGroup(G, ctx());
  assert.deepEqual([m.status, m.plan.id, m.installmentNo], ["record", "pl1", 3]);
  assert.equal(matchEmiGroup(G, ctx({ plans: [{ ...PLAN, cardId: "cc2" }] })).status, "none");
  assert.equal(matchEmiGroup(G, ctx({ plans: [{ ...PLAN, status: "closed" }] })).status, "none");
});
test("a plan whose length differs is only used when its monthly amount fits, and says so", () => {
  const m = matchEmiGroup(G, ctx({ plans: [{ ...PLAN, tenure: 9 }] }));
  assert.equal(m.status, "record"); assert.match(m.warnings.join(" "), /9 instalments/);
  assert.equal(matchEmiGroup(G, ctx({ plans: [{ ...PLAN, tenure: 9, monthlyAmount: 100 }] })).status, "none");
});
test("two plans that fit: none is chosen for the person", () => {
  const m = matchEmiGroup(G, ctx({ plans: [PLAN, { ...PLAN, id: "pl2" }] }));
  assert.equal(m.status, "none"); assert.match(m.warnings[0], /More than one plan/);
});
test("a row of an earlier import makes the whole group already-imported", () => {
  assert.equal(matchEmiGroup(G, ctx({ importedKeys: ["g"] })).status, "already-imported");
});
test("matcher change: a recorded EMI instalment can now be matched by an ordinary statement row of the same amount", () => {
  const m = matchStatement([r("z", "2026-10-05", -253540, "SOME NARRATION")], { transactions: [inst("a", 3, 2535.4, { date: "2026-10-05" })], accountId: "cc1", importedKeys: [], linkedIds: [] });
  assert.equal(m.results[0].status, "probable-match"); assert.equal(m.results[0].matchId, "a");
});

import { buildEmiInstalmentTxn, breakupOf, applyMerges, undoImportBatch } from "./buildImport.js";
test("recorded as ONE instalment: total amount, plan fields, breakup inside, all three row keys", () => {
  const t = buildEmiInstalmentTxn(G, { plan: { ...PLAN, catId: "shopping" }, installmentNo: 3, accountId: "cc1", batchId: "b1", newId: () => "n1" });
  assert.deepEqual([t.type, t.amount, t.accId, t.ccEmiPlanId, t.installmentNo, t.ccEmiTenure, t.desc, t.catId], ["cc_emi", 2535.4, "cc1", "pl1", 3, 6, "Sample EMI · 3/6", "shopping"]);
  assert.deepEqual(t.emiBreakup, { principal: 2500, interest: 30, gst: 5.4, gstRate: 18 });
  assert.deepEqual([...t.importKeys].sort(), ["g", "i", "p"]);
  assert.equal(breakupOf(G).principal + breakupOf(G).interest + breakupOf(G).gst, t.amount);
});
test("linking an existing entry to the whole group keeps it as it is, adds all keys and the breakup; Undo puts it back exactly", () => {
  const e = { id: "e1", type: "expense", accId: "cc1", amount: 2535.4, date: "2026-10-05", merchant: "My own name", catId: "shopping", note: "mine" };
  const after = applyMerges([e], [{ txnId: "e1", rows: ROWS, breakup: breakupOf(G) }], { batchId: "b2" });
  const m = after[0];
  assert.deepEqual([m.merchant, m.catId, m.note, m.amount, m.type, m.date], ["My own name", "shopping", "mine", 2535.4, "expense", "2026-10-05"]);   // nothing of yours replaced
  assert.deepEqual([...m.importKeys].sort(), ["g", "i", "p"]); assert.equal(m.emiBreakup.interest, 30); assert.equal(m.importSetBreakup, true);
  assert.deepEqual(undoImportBatch(after, "b2"), [e]);
});
test("an entry that already has a breakup keeps its own; an entry already linked is never linked again", () => {
  const own = { id: "e1", type: "cc_emi", amount: 2535.4, emiBreakup: { principal: 1, interest: 1, gst: 0 } };
  const m = applyMerges([own], [{ txnId: "e1", rows: ROWS, breakup: breakupOf(G) }], { batchId: "b" })[0];
  assert.deepEqual(m.emiBreakup, { principal: 1, interest: 1, gst: 0 }); assert.equal(m.importSetBreakup, undefined);
  const linked = { id: "e2", type: "expense", importKey: "old" };
  assert.deepEqual(applyMerges([linked], [{ txnId: "e2", rows: ROWS }], { batchId: "b" })[0], linked);
});
