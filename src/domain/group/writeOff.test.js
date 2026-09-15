import { test } from "node:test";
import assert from "node:assert/strict";
import { writeOffGroupTxns, writeOffGroupBills, groupHasOutstandingBalance } from "./writeOff.js";

// --- writeOffGroupTxns ---------------------------------------------------------

test("writeOffGroupTxns settles every unsettled owes entry for the given group, across multiple people", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "owes", settled: false }, p2: { amount: 50, mode: "owes", settled: false } } },
    { id: "t2", groupId: "g2", type: "expense", people: { p1: { amount: 30, mode: "owes", settled: false } } }, // different group, untouched
  ];
  const result = writeOffGroupTxns(txns, "g1");
  assert.equal(result[0].people.p1.settled, true);
  assert.equal(result[0].people.p2.settled, true);
  assert.equal(result[1].people.p1.settled, false); // untouched, wrong group
});

test("writeOffGroupTxns settles __me__ entries exactly like any other pid — closes the 'I owe' direction", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { __me__: { amount: 200, mode: "owes", settled: false } } },
  ];
  const result = writeOffGroupTxns(txns, "g1");
  assert.equal(result[0].people.__me__.settled, true);
});

test("writeOffGroupTxns never touches spent_on mode entries", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "spent_on", settled: false } } },
  ];
  const result = writeOffGroupTxns(txns, "g1");
  assert.equal(result[0].people.p1.settled, false);
  assert.equal(result[0].people.p1.mode, "spent_on");
});

test("writeOffGroupTxns never touches already-settled entries (no-op, same values)", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "owes", settled: true } } },
  ];
  const result = writeOffGroupTxns(txns, "g1");
  assert.equal(result[0], txns[0]); // unchanged reference — nothing to change
});

test("writeOffGroupTxns never deletes or rewrites amount — only sets settled:true", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 123.45, mode: "owes", settled: false } } },
  ];
  const result = writeOffGroupTxns(txns, "g1");
  assert.equal(result[0].people.p1.amount, 123.45);
  assert.equal(result.length, txns.length);
});

test("writeOffGroupTxns skips non-expense and non-matching-group transactions untouched", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "income", people: { p1: { amount: 100, mode: "owes", settled: false } } },
    { id: "t2", groupId: null, type: "expense", people: { p1: { amount: 100, mode: "owes", settled: false } } },
  ];
  const result = writeOffGroupTxns(txns, "g1");
  assert.deepEqual(result, txns);
});

test("writeOffGroupTxns never mutates the input array or its entries", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "owes", settled: false } } },
  ];
  const snapshot = JSON.parse(JSON.stringify(txns));
  writeOffGroupTxns(txns, "g1");
  assert.deepEqual(txns, snapshot);
});

test("writeOffGroupTxns handles empty/missing input gracefully", () => {
  assert.deepEqual(writeOffGroupTxns([], "g1"), []);
  assert.deepEqual(writeOffGroupTxns(undefined, "g1"), []);
});

// --- writeOffGroupBills ---------------------------------------------------------

test("writeOffGroupBills settles every unsettled owes entry for unpaid bills in the given group", () => {
  const bills = [
    { id: "b1", groupId: "g1", status: "unpaid", splitPeople: { p1: { amount: 100, mode: "owes", settled: false } } },
    { id: "b2", groupId: "g1", status: "paid", splitPeople: { p1: { amount: 100, mode: "owes", settled: false } } }, // paid, untouched
  ];
  const result = writeOffGroupBills(bills, "g1");
  assert.equal(result[0].splitPeople.p1.settled, true);
  assert.equal(result[1].splitPeople.p1.settled, false);
});

test("writeOffGroupBills never mutates input", () => {
  const bills = [
    { id: "b1", groupId: "g1", status: "unpaid", splitPeople: { p1: { amount: 100, mode: "owes", settled: false } } },
  ];
  const snapshot = JSON.parse(JSON.stringify(bills));
  writeOffGroupBills(bills, "g1");
  assert.deepEqual(bills, snapshot);
});

// --- groupHasOutstandingBalance ---------------------------------------------------------

test("groupHasOutstandingBalance is true when either direction is positive", () => {
  assert.equal(groupHasOutstandingBalance(100, 0), true);
  assert.equal(groupHasOutstandingBalance(0, 50), true);
  assert.equal(groupHasOutstandingBalance(100, 50), true);
});

test("groupHasOutstandingBalance is false only when both directions are zero or less", () => {
  assert.equal(groupHasOutstandingBalance(0, 0), false);
  assert.equal(groupHasOutstandingBalance(-5, 0), false); // defensive, shouldn't occur in practice
});

test("groupHasOutstandingBalance handles null/undefined as zero", () => {
  assert.equal(groupHasOutstandingBalance(null, undefined), false);
});

// --- PGRP-001 WP1 follow-up regression: full write-off + archive sequence preserves every record ---

test("REGRESSION: write-off never removes a transaction or bill, never changes its groupId, only flips settled — proves 'existing records referencing archived Group remain intact'", () => {
  const txns = [
    { id: "t1", groupId: "g1", type: "expense", people: { p1: { amount: 100, mode: "owes", settled: false } } },
    { id: "t2", groupId: "g1", type: "expense", people: { __me__: { amount: 40, mode: "owes", settled: false } } },
  ];
  const bills = [
    { id: "b1", groupId: "g1", status: "unpaid", splitPeople: { p1: { amount: 60, mode: "owes", settled: false } } },
  ];
  const nextTxns = writeOffGroupTxns(txns, "g1");
  const nextBills = writeOffGroupBills(bills, "g1");

  assert.equal(nextTxns.length, txns.length);
  assert.equal(nextBills.length, bills.length);
  assert.deepEqual(nextTxns.map(t => t.id), txns.map(t => t.id));
  assert.deepEqual(nextTxns.map(t => t.groupId), ["g1", "g1"]); // groupId never rewritten
  assert.equal(nextTxns[0].people.p1.settled, true);
  assert.equal(nextTxns[1].people.__me__.settled, true);
  assert.equal(nextBills[0].groupId, "g1");
  assert.equal(nextBills[0].splitPeople.p1.settled, true);
});
