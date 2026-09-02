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

test("breakdown lists only transactions where this person has a real attributed amount", () => {
  const txns = [
    { id: "t1", type: "expense", desc: "Dinner", date: "2026-08-20", people: { p1: { mode: "owes" } } },
    { id: "t2", type: "expense", desc: "Unrelated", date: "2026-08-19", people: {} },
    { id: "t3", type: "income", desc: "Salary", date: "2026-08-18", people: { p1: { mode: "owes" } } },
  ];
  const getPersonAttributedAmount = (t, pid) => (t.id === "t1" ? 500 : 0);
  const items = getFinancialPositionBreakdown("p1", txns, [], getPersonAttributedAmount);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "t1");
  assert.equal(items[0].amount, 500);
  assert.equal(items[0].mode, "owesMe");
});

test("breakdown correctly labels iOwe vs owesMe based on the transaction's own mode", () => {
  const txns = [
    { id: "t1", type: "expense", desc: "A", date: "2026-08-20", people: { p1: { mode: "owes" } } },
    { id: "t2", type: "expense", desc: "B", date: "2026-08-19", people: { p1: { mode: "spent_on" } } },
  ];
  const getPersonAttributedAmount = () => 100;
  const items = getFinancialPositionBreakdown("p1", txns, [], getPersonAttributedAmount);
  assert.equal(items.find(i => i.id === "t1").mode, "owesMe");
  assert.equal(items.find(i => i.id === "t2").mode, "iOwe");
});

test("breakdown includes bills with a real remaining balance, excludes fully-settled ones", () => {
  const bills = [
    { id: "b1", name: "Rent", dueDate: "2026-08-01", splitPeople: { p1: { mode: "owes", amount: 1000, settledAmt: 400 } } },
    { id: "b2", name: "Fully paid", dueDate: "2026-07-01", splitPeople: { p1: { mode: "owes", amount: 500, settledAmt: 500 } } },
  ];
  const items = getFinancialPositionBreakdown("p1", [], bills, () => 0);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "b1");
  assert.equal(items[0].amount, 600);
});

test("breakdown never fabricates a total independent of the inputs — empty inputs produce an empty breakdown", () => {
  assert.deepEqual(getFinancialPositionBreakdown("p1", [], [], () => 0), []);
  assert.deepEqual(getFinancialPositionBreakdown("p1", undefined, undefined, () => 0), []);
});

test("breakdown is sorted most-recent first", () => {
  const txns = [
    { id: "old", type: "expense", desc: "Old", date: "2026-01-01", people: { p1: { mode: "owes" } } },
    { id: "new", type: "expense", desc: "New", date: "2026-08-01", people: { p1: { mode: "owes" } } },
  ];
  const items = getFinancialPositionBreakdown("p1", txns, [], () => 100);
  assert.deepEqual(items.map(i => i.id), ["new", "old"]);
});
