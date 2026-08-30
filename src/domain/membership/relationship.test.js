import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMembershipRelationship,
  pauseRelationship,
  resumeRelationship,
  endRelationship,
  getRelationshipStatusAsOfDate,
  isDateActiveMembershipCoverage,
  migrateMembershipRelationships,
} from "./relationship.js";

let counter = 0;
const genId = () => `rel_${++counter}`;

test("createMembershipRelationship starts active with a real history entry", () => {
  const r = createMembershipRelationship({ billerAccountId: "ba1", personId: "self", startDate: "2026-01-01", genId });
  assert.equal(r.status, "active");
  assert.equal(r.billerAccountId, "ba1");
  assert.equal(r.personId, "self");
  assert.equal(r.statusHistory.length, 1);
  assert.equal(r.statusHistory[0].status, "active");
  assert.equal(r.statusHistory[0].effectiveDate, "2026-01-01");
});

test("requires genId, billerAccountId, personId, startDate", () => {
  assert.throws(() => createMembershipRelationship({ billerAccountId: "ba1", personId: "self", startDate: "2026-01-01" }), /genId/);
  assert.throws(() => createMembershipRelationship({ personId: "self", startDate: "2026-01-01", genId }), /billerAccountId/);
  assert.throws(() => createMembershipRelationship({ billerAccountId: "ba1", startDate: "2026-01-01", genId }), /personId/);
  assert.throws(() => createMembershipRelationship({ billerAccountId: "ba1", personId: "self", genId }), /startDate/);
});

test("pause/resume/end on the relationship compose lifecycle.js unmodified", () => {
  let r = createMembershipRelationship({ billerAccountId: "ba1", personId: "self", startDate: "2026-01-01", genId });
  r = pauseRelationship(r, "Traveling", "2026-06-01");
  assert.equal(r.status, "paused");
  r = resumeRelationship(r, "2026-07-01");
  assert.equal(r.status, "active");
  r = endRelationship(r, "Cancelled", "2026-08-01");
  assert.equal(r.status, "ended");
  assert.equal(r.statusHistory.length, 4);
});

test("getRelationshipStatusAsOfDate returns null for a date before any history", () => {
  const r = createMembershipRelationship({ billerAccountId: "ba1", personId: "self", startDate: "2026-06-01", genId });
  assert.equal(getRelationshipStatusAsOfDate(r.statusHistory, "2026-01-01"), null);
});

test("getRelationshipStatusAsOfDate returns the status effective on that date, not the latest overall", () => {
  let r = createMembershipRelationship({ billerAccountId: "ba1", personId: "self", startDate: "2026-01-01", genId });
  r = pauseRelationship(r, "reason", "2026-06-01");
  r = resumeRelationship(r, "2026-07-01");
  assert.equal(getRelationshipStatusAsOfDate(r.statusHistory, "2026-03-01"), "active"); // before pause
  assert.equal(getRelationshipStatusAsOfDate(r.statusHistory, "2026-06-15"), "paused"); // during pause window
  assert.equal(getRelationshipStatusAsOfDate(r.statusHistory, "2026-08-01"), "active"); // after resume
});

test("isDateActiveMembershipCoverage matches getRelationshipStatusAsOfDate", () => {
  let r = createMembershipRelationship({ billerAccountId: "ba1", personId: "self", startDate: "2026-01-01", genId });
  r = pauseRelationship(r, "reason", "2026-06-01");
  assert.equal(isDateActiveMembershipCoverage("2026-03-01", r.statusHistory), true);
  assert.equal(isDateActiveMembershipCoverage("2026-06-15", r.statusHistory), false);
});

// --- migration ------------------------------------------------------------

const fakeGetMembershipPeriods = (m) => m.periods || [];

