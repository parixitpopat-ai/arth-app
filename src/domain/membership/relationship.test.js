import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMembershipRelationship,
  migrateMembershipRelationships,
  correctSelfSentinel,
  getRelationshipStatusAsOfDate,
  isDateActiveMembershipCoverage,
} from "./relationship.js";
import {
  getRelationshipStatusAsOfDate as getRelationshipStatusAsOfDateFromLifecycle,
  isDateActiveMembershipCoverage as isDateActiveMembershipCoverageFromLifecycle,
} from "./lifecycle.js";

let idCounter = 0;
const genId = () => `rel_${++idCounter}`;

// --- WP-A1: migration fallback no longer produces "self" -----------------

test("migrateMembershipRelationships falls back to the real self-sentinel __me__, not the literal string 'self'", () => {
  const memberships = [
    { billerAccountId: "ba1", from: "2026-01-01", to: "2026-01-31" }, // no personId at all
  ];
  const getMembershipPeriods = (m) => [{ from: m.from, to: m.to }];

  const { relationships, updatedMemberships } = migrateMembershipRelationships(
    memberships, [], getMembershipPeriods, genId
  );

  assert.equal(relationships.length, 1);
  assert.equal(relationships[0].personId, "__me__");
  assert.notEqual(relationships[0].personId, "self");
  assert.equal(updatedMemberships[0].membershipRelationshipId, relationships[0].id);
});

test("a membership record with an explicit real personId is never touched by the sentinel fallback", () => {
  const memberships = [
    { billerAccountId: "ba1", personId: "person_abc", from: "2026-01-01", to: "2026-01-31" },
  ];
  const getMembershipPeriods = (m) => [{ from: m.from, to: m.to }];
  const { relationships } = migrateMembershipRelationships(memberships, [], getMembershipPeriods, genId);
  assert.equal(relationships[0].personId, "person_abc");
});

test("resolves getPerson-style lookup correctly post-migration (__me__ is a resolvable id, 'self' would not be)", () => {
  // Simulates the real app's getPerson fallback shape without importing App.jsx.
  const people = [{ id: "__me__", name: "Me", isMe: true }];
  const getPerson = (id) => people.find(p => p.id === id) || { name: "?" };

  const memberships = [{ billerAccountId: "ba1", from: "2026-01-01", to: "2026-01-31" }];
  const getMembershipPeriods = (m) => [{ from: m.from, to: m.to }];
  const { relationships } = migrateMembershipRelationships(memberships, [], getMembershipPeriods, genId);

  const resolved = getPerson(relationships[0].personId);
  assert.equal(resolved.name, "Me"); // not "?"
});

// --- WP-A1: correctSelfSentinel — the one-time correction pass -----------

test("correctSelfSentinel replaces literal 'self' with '__me__', nothing else", () => {
  const relationships = [
    { id: "r1", billerAccountId: "ba1", personId: "self", status: "active" },
  ];
  const corrected = correctSelfSentinel(relationships);
  assert.equal(corrected[0].personId, "__me__");
  assert.equal(corrected[0].id, "r1");
  assert.equal(corrected[0].billerAccountId, "ba1");
  assert.equal(corrected[0].status, "active");
});

test("correctSelfSentinel leaves already-correct records completely untouched (same reference)", () => {
  const already = { id: "r2", billerAccountId: "ba1", personId: "__me__", status: "active" };
  const other = { id: "r3", billerAccountId: "ba1", personId: "person_xyz", status: "active" };
  const relationships = [already, other];
  const corrected = correctSelfSentinel(relationships);
  assert.equal(corrected[0], already); // exact same reference, not even a new object
  assert.equal(corrected[1], other);
});

test("correctSelfSentinel is idempotent — running it twice produces the same output", () => {
  const relationships = [{ id: "r1", personId: "self" }];
  const once = correctSelfSentinel(relationships);
  const twice = correctSelfSentinel(once);
  assert.deepEqual(once, twice);
  assert.equal(twice[0].personId, "__me__");
});

