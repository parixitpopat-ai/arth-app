import { test } from "node:test";
import assert from "node:assert/strict";
import { getFinancialPositionLabel, getFinancialPositionBreakdown } from "./financialPosition.js";

test("balanced when owesMe equals iOwe", () => {
  const result = getFinancialPositionLabel({ owesMe: 500, iOwe: 500 });
  assert.equal(result.state, "balanced");
  assert.equal(result.amount, 0);
});

test("balanced when both are zero", () => {
  const result = getFinancialPositionLabel({ owesMe: 0, iOwe: 0 });
  assert.equal(result.state, "balanced");
});

test("they owe me when net is positive", () => {
  const result = getFinancialPositionLabel({ owesMe: 2000, iOwe: 500 });
  assert.equal(result.state, "owed_to_me");
  assert.equal(result.amount, 1500);
  assert.equal(result.owesMe, 2000);
  assert.equal(result.iOwe, 500);
});

test("I owe them when net is negative", () => {
  const result = getFinancialPositionLabel({ owesMe: 200, iOwe: 900 });
  assert.equal(result.state, "i_owe");
  assert.equal(result.amount, 700);
});

test("handles missing/undefined settlement gracefully — balanced, not a crash", () => {
  assert.equal(getFinancialPositionLabel(undefined).state, "balanced");
  assert.equal(getFinancialPositionLabel(null).state, "balanced");
  assert.equal(getFinancialPositionLabel({}).state, "balanced");
});

// --- getFinancialPositionBreakdown ------------------------------------
// meId is a fixed sentinel throughout — "me" ("__me__" in real data), never one of the test
// people (p1 etc.), matching App.jsx's own settlements[] computation.

const ME = "__me__";

test("breakdown lists real owes-me transactions (mode:owes), not unrelated or income ones", () => {
  const txns = [
    { id: "t1", type: "expense", desc: "Dinner", date: "2026-08-20", people: { p1: { mode: "owes", amount: 500 } } },
    { id: "t2", type: "expense", desc: "Unrelated", date: "2026-08-19", people: {} },
    { id: "t3", type: "income", desc: "Salary", date: "2026-08-18", people: { p1: { mode: "owes", amount: 500 } } },
  ];
  const items = getFinancialPositionBreakdown("p1", txns, [], ME);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "t1");
  assert.equal(items[0].amount, 500);
  assert.equal(items[0].mode, "owesMe");
});

test("breakdown correctly labels owesMe (mode:owes) vs iOwe (mode:owes_by_me) — mode:spent_on is neither and is excluded", () => {
  const txns = [
    { id: "t1", type: "expense", desc: "A", date: "2026-08-20", people: { p1: { mode: "owes", amount: 100 } } },
    { id: "t2", type: "expense", desc: "B", date: "2026-08-19", people: { p1: { mode: "owes_by_me", amount: 100 } } },
    { id: "t3", type: "expense", desc: "C", date: "2026-08-18", people: { p1: { mode: "spent_on", amount: 100 } } },
  ];
  const items = getFinancialPositionBreakdown("p1", txns, [], ME);
  assert.equal(items.find(i => i.id === "t1").mode, "owesMe");
  assert.equal(items.find(i => i.id === "t2_iowe").mode, "iOwe");
  assert.equal(items.length, 2, "mode:spent_on is a different fact (money spent ON them) and contributes nothing here");
});

test("breakdown never counts a settled receivable — matches remainingShare's own rule", () => {
  const txns = [{ id: "t1", type: "expense", desc: "Paid back", date: "2026-08-20", people: { p1: { mode: "owes", amount: 500, settled: true } } }];
  assert.deepEqual(getFinancialPositionBreakdown("p1", txns, [], ME), []);
});

test("breakdown's remainingShare-based amount uses remainingAmt when present, else amount", () => {
  const txns = [{ id: "t1", type: "expense", desc: "Partial", date: "2026-08-20", people: { p1: { mode: "owes", amount: 1000, remainingAmt: 300 } } }];
  const items = getFinancialPositionBreakdown("p1", txns, [], ME);
  assert.equal(items[0].amount, 300);
});

test("breakdown includes forPerson-tagged receivables not already counted via mode:owes", () => {
  const txns = [{ id: "t1", type: "expense", desc: "Gift", date: "2026-08-20", forPerson: "p1", tagPersonAmount: 250 }];
  const items = getFinancialPositionBreakdown("p1", txns, [], ME);
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, 250);
  assert.equal(items[0].mode, "owesMe");
});

test("breakdown includes tagItems person entries as receivables", () => {
  const txns = [{ id: "t1", type: "expense", desc: "Shared cart", date: "2026-08-20", tagItems: [{ targetType: "person", targetId: "p1", amount: 175 }] }];
  const items = getFinancialPositionBreakdown("p1", txns, [], ME);
  assert.equal(items.length, 1);
  assert.equal(items[0].amount, 175);
});

