import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeBillerAccounts } from "./merge.js";

test("throws for same id, or a missing survivor/duplicate", () => {
  const state = { billerAccounts: [{ id: "a" }] };
  assert.throws(() => mergeBillerAccounts(state, "a", "a"));
  assert.throws(() => mergeBillerAccounts(state, "a", "missing"));
  assert.throws(() => mergeBillerAccounts(state, "missing", "a"));
});

test("reported scenario: two accounts (\"Parixit\"/\"Me\"), same target — relationships converge, history kept", () => {
  const billerAccounts = [
    { id: "ba_parixit", name: "Parixit", type: "Gym / Fitness", billerId: "shell1" },
    { id: "ba_me", name: "Me", type: "Gym / Fitness", billerId: "shell1", consumerNo: "12345" },
  ];
  const membershipRelationships = [
    { id: "rel_parixit", billerAccountId: "ba_parixit", targetType: "person", targetId: "__me__", status: "active", statusHistory: [] },
    { id: "rel_me", billerAccountId: "ba_me", targetType: "person", targetId: "__me__", status: "active", statusHistory: [] },
  ];
  const memberships = [
    { id: "m1", billerAccountId: "ba_parixit", membershipRelationshipId: "rel_parixit", amount: 8499 },
  ];
  const state = { billerAccounts, membershipRelationships, memberships, bills: [], txns: [], feeSchedules: [] };

  const result = mergeBillerAccounts(state, "ba_me", "ba_parixit");

  assert.equal(result.billerAccounts.length, 1);
  assert.equal(result.billerAccounts[0].id, "ba_me");
  assert.equal(result.billerAccounts[0].consumerNo, "12345", "survivor's own field kept");

  // Same target on both sides -> converge onto the survivor's relationship, drop the duplicate's.
  assert.equal(result.membershipRelationships.length, 1);
  assert.equal(result.membershipRelationships[0].id, "rel_me");

  // The duplicate's payment history is kept, re-pointed at the survivor's account AND relationship.
  assert.equal(result.memberships.length, 1);
  assert.equal(result.memberships[0].billerAccountId, "ba_me");
  assert.equal(result.memberships[0].membershipRelationshipId, "rel_me");
});

test("different targets on each side: both relationships kept, re-pointed onto the survivor (1:N)", () => {
  const billerAccounts = [
    { id: "ba1", name: "A", type: "Society Maintenance" },
    { id: "ba2", name: "B", type: "Society Maintenance" },
  ];
  const membershipRelationships = [
    { id: "rel1", billerAccountId: "ba1", targetType: "person", targetId: "p1", status: "active", statusHistory: [] },
    { id: "rel2", billerAccountId: "ba2", targetType: "person", targetId: "p2", status: "active", statusHistory: [] },
  ];
  const state = { billerAccounts, membershipRelationships, memberships: [], bills: [], txns: [], feeSchedules: [] };

  const result = mergeBillerAccounts(state, "ba1", "ba2");

  assert.equal(result.membershipRelationships.length, 2);
  assert.ok(result.membershipRelationships.every(r => r.billerAccountId === "ba1"));
  const targetIds = result.membershipRelationships.map(r => r.targetId).sort();
  assert.deepEqual(targetIds, ["p1", "p2"]);
});

test("bills, transactions and feeSchedules pointing at the duplicate are re-pointed at the survivor", () => {
  const billerAccounts = [{ id: "ba1", name: "A", type: "Rental" }, { id: "ba2", name: "B", type: "Rental" }];
  const bills = [{ id: "b1", billerAccountId: "ba2" }, { id: "b2", billerAccountId: "ba1" }];
  const txns = [{ id: "t1", billerLinkId: "ba2" }, { id: "t2", billerLinkId: "other" }];
  const feeSchedules = [{ id: "fs1", billerAccountId: "ba2" }];
  const state = { billerAccounts, bills, txns, feeSchedules, memberships: [], membershipRelationships: [] };

  const result = mergeBillerAccounts(state, "ba1", "ba2");

  assert.equal(result.bills.find(b => b.id === "b1").billerAccountId, "ba1");
  assert.equal(result.bills.find(b => b.id === "b2").billerAccountId, "ba1");
  assert.equal(result.txns.find(t => t.id === "t1").billerLinkId, "ba1");
  assert.equal(result.txns.find(t => t.id === "t2").billerLinkId, "other", "unrelated txn untouched");
  assert.equal(result.feeSchedules.find(f => f.id === "fs1").billerAccountId, "ba1");
});

test("survivor's own fields are never overwritten by the duplicate's", () => {
  const billerAccounts = [
    { id: "ba1", name: "Keep me", type: "Gym / Fitness", provider: "Real Provider", note: "my own note" },
    { id: "ba2", name: "Drop me", type: "Gym / Fitness", provider: "Should not win", note: "should not win either" },
  ];
  const state = { billerAccounts, bills: [], txns: [], feeSchedules: [], memberships: [], membershipRelationships: [] };
  const result = mergeBillerAccounts(state, "ba1", "ba2");
  const survivor = result.billerAccounts[0];
  assert.equal(survivor.provider, "Real Provider");
  assert.equal(survivor.note, "my own note");
});