test("migration creates exactly one relationship per (billerAccountId, personId) pair", () => {
  const memberships = [
    { id: "p1", billerAccountId: "ba1", personId: "self", periods: [{ from: "2026-01-01", to: "2026-01-31" }] },
    { id: "p2", billerAccountId: "ba1", personId: "self", periods: [{ from: "2026-02-01", to: "2026-02-28" }] },
    { id: "p3", billerAccountId: "ba2", personId: "self", periods: [{ from: "2026-01-15", to: "2026-02-14" }] },
  ];
  const { relationships, updatedMemberships } = migrateMembershipRelationships(memberships, [], fakeGetMembershipPeriods, genId);
  assert.equal(relationships.length, 2); // ba1/self and ba2/self — not 3, since p1 and p2 share a pair
  const ba1Rel = relationships.find(r => r.billerAccountId === "ba1");
  assert.equal(updatedMemberships.find(m => m.id === "p1").membershipRelationshipId, ba1Rel.id);
  assert.equal(updatedMemberships.find(m => m.id === "p2").membershipRelationshipId, ba1Rel.id);
});

test("migration uses the EARLIEST known coverage start as effectiveDate — not fabricated", () => {
  const memberships = [
    { id: "p1", billerAccountId: "ba1", personId: "self", periods: [{ from: "2026-03-01", to: "2026-03-31" }] },
    { id: "p2", billerAccountId: "ba1", personId: "self", periods: [{ from: "2026-01-01", to: "2026-01-31" }] }, // earlier, out of order in the array
  ];
  const { relationships } = migrateMembershipRelationships(memberships, [], fakeGetMembershipPeriods, genId);
  assert.equal(relationships[0].statusHistory[0].effectiveDate, "2026-01-01");
});

test("migration never invents a pause/resume/end event — exactly one history entry", () => {
  const memberships = [{ id: "p1", billerAccountId: "ba1", personId: "self", periods: [{ from: "2026-01-01", to: "2026-01-31" }] }];
  const { relationships } = migrateMembershipRelationships(memberships, [], fakeGetMembershipPeriods, genId);
  assert.equal(relationships[0].statusHistory.length, 1);
  assert.equal(relationships[0].statusHistory[0].status, "active");
});

test("migration is idempotent — running twice does not duplicate relationships", () => {
  const memberships = [{ id: "p1", billerAccountId: "ba1", personId: "self", periods: [{ from: "2026-01-01", to: "2026-01-31" }] }];
  const first = migrateMembershipRelationships(memberships, [], fakeGetMembershipPeriods, genId);
  const second = migrateMembershipRelationships(first.updatedMemberships, first.relationships, fakeGetMembershipPeriods, genId);
  assert.equal(second.relationships.length, 1);
  assert.deepEqual(second.updatedMemberships, first.updatedMemberships);
});

test("migration leaves a payment record unlinked (not fabricated) if it has no derivable date", () => {
  const memberships = [{ id: "p1", billerAccountId: "ba1", personId: "self", periods: [] }];
  const { relationships, updatedMemberships } = migrateMembershipRelationships(memberships, [], fakeGetMembershipPeriods, genId);
  assert.equal(relationships.length, 0);
  assert.equal(updatedMemberships[0].membershipRelationshipId, undefined);
});

test("migration defaults personId to 'self' when missing on the payment record", () => {
  const memberships = [{ id: "p1", billerAccountId: "ba1", periods: [{ from: "2026-01-01", to: "2026-01-31" }] }];
  const { relationships } = migrateMembershipRelationships(memberships, [], fakeGetMembershipPeriods, genId);
  assert.equal(relationships[0].personId, "self");
});

test("migration never mutates the input arrays", () => {
  const memberships = [{ id: "p1", billerAccountId: "ba1", personId: "self", periods: [{ from: "2026-01-01", to: "2026-01-31" }] }];
  const before = JSON.stringify(memberships);
  migrateMembershipRelationships(memberships, [], fakeGetMembershipPeriods, genId);
  assert.equal(JSON.stringify(memberships), before);
});

test("requires genId", () => {
  assert.throws(() => migrateMembershipRelationships([], [], fakeGetMembershipPeriods), /genId/);
});