test("correctSelfSentinel handles an empty or missing array without throwing", () => {
  assert.deepEqual(correctSelfSentinel([]), []);
  assert.deepEqual(correctSelfSentinel(undefined), []);
});

test("correctSelfSentinel never mutates the input array or its objects", () => {
  const relationships = [{ id: "r1", personId: "self" }];
  const snapshot = JSON.parse(JSON.stringify(relationships));
  correctSelfSentinel(relationships);
  assert.deepEqual(relationships, snapshot);
});

// --- Regression: createMembershipRelationship's own direct-create path was never buggy ---

test("createMembershipRelationship (direct, non-migration path) was never affected — confirms the bug was migration-only", () => {
  const rel = createMembershipRelationship({
    billerAccountId: "ba1", personId: "__me__", startDate: "2026-01-01", genId,
  });
  assert.equal(rel.personId, "__me__");
});

// --- WP-C1 Step 1 (approved, option b): getRelationshipStatusAsOfDate and
// isDateActiveMembershipCoverage now live in lifecycle.js. These tests
// prove requirements 2 and 3 from the approval: existing imports through
// relationship.js keep working (backward-compat re-export), and the moved
// functions behave identically to how they behaved before the move.
// Requirement 1 (existing Membership behavior unchanged) and requirement 4
// (lifecycle.js stays domain-neutral) are covered in
// lifecycle-genericity.test.js, since they concern lifecycle.js's own
// pause/resume/end behavior and cross-domain neutrality, not relationship.js.

test("WP-C1 req 2: existing imports continue working through relationship.js — the re-export is real, not a stub", () => {
  // App.jsx's real import is: `import { ..., isDateActiveMembershipCoverage, ... }
  // from "./domain/membership/relationship"` — this test proves that exact
  // import path still resolves to a working function post-move.
  const statusHistory = [{ status: "active", effectiveDate: "2026-01-01", timestamp: 1 }];
  assert.equal(isDateActiveMembershipCoverage("2026-06-01", statusHistory), true);
  assert.equal(getRelationshipStatusAsOfDate(statusHistory, "2026-06-01"), "active");
});

test("WP-C1 req 3: the re-exported functions ARE the lifecycle.js functions — same reference, not a reimplementation that could drift", () => {
  // Strict reference equality, not just behavioral equality — proves
  // relationship.js is genuinely re-exporting, not duplicating.
  assert.equal(getRelationshipStatusAsOfDate, getRelationshipStatusAsOfDateFromLifecycle);
  assert.equal(isDateActiveMembershipCoverage, isDateActiveMembershipCoverageFromLifecycle);
});

test("WP-C1 req 3: behavior is identical to the pre-move implementation across the same scenarios the original relationship.js logic covered", () => {
  const statusHistory = [
    { status: "active", effectiveDate: "2026-01-01", timestamp: 1 },
    { status: "paused", effectiveDate: "2026-03-01", timestamp: 2 },
    { status: "active", effectiveDate: "2026-04-01", timestamp: 3 },
  ];
  // Before the pause.
  assert.equal(getRelationshipStatusAsOfDate(statusHistory, "2026-02-01"), "active");
  assert.equal(isDateActiveMembershipCoverage("2026-02-01", statusHistory), true);
  // During the pause.
  assert.equal(getRelationshipStatusAsOfDate(statusHistory, "2026-03-15"), "paused");
  assert.equal(isDateActiveMembershipCoverage("2026-03-15", statusHistory), false);
  // After resuming.
  assert.equal(getRelationshipStatusAsOfDate(statusHistory, "2026-05-01"), "active");
  assert.equal(isDateActiveMembershipCoverage("2026-05-01", statusHistory), true);
  // Before the relationship existed at all.
  assert.equal(getRelationshipStatusAsOfDate(statusHistory, "2025-01-01"), null);
  assert.equal(isDateActiveMembershipCoverage("2025-01-01", statusHistory), false);
});
