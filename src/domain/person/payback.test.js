import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPaybackTxn, isPersonPayback, getPaybacks, getPaybackTotal, getPaybackTotalsByPerson, applyPaybacks } from "./payback.js";
import { computeAccountBalance } from "../accounts/accountBalance.js";
import { getHouseholdAttributedTotal } from "../../../domain/allocations/adapter.js";

const pay = (o = {}) => buildPaybackTxn({ personId: "p1", personName: "Ravi", fromAccId: "b1", amount: 400, date: "2026-10-10", id: "pb1", now: 1, ...o });
const inRange = () => true;

test("a payback is a destination-less transfer tagged with the person (and group)", () => {
  const t = pay({ groupId: "g1" });
  assert.deepEqual([t.type, t.fromAccId, t.toAccId, t.paidToPersonId, t.paidToGroupId, t.isPersonPayback], ["transfer", "b1", null, "p1", "g1", true]);
  assert.equal(isPersonPayback(t), true);
  assert.equal(isPersonPayback({ type: "transfer", fromAccId: "b1" }), false);
  assert.equal(pay().paidToGroupId, null);
});

test("it debits the account exactly once and is not spending", () => {
  const accounts = [{ id: "b1", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01" }];
  const t = pay();
  assert.equal(computeAccountBalance({ accId: "b1", accounts, txns: [t], isDateInRange: inRange }), 9600);
  assert.equal(getHouseholdAttributedTotal({ periodTransactions: [t], allTransactions: [t] }), 0);
});

test("owing 1,000 and paying back 400 leaves 600; paying all clears it", () => {
  assert.deepEqual(applyPaybacks({ owesMe: 0, iOwe: 1000 }, 400), { owesMe: 0, iOwe: 600, excess: 0 });
  assert.deepEqual(applyPaybacks({ owesMe: 0, iOwe: 1000 }, 1000), { owesMe: 0, iOwe: 0, excess: 0 });
});

test("paying back MORE than owed: the excess becomes what they owe you; nothing is lost", () => {
  assert.deepEqual(applyPaybacks({ owesMe: 0, iOwe: 1000 }, 1500), { owesMe: 500, iOwe: 0, excess: 500 });
  assert.deepEqual(applyPaybacks({ owesMe: 200, iOwe: 0 }, 300), { owesMe: 500, iOwe: 0, excess: 300 });
});

test("several paybacks add up; group filter and per-person totals", () => {
  const txns = [pay({ id: "a", amount: 100, date: "2026-10-02" }), pay({ id: "b", amount: 250, groupId: "g1", date: "2026-10-01" }), pay({ id: "c", personId: "p2", amount: 70 }), { id: "x", type: "expense", amount: 5 }];
  assert.equal(getPaybackTotal(txns, "p1"), 350);
  assert.equal(getPaybackTotal(txns, "p1", { groupId: "g1" }), 250);
  assert.equal(getPaybackTotal(txns, "p1", { groupId: null }), 100);
  assert.deepEqual(getPaybacks(txns, "p1").map(t => t.id), ["b", "a"]); // oldest first
  assert.deepEqual(getPaybackTotalsByPerson(txns), { p1: 350, p2: 70 });
});
