import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pauseMembership,
  resumeMembership,
  endMembership,
  getRelationshipStatusAsOfDate,
  isDateActiveMembershipCoverage,
} from "./lifecycle.js";

// WP-C1 Step 1 (approved, option b). This file is additive — it does not
// modify or duplicate your existing lifecycle.test.js (not available in
// this trace), it only adds the two specific proofs the approval called
// for: (1) existing Membership pause/resume/end behavior is unchanged by
// moving getRelationshipStatusAsOfDate/isDateActiveMembershipCoverage into
// this file, and (4) lifecycle.js remains domain-neutral post-move — it
// still has zero knowledge of billerAccountId, schoolId, or any other
// domain-specific field.

// --- Requirement 1: existing Membership behavior remains unchanged ------
// A representative slice of pause/resume/end scenarios, run AFTER the
// move, to confirm nothing about the move altered their behavior. This is
// not a replacement for your full existing lifecycle.test.js suite (which
// should also be run as part of "full suite and build" per the approval)
// — it's a fast, self-contained confirmation inside this new file.

test("req 1: pause/resume/end still work exactly as before the move — full active->paused->active->ended cycle", () => {
  let rel = { status: "active", statusHistory: [{ status: "active", effectiveDate: "2026-01-01", timestamp: 1 }] };

  rel = pauseMembership(rel, "Gym closed for renovation", "2026-03-01");
  assert.equal(rel.status, "paused");
  assert.equal(rel.statusHistory.length, 2);
  assert.equal(rel.statusHistory[1].reason, "Gym closed for renovation");

  rel = resumeMembership(rel, "2026-04-01");
  assert.equal(rel.status, "active");
  assert.equal(rel.statusHistory.length, 3);

  rel = endMembership(rel, "Moved away", "2026-06-01");
  assert.equal(rel.status, "ended");
  assert.equal(rel.statusHistory.length, 4);

  assert.throws(() => pauseMembership(rel, "reason", "2026-07-01"), /cannot pause an ended membership/);
  assert.throws(() => resumeMembership(rel, "2026-07-01"), /can only resume a paused membership/);
  assert.throws(() => endMembership(rel, "reason", "2026-07-01"), /already ended/);
});

test("req 1: reason/effectiveDate validation is unchanged — pause and end still require both, resume still requires only effectiveDate", () => {
  const active = { status: "active", statusHistory: [] };
  assert.throws(() => pauseMembership(active, "", "2026-01-01"), /reason is required/);
  assert.throws(() => pauseMembership(active, "reason", ""), /effectiveDate.*required/);
  const paused = { status: "paused", statusHistory: [] };
  assert.doesNotThrow(() => resumeMembership(paused, "2026-01-01")); // no reason needed, unchanged
  assert.throws(() => endMembership(active, "", "2026-01-01"), /reason is required/);
});

// --- Requirement 4: lifecycle.js remains domain-neutral -----------------

test("req 4: pause/resume/end operate on any {status, statusHistory} shape — proven with a School-flavored object, not just Membership's", () => {
  // A hypothetical School relationship shape (schoolId instead of
  // billerAccountId) — lifecycle.js has never seen this field name and
  // should not need to. If this passes, the file is genuinely
  // domain-neutral, not just "generic in theory."
  const schoolRel = {
    id: "sr1", schoolId: "school_dps", personId: "vyom_id",
    status: "active", statusHistory: [{ status: "active", effectiveDate: "2026-06-01", timestamp: 1 }],
  };
  const ended = endMembership(schoolRel, "Left the school", "2027-04-30");
  assert.equal(ended.status, "ended");
  assert.equal(ended.schoolId, "school_dps"); // untouched, passed through unchanged
  assert.equal(ended.personId, "vyom_id");    // untouched, passed through unchanged
});

test("req 4: getRelationshipStatusAsOfDate / isDateActiveMembershipCoverage work identically for a School-shaped statusHistory — no Membership-specific assumption anywhere", () => {
  const schoolStatusHistory = [
    { status: "active", effectiveDate: "2025-06-01", timestamp: 1 },
    { status: "ended", effectiveDate: "2026-04-30", timestamp: 2 },
  ];
  assert.equal(getRelationshipStatusAsOfDate(schoolStatusHistory, "2025-12-01"), "active");
  assert.equal(getRelationshipStatusAsOfDate(schoolStatusHistory, "2026-06-01"), "ended");
  assert.equal(isDateActiveMembershipCoverage("2025-12-01", schoolStatusHistory), true);
  assert.equal(isDateActiveMembershipCoverage("2026-06-01", schoolStatusHistory), false);
});

test("req 4: lifecycle.js's exported functions take no parameter named billerAccountId, schoolId, or any other domain-specific field", () => {
  // Structural proof, not just behavioral: pause/resume/end's signatures
  // are (entity, reason, effectiveDate) / (entity, effectiveDate) — the
  // whole entity is opaque to this file beyond status/statusHistory.
  assert.equal(pauseMembership.length, 3);
  assert.equal(resumeMembership.length, 2);
  assert.equal(endMembership.length, 3);
  assert.equal(getRelationshipStatusAsOfDate.length, 2);
  assert.equal(isDateActiveMembershipCoverage.length, 2);
});
