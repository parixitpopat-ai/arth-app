import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMembershipRelationship,
  migrateMembershipRelationships,
  correctSelfSentinel,
  getRelationshipStatusAsOfDate,
  isDateActiveMembershipCoverage,
  createRelationship,
  getRelationshipTarget,
  migrateBillerAccountAttributions,
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

// --- Arth 2.0 IA: the canonical, generalized Financial Relationship ------

test("createRelationship builds a person relationship with personId mirrored for legacy readers", () => {
  const r = createRelationship({ billerAccountId: "ba1", targetType: "person", targetId: "p1", startDate: "2026-01-01", genId });
  assert.equal(r.billerAccountId, "ba1");
  assert.equal(r.targetType, "person");
  assert.equal(r.targetId, "p1");
  assert.equal(r.personId, "p1");
  assert.equal(r.status, "active");
  assert.equal(r.statusHistory.length, 1);
});

test("createRelationship builds a group relationship with personId left null (never a fabricated group-as-person id)", () => {
  const r = createRelationship({ billerAccountId: "ba1", targetType: "group", targetId: "g1", startDate: "2026-01-01", genId });
  assert.equal(r.targetType, "group");
  assert.equal(r.targetId, "g1");
  assert.equal(r.personId, null);
});

test("createRelationship rejects a bad targetType rather than silently defaulting", () => {
  assert.throws(() => createRelationship({ billerAccountId: "ba1", targetType: "vehicle", targetId: "v1", startDate: "2026-01-01", genId }));
});

test("createMembershipRelationship still throws its own message when personId is missing (unchanged external behavior)", () => {
  assert.throws(() => createMembershipRelationship({ billerAccountId: "ba1", startDate: "2026-01-01", genId }), /personId is required/);
});

test("getRelationshipTarget reads a generalized row directly, and a pre-generalization row (personId only) as targetType person", () => {
  assert.deepEqual(getRelationshipTarget({ targetType: "group", targetId: "g1", personId: null }), { targetType: "group", targetId: "g1" });
  assert.deepEqual(getRelationshipTarget({ personId: "p1" }), { targetType: "person", targetId: "p1" });
});

test("migrateBillerAccountAttributions creates one active relationship per attributed billerAccount, house/vehicle/unset skipped", () => {
  const billerAccounts = [
    { id: "ba1", attributeType: "person", attributedTo: "p1", createdAt: Date.UTC(2026, 0, 15) },
    { id: "ba2", attributeType: "group", attributedTo: "g1", createdAt: Date.UTC(2026, 1, 1) },
    { id: "ba3", attributeType: "house", attributedTo: "" },
    { id: "ba4", attributeType: "person", attributedTo: "" }, // no real target — skipped
  ];
  const result = migrateBillerAccountAttributions(billerAccounts, [], genId);
  assert.equal(result.length, 2);
  const forBa1 = result.find(r => r.billerAccountId === "ba1");
  assert.equal(forBa1.targetType, "person");
  assert.equal(forBa1.targetId, "p1");
  assert.equal(forBa1.status, "active");
  const forBa2 = result.find(r => r.billerAccountId === "ba2");
  assert.equal(forBa2.targetType, "group");
  assert.equal(forBa2.targetId, "g1");
});

test("migrateBillerAccountAttributions is idempotent and non-destructive: a pair with an existing relationship (any row generation) is skipped, existing rows are never rewritten", () => {
  const billerAccounts = [{ id: "ba1", attributeType: "person", attributedTo: "p1", createdAt: 1 }];
  const legacyRow = { id: "existing", billerAccountId: "ba1", personId: "p1", status: "paused", statusHistory: [] };
  const result = migrateBillerAccountAttributions(billerAccounts, [legacyRow], genId);
  assert.equal(result.length, 1);
  assert.equal(result[0], legacyRow, "the existing row is the exact same reference — never rewritten");
});

test("migrateBillerAccountAttributions returns the same array reference when nothing needs migrating", () => {
  const billerAccounts = [{ id: "ba1", attributeType: "person", attributedTo: "p1" }];
  const existing = [{ billerAccountId: "ba1", personId: "p1", status: "active" }];
  const result = migrateBillerAccountAttributions(billerAccounts, existing, genId);
  assert.equal(result, existing);
});

test("migrateBillerAccountAttributions running twice never doubles up", () => {
  const billerAccounts = [{ id: "ba1", attributeType: "person", attributedTo: "p1", createdAt: 1 }];
  const once = migrateBillerAccountAttributions(billerAccounts, [], genId);
  const twice = migrateBillerAccountAttributions(billerAccounts, once, genId);
  assert.equal(twice, once);
  assert.equal(once.length, 1);
});
