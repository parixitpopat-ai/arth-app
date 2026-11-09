import { test } from "node:test";
import assert from "node:assert/strict";
import { expenseGaps, summarizeGaps, GAP_LABELS } from "./completeness.js";

const cats = [{ id: "food", subs: [{ id: "f1" }, { id: "f2" }] }, { id: "misc", subs: [] }, { id: "transport", subs: [{ id: "t1" }] }];
const ok = { type: "expense", amount: 100, date: "2026-11-01", catIds: ["food"], subIds: ["f1"], people: { p1: { amount: 100 } } };

test("a complete expense (category, sub-category, another person) has no gaps", () => assert.deepEqual(expenseGaps(ok, cats), []));
test("only expenses are judged", () => { for (const type of ["income", "transfer", "cc_payment", "settlement_in", "investment"]) assert.deepEqual(expenseGaps({ type, amount: 1 }, cats), [], type); assert.deepEqual(expenseGaps(null, cats), []); });
test("no category -> 'category' (and no sub-category is asked for)", () => {
  assert.deepEqual(expenseGaps({ ...ok, catIds: [], subIds: [], catId: "" }, cats), ["category"]);
  assert.deepEqual(expenseGaps({ ...ok, catIds: undefined, catId: undefined, subIds: undefined }, cats), ["category"]);
});
test("legacy single-value fields count (catId / subId)", () => assert.deepEqual(expenseGaps({ ...ok, catIds: undefined, catId: "food", subIds: undefined, subId: "f2" }, cats), []));
test("a category with sub-categories needs one; a category without any does not", () => {
  assert.deepEqual(expenseGaps({ ...ok, subIds: [] }, cats), ["subcategory"]);
  assert.deepEqual(expenseGaps({ ...ok, catIds: ["misc"], subIds: [] }, cats), []);
  assert.deepEqual(expenseGaps({ ...ok, catIds: ["unknown-cat"], subIds: [] }, cats), [], "a category that no longer exists cannot demand a sub-category");
});
test("itemised expenses: a sub-category on any line is enough", () => assert.deepEqual(expenseGaps({ ...ok, subIds: [], lineItems: [{ label: "a" }, { label: "b", subId: "f1" }] }, cats), []));
test("'Me' is a person: an expense tagged to Me is complete; one tagged to nobody is not", () => {
  assert.deepEqual(expenseGaps({ ...ok, people: { __me__: { amount: 100 } } }, cats), []);
  assert.deepEqual(expenseGaps({ ...ok, people: { __me__: { amount: 50 }, p2: { amount: 50 } } }, cats), [], "Me plus another person is fine");
  assert.deepEqual(expenseGaps({ ...ok, people: {} }, cats), ["owner"]);
  assert.deepEqual(expenseGaps({ ...ok, people: undefined }, cats), ["owner"]);
  assert.deepEqual(expenseGaps({ ...ok, people: null }, cats), ["owner"]);
});
test("the switch: with meCounts off, Me alone is reported", () => assert.deepEqual(expenseGaps({ ...ok, people: { __me__: {} } }, cats, { meCounts: false }), ["owner"]));
test("a group, a vehicle, a one-time person or someone who paid each count as an owner", () => {
  for (const extra of [{ groupId: "g1" }, { vehicleId: "v1" }, { guestPerson: "Plumber" }, { paidByPersonId: "p9" }]) assert.deepEqual(expenseGaps({ ...ok, people: {}, ...extra }, cats), [], JSON.stringify(extra));
  assert.deepEqual(expenseGaps({ ...ok, people: {}, guestPerson: "   " }, cats), ["owner"], "a blank one-time name is not a person");
});
test("a vehicle expense is exempt from the person/group rule but not from category rules", () => {
  assert.deepEqual(expenseGaps({ type: "expense", amount: 5, vehicleId: "v1", catIds: ["transport"], subIds: [] }, cats), ["subcategory"]);
  assert.deepEqual(expenseGaps({ type: "expense", amount: 5, vehicleId: "v1", catIds: [] }, cats), ["category"]);
});
test("everything missing at once", () => assert.deepEqual(expenseGaps({ type: "expense", amount: 5 }, cats), ["category", "owner"]));
test("summarizeGaps: counts, the amount, newest first; complete ones and non-expenses are left out", () => {
  const txns = [ok, { id: "a", type: "expense", amount: 40, date: "2026-10-01", people: { __me__: {} } }, { id: "b", type: "expense", amount: 60, date: "2026-11-05", catIds: ["food"], subIds: [], people: { p1: {} } }, { type: "income", amount: 999 }];
  const s = summarizeGaps(txns, cats);
  assert.equal(s.total, 2); assert.equal(s.amount, 100); assert.deepEqual(s.byGap, { category: 1, subcategory: 1, owner: 0 });
  assert.deepEqual(s.items.map(i => i.txn.id), ["b", "a"]); assert.deepEqual(s.items[1].gaps, ["category"]);
  assert.equal(summarizeGaps([], cats).total, 0); assert.equal(summarizeGaps(undefined, cats).total, 0);
});
test("labels exist for every gap", () => { for (const g of ["category", "subcategory", "owner"]) assert.ok(GAP_LABELS[g]); });

test("the operator's own person id is Me too (a form that defaults 'Paid by' to Me)", () => {
  const meId = "p_me";
  assert.deepEqual(expenseGaps({ ...ok, people: {}, paidByPersonId: meId }, cats, { mePersonId: meId }), []);
  assert.deepEqual(expenseGaps({ ...ok, people: { [meId]: { amount: 5 } } }, cats, { mePersonId: meId }), []);
  assert.deepEqual(expenseGaps({ ...ok, people: {}, paidByPersonId: meId }, cats, { mePersonId: meId, meCounts: false }), ["owner"]);
  assert.deepEqual(expenseGaps({ ...ok, people: {}, paidByPersonId: "p_other" }, cats, { mePersonId: meId }), []);
});

test("a group named only in the group allocations counts as a group", () => {
  assert.deepEqual(expenseGaps({ ...ok, people: {}, groupAllocations: [{ groupId: "g1", amount: 100 }] }, cats), []);
  assert.deepEqual(expenseGaps({ ...ok, people: {}, groupAllocations: [] }, cats), ["owner"]);
});
