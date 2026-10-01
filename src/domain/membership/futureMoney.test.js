import { test } from "node:test";
import assert from "node:assert/strict";
import { mapMembershipToCommitment, projectMembershipsToCommitments, hasLiveMembershipRelationship } from "./futureMoney.js";

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

// Lifecycle gate (locked product decision): Active may project, Paused/Ended may not.
const period90 = { from: "2026-06-30", to: "2026-12-27", graceDays: 0 };
const gymBA = { id: "ba1", name: "Genesis Gym", type: "Gym / Fitness" };
const gymMemberships = [{ id: "m1", billerAccountId: "ba1", amount: 8499 }];
const gymPeriod = getCurrentPeriod({ m1: period90 });

test("mapMembershipToCommitment: an Active relationship still projects", () => {
  const relationships = [{ id: "r1", billerAccountId: "ba1", status: "active" }];
  const commitment = mapMembershipToCommitment(gymBA, gymMemberships, gymPeriod, relationships);
  assert.equal(commitment.amount, 8499);
});

test("mapMembershipToCommitment: a Paused relationship projects nothing", () => {
  const relationships = [{ id: "r1", billerAccountId: "ba1", status: "paused" }];
  assert.equal(mapMembershipToCommitment(gymBA, gymMemberships, gymPeriod, relationships), null);
});

test("mapMembershipToCommitment: an Ended relationship projects nothing", () => {
  const relationships = [{ id: "r1", billerAccountId: "ba1", status: "ended" }];
  assert.equal(mapMembershipToCommitment(gymBA, gymMemberships, gymPeriod, relationships), null);
});

test("mapMembershipToCommitment: a biller account with no relationship record at all is left ungated (legacy behavior)", () => {
  const commitment = mapMembershipToCommitment(gymBA, gymMemberships, gymPeriod, []);
  assert.equal(commitment.amount, 8499);
  // omitting the argument entirely must behave identically
  const commitmentOmitted = mapMembershipToCommitment(gymBA, gymMemberships, gymPeriod);
  assert.equal(commitmentOmitted.amount, 8499);
});

test("mapMembershipToCommitment: a biller account with multiple relationships projects if ANY is active", () => {
  const relationships = [
    { id: "r1", billerAccountId: "ba1", status: "ended" },
    { id: "r2", billerAccountId: "ba1", status: "active" },
  ];
  const commitment = mapMembershipToCommitment(gymBA, gymMemberships, gymPeriod, relationships);
  assert.equal(commitment.amount, 8499);
});

test("mapMembershipToCommitment: a relationship for a DIFFERENT biller account does not gate this one", () => {
  const relationships = [{ id: "r1", billerAccountId: "some-other-account", status: "paused" }];
  const commitment = mapMembershipToCommitment(gymBA, gymMemberships, gymPeriod, relationships);
  assert.equal(commitment.amount, 8499);
});

test("projectMembershipsToCommitments: a paused account is dropped, an active sibling is kept", () => {
  const billerAccounts = [
    { id: "ba1", name: "Paused Gym", type: "Gym / Fitness" },
    { id: "ba2", name: "Active Club", type: "Club Membership" },
  ];
  const memberships = [
    { id: "m1", billerAccountId: "ba1", amount: 500 },
    { id: "m2", billerAccountId: "ba2", amount: 700 },
  ];
  const relationships = [
    { id: "r1", billerAccountId: "ba1", status: "paused" },
    { id: "r2", billerAccountId: "ba2", status: "active" },
  ];
  const period = { from: "2026-01-01", to: "2026-12-31" };
  const items = projectMembershipsToCommitments(billerAccounts, memberships, getCurrentPeriod({ m1: period, m2: period }), relationships);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceId, "ba2");
});

// WP15 (Membership Regression Audit) — the lifecycle gate must apply identically to all five
// non-School membership types this app supports, not just Gym/Club (the two already covered
// above). The gate function itself is type-agnostic (it only ever sees a billerAccountId), but
// this confirms the real type strings this app uses don't accidentally fall outside
// NON_SCHOOL_MEMBERSHIP_TYPES and slip past the gate unfiltered.
for (const type of ["Gym / Fitness", "Club Membership", "Society Maintenance", "Rental", "Other Subscription"]) {
  test(`mapMembershipToCommitment: Paused suppresses projection for type "${type}"`, () => {
    const ba = { id: "baX", name: "Test", type };
    const memberships = [{ id: "mX", billerAccountId: "baX", amount: 1000 }];
    const relationships = [{ id: "rX", billerAccountId: "baX", status: "paused" }];
    assert.equal(mapMembershipToCommitment(ba, memberships, gymPeriod, relationships), null);
  });
}

test("Resume: a relationship that was Paused then Resumed (status flips back to active) projects again", () => {
  // Mirrors the real lifecycle.js transition sequence (pause -> resume), not a separate concept —
  // resumeMembership's only observable effect on this gate is status:"paused" -> status:"active".
  const pausedThenResumed = [{ id: "r1", billerAccountId: "ba1", status: "active", statusHistory: [
    { status: "active", effectiveDate: "2026-01-01" },
    { status: "paused", effectiveDate: "2026-05-01" },
    { status: "active", effectiveDate: "2026-06-01" },
  ] }];
  const commitment = mapMembershipToCommitment(gymBA, gymMemberships, gymPeriod, pausedThenResumed);
  assert.equal(commitment.amount, 8499);
});

test("hasLiveMembershipRelationship: direct checks (exported for reuse by renewalReminders.js, same gate everywhere)", () => {
  assert.equal(hasLiveMembershipRelationship("ba1", []), true, "no relationship at all is ungated");
  assert.equal(hasLiveMembershipRelationship("ba1", undefined), true, "omitted is ungated");
  assert.equal(hasLiveMembershipRelationship("ba1", [{ billerAccountId: "ba1", status: "active" }]), true);
  assert.equal(hasLiveMembershipRelationship("ba1", [{ billerAccountId: "ba1", status: "paused" }]), false);
  assert.equal(hasLiveMembershipRelationship("ba1", [{ billerAccountId: "ba1", status: "ended" }]), false);
});
