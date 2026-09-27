import { test } from "node:test";
import assert from "node:assert/strict";
import { getGroupCollectiveDue, groupReceivableTotal } from "./receivable.js";

test("getGroupCollectiveDue: zero for a non-expense or group-less transaction", () => {
  assert.equal(getGroupCollectiveDue({ type: "income", groupId: "gA", amount: 500 }), 0);
  assert.equal(getGroupCollectiveDue({ type: "expense", amount: 500 }), 0);
});

test("getGroupCollectiveDue: whole-transaction collective figure, net of settled", () => {
  const t = { type: "expense", groupId: "gA", trackingMode: "split", groupCollectiveAmount: 1000, groupCollectiveSettledAmt: 400 };
  assert.equal(getGroupCollectiveDue(t), 600);
});

test("groupReceivableTotal: two-group split, one Attribute (spent_on) one Collect (owes) — confirmed bug reproduction", () => {
  // Milk-packet scenario: primary groupId happens to be group A (Attribute — first row added),
  // group B is the one that actually owes money. Before the fix, A's total wrongly equalled B's.
  const txns = [{
    id: "t1", type: "expense", amount: 500,
    groupId: "groupA", // legacy primary, set to whichever row was added first — NOT who owes
    groupCollectiveAmount: 300, // == group B's "owes" allocation only (Attribute rows never add to this)
    groupCollectiveSettledAmt: 0,
    groupAllocations: [
      { groupId: "groupA", amount: 200, mode: "spent_on" },
      { groupId: "groupB", amount: 300, mode: "owes" },
    ],
    people: {},
  }];
  const deps = { txns, bills: [], loans: [], groups: [] };
  assert.equal(groupReceivableTotal(deps, "groupA"), 0, "Attribute-mode group must owe nothing, even as the legacy primary groupId");
  assert.equal(groupReceivableTotal(deps, "groupB"), 300, "Collect-mode group keeps its own correct amount");
});

test("groupReceivableTotal: a genuinely single-group (legacy, no groupAllocations) expense still works", () => {
  const txns = [{
    id: "t1", type: "expense", amount: 500, groupId: "groupA", trackingMode: "split",
    groupCollectiveAmount: 500, groupCollectiveSettledAmt: 0,
    people: {},
  }];
  const deps = { txns, bills: [], loans: [], groups: [] };
  assert.equal(groupReceivableTotal(deps, "groupA"), 500);
});

test("groupReceivableTotal: partially settled multi-group allocation nets down correctly", () => {
  const txns = [{
    id: "t1", type: "expense", amount: 900,
    groupId: "groupB",
    groupCollectiveAmount: 600, groupCollectiveSettledAmt: 300, // 50% settled overall
    groupAllocations: [
      { groupId: "groupA", amount: 300, mode: "spent_on" },
      { groupId: "groupB", amount: 600, mode: "owes" },
    ],
    people: {},
  }];
  const deps = { txns, bills: [], loans: [], groups: [] };
  assert.equal(groupReceivableTotal(deps, "groupA"), 0);
  assert.equal(groupReceivableTotal(deps, "groupB"), 300, "600 owed, 50% settled ratio applied to group B's own share");
});

test("groupReceivableTotal: unpaid Bill split and individually-tagged member expense both still count", () => {
  const bills = [{ id: "b1", groupId: "groupA", status: "unpaid", splitPeople: { p1: { mode: "owes", amount: 100, settled: false } }, groupCollectiveAmount: 50 }];
  const txns = [{ id: "t2", type: "expense", people: { p1: { mode: "owes", amount: 75, settled: false } } }];
  const groups = [{ id: "groupA", members: ["p1"] }];
  const deps = { txns, bills, loans: [], groups };
  assert.equal(groupReceivableTotal(deps, "groupA"), 100 + 50 + 75);
});