test("breakdown includes settlement_in (with extraAmount+settlementLinks) and settlement_out as iOwe", () => {
  const txns = [
    { id: "t1", type: "settlement_in", date: "2026-08-20", fromPersonId: "p1", extraAmount: 200, settlementLinks: [{ x: 1 }] },
    { id: "t2", type: "settlement_out", date: "2026-08-19", toPersonId: "p1", amount: 150 },
    { id: "t3", type: "settlement_in", date: "2026-08-18", fromPersonId: "p1", extraAmount: 50, settlementLinks: [] }, // no links — excluded
  ];
  const items = getFinancialPositionBreakdown("p1", txns, [], ME);
  assert.equal(items.length, 2);
  assert.equal(items.find(i => i.id === "t1").amount, 200);
  assert.equal(items.find(i => i.id === "t2").amount, 150);
  items.forEach(i => assert.equal(i.mode, "iOwe"));
});

test("breakdown includes bills with a real remaining balance, excludes fully-settled ones", () => {
  const bills = [
    { id: "b1", name: "Rent", dueDate: "2026-08-01", splitPeople: { p1: { mode: "owes", amount: 1000, settledAmt: 400 } } },
    { id: "b2", name: "Fully paid", dueDate: "2026-07-01", splitPeople: { p1: { mode: "owes", amount: 500, settledAmt: 500 } } },
  ];
  const items = getFinancialPositionBreakdown("p1", [], bills, ME);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "b1");
  assert.equal(items[0].amount, 600);
});

test("breakdown never fabricates a total independent of the inputs — empty inputs produce an empty breakdown", () => {
  assert.deepEqual(getFinancialPositionBreakdown("p1", [], [], ME), []);
  assert.deepEqual(getFinancialPositionBreakdown("p1", undefined, undefined, ME), []);
});

test("breakdown is sorted most-recent first", () => {
  const txns = [
    { id: "old", type: "expense", desc: "Old", date: "2026-01-01", people: { p1: { mode: "owes", amount: 100 } } },
    { id: "new", type: "expense", desc: "New", date: "2026-08-01", people: { p1: { mode: "owes", amount: 100 } } },
  ];
  const items = getFinancialPositionBreakdown("p1", txns, [], ME);
  assert.deepEqual(items.map(i => i.id), ["new", "old"]);
});

// --- transactionRef pass-through (lets a caller spot two entries backed by the same real
// UPI/bank reference — the same physical payment recorded twice — without a second calculation) ---

test("breakdown passes through the underlying transaction's real transactionRef unchanged", () => {
  const txns = [
    { id: "t1", type: "expense", desc: "A", date: "2026-08-20", people: { p1: { mode: "owes", amount: 100 } }, transactionRef: "UTR123456" },
    { id: "t2", type: "expense", desc: "B", date: "2026-08-19", people: { p1: { mode: "owes", amount: 100 } } }, // no ref recorded
  ];
  const items = getFinancialPositionBreakdown("p1", txns, [], ME);
  assert.equal(items.find(i => i.id === "t1").transactionRef, "UTR123456");
  assert.equal(items.find(i => i.id === "t2").transactionRef, null, "no ref on record is null, never fabricated");
});

test("breakdown never fabricates a transactionRef for a Bill-sourced entry — always null", () => {
  const bills = [{ id: "b1", name: "Rent", dueDate: "2026-08-01", splitPeople: { p1: { mode: "owes", amount: 1000 } } }];
  const items = getFinancialPositionBreakdown("p1", [], bills, ME);
  assert.equal(items[0].transactionRef, null);
});

test("two entries sharing the same real transactionRef are both surfaced, unmodified — detection is the caller's job, not this function's", () => {
  const txns = [
    { id: "t1", type: "expense", desc: "Dup A", date: "2026-08-20", people: { p1: { mode: "owes", amount: 100 } }, transactionRef: "UTR999" },
    { id: "t2", type: "expense", desc: "Dup B", date: "2026-08-20", people: { p1: { mode: "owes", amount: 100 } }, transactionRef: "UTR999" },
  ];
  const items = getFinancialPositionBreakdown("p1", txns, [], ME);
  assert.equal(items.length, 2, "this function only enumerates — it never dedupes or merges on the caller's behalf");
  assert.deepEqual(items.map(i => i.transactionRef), ["UTR999", "UTR999"]);
});

test("a shared transactionRef is surfaced but never changes the financial total — the sum is exactly the two real amounts, not merged or deduped", () => {
  const txns = [
    { id: "t1", type: "expense", desc: "Dup A", date: "2026-08-20", people: { p1: { mode: "owes", amount: 1500 } }, transactionRef: "UTR999" },
    { id: "t2", type: "expense", desc: "Dup B", date: "2026-08-20", people: { p1: { mode: "owes", amount: 1500 } }, transactionRef: "UTR999" },
  ];
  const items = getFinancialPositionBreakdown("p1", txns, [], ME);
  const owesMeSum = items.filter(i => i.mode === "owesMe").reduce((s, i) => s + i.amount, 0);
  assert.equal(owesMeSum, 3000, "surfacing the duplicate reference is presentation only — it does not alter the enumerated total");
});

