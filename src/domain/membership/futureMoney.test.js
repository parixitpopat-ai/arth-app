import { test } from "node:test";
import assert from "node:assert/strict";
import { mapMembershipToCommitment, projectMembershipsToCommitments } from "./futureMoney.js";

const getCurrentPeriod = periodsByMembershipId => m => periodsByMembershipId[m.id] || null;

test("mapMembershipToCommitment: a gym membership 90 days out is projected, no forward cap applied", () => {
  const ba = { id: "ba1", name: "Genesis Gym", type: "Gym / Fitness" };
  const memberships = [{ id: "m1", billerAccountId: "ba1", amount: 8499 }];
  const period = { from: "2026-06-30", to: "2026-12-27", graceDays: 0 };
  const commitment = mapMembershipToCommitment(ba, memberships, getCurrentPeriod({ m1: period }));
  assert.equal(commitment.sourceType, "membership");
  assert.equal(commitment.sourceId, "ba1");
  assert.equal(commitment.category, "committedSpending");
  assert.equal(commitment.name, "Genesis Gym");
  assert.equal(commitment.amount, 8499);
  assert.equal(commitment.date, "2026-12-27");
  assert.equal(commitment.status, "unpaid");
});

test("mapMembershipToCommitment: School Fees biller types are excluded (handled separately)", () => {
  const ba = { id: "ba1", name: "School", type: "School Fees" };
  const memberships = [{ id: "m1", billerAccountId: "ba1", amount: 5000 }];
  const commitment = mapMembershipToCommitment(ba, memberships, getCurrentPeriod({ m1: { from: "2026-01-01", to: "2026-01-01" } }));
  assert.equal(commitment, null);
});

test("mapMembershipToCommitment: an account with no derivable period at all is skipped, not crashed on", () => {
  const ba = { id: "ba1", name: "Empty gym", type: "Gym / Fitness" };
  assert.equal(mapMembershipToCommitment(ba, [], () => null), null);
});

test("mapMembershipToCommitment: the latest-ending period across several payments wins, not an older superseded one", () => {
  const ba = { id: "ba1", name: "Club", type: "Club Membership" };
  const memberships = [{ id: "m1", billerAccountId: "ba1", amount: 1000 }, { id: "m2", billerAccountId: "ba1", amount: 1200 }];
  const periods = { m1: { from: "2026-01-01", to: "2026-03-31" }, m2: { from: "2026-04-01", to: "2026-06-30" } };
  const commitment = mapMembershipToCommitment(ba, memberships, getCurrentPeriod(periods));
  assert.equal(commitment.date, "2026-06-30");
  assert.equal(commitment.amount, 1200);
});

test("projectMembershipsToCommitments: silently drops non-membership types and accounts with no period", () => {
  const billerAccounts = [
    { id: "ba1", name: "Gym", type: "Gym / Fitness" },
    { id: "ba2", name: "Electricity", type: "Electricity" },
  ];
  const memberships = [{ id: "m1", billerAccountId: "ba1", amount: 500 }];
  const items = projectMembershipsToCommitments(billerAccounts, memberships, getCurrentPeriod({ m1: { from: "2026-01-01", to: "2026-12-31" } }));
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceId, "ba1");
});