// --- Reconciliation: the breakdown's enumerated sum must exactly equal an independently
// computed receivables/payables total for the same inputs — the property the live
// investigation found broken (a correct total sitting above an incomplete breakdown). This
// independent oracle mirrors App.jsx's settlements[] logic (receivables/payables useMemo)
// structurally, but is written fresh here specifically so it can't share a bug with the
// implementation under test. ---

function independentSettlementTotal(personId, txns, bills, meId) {
  let receivable = 0;
  let payable = 0;
  (txns || []).forEach(t => {
    if (t.type === "expense") {
      const peopleMap = { ...(t.splitPeople || {}), ...(t.people || {}) };
      const info = peopleMap[personId];
      if (info && personId !== meId && info.mode === "owes" && !info.settled) {
        receivable += Math.max(0, Number(info.remainingAmt ?? info.amount ?? 0));
      } else if (t.forPerson === personId && personId !== meId) {
        const amt = Number(t.tagPersonAmount || 0) > 0 ? Number(t.tagPersonAmount) : (t.tagMode === "person" ? Number(t.amount || 0) : 0);
        receivable += Math.max(0, amt);
      } else {
        const tagItem = (t.tagItems || []).find(i => i.targetType === "person" && i.targetId === personId);
        if (tagItem) receivable += Math.max(0, Number(tagItem.amount || 0));
      }
      const owesByMeInfo = t.people?.[personId];
      if (owesByMeInfo && owesByMeInfo.mode === "owes_by_me") payable += Math.max(0, Number(owesByMeInfo.amount || 0));
    }
    if (t.type === "settlement_in" && t.fromPersonId === personId && Number(t.extraAmount || 0) > 0 && (t.settlementLinks || []).length > 0) {
      payable += Number(t.extraAmount);
    }
    if (t.type === "settlement_out" && t.toPersonId === personId) {
      payable += Math.max(0, Number(t.amount || 0));
    }
  });
  (bills || []).forEach(b => {
    if (!b.splitPeople) return;
    const info = b.splitPeople[personId];
    if (!info || info.mode !== "owes" || info.settled) return;
    const remaining = Number(info.amount || 0) - Number(info.settledAmt || 0);
    if (remaining > 0) receivable += remaining;
  });
  return { receivable, payable };
}

test("reconciliation: breakdown's enumerated owesMe/iOwe sums exactly equal an independent receivables/payables total, across every real source at once", () => {
  const txns = [
    { id: "t1", type: "expense", desc: "Dinner", date: "2026-09-01", people: { p1: { mode: "owes", amount: 500 } } },
    { id: "t2", type: "expense", desc: "Partial", date: "2026-08-15", people: { p1: { mode: "owes", amount: 1000, remainingAmt: 300 } } },
    { id: "t3", type: "expense", desc: "Already settled", date: "2026-08-10", people: { p1: { mode: "owes", amount: 999, settled: true } } },
    { id: "t4", type: "expense", desc: "Tagged gift", date: "2026-08-05", forPerson: "p1", tagPersonAmount: 250 },
    { id: "t5", type: "expense", desc: "Shared cart item", date: "2026-08-01", tagItems: [{ targetType: "person", targetId: "p1", amount: 175 }] },
    { id: "t6", type: "expense", desc: "I owe them", date: "2026-07-28", people: { p1: { mode: "owes_by_me", amount: 400 } } },
    { id: "t7", type: "settlement_in", date: "2026-07-20", fromPersonId: "p1", extraAmount: 200, settlementLinks: [{ x: 1 }] },
    { id: "t8", type: "settlement_out", date: "2026-07-15", toPersonId: "p1", amount: 150 },
    { id: "t9", type: "expense", desc: "Unrelated spent_on", date: "2026-07-10", people: { p1: { mode: "spent_on", amount: 9999 } } },
  ];
  const bills = [{ id: "b1", name: "Rent", dueDate: "2026-06-01", splitPeople: { p1: { mode: "owes", amount: 1000, settledAmt: 400 } } }];

  const items = getFinancialPositionBreakdown("p1", txns, bills, ME);
  const enumeratedOwesMe = items.filter(i => i.mode === "owesMe").reduce((s, i) => s + i.amount, 0);
  const enumeratedIOwe = items.filter(i => i.mode === "iOwe").reduce((s, i) => s + i.amount, 0);

  const independent = independentSettlementTotal("p1", txns, bills, ME);

  assert.equal(enumeratedOwesMe, independent.receivable, "owesMe enumeration must reconcile exactly to the independent receivables total");
  assert.equal(enumeratedIOwe, independent.payable, "iOwe enumeration must reconcile exactly to the independent payables total");
  // Concrete expected values, so this test fails loudly (not just "numbers matched by
  // coincidence") if either side's logic drifts: 500 + 300 + 250 + 175 (txns) + 600 (bill b1,
  // 1000-400) = 1825 receivable; 400 + 200 + 150 = 750 payable. t3 (settled) and t9 (spent_on)
  // contribute nothing to either.
  assert.equal(enumeratedOwesMe, 1825);
  assert.equal(enumeratedIOwe, 750);
});
