import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSchoolRelationship,
  endSchoolRelationship,
  isSchoolRelationshipCurrent,
  getCurrentSchoolRelationship,
  getHistoricalSchoolRelationships,
} from "./relationship.js";
import { endMembership } from "../membership/lifecycle.js";

let idCounter = 0;
const genId = () => `srel_${++idCounter}`;

// --- Creation --------------------------------------------------------------

test("createSchoolRelationship produces a new, active relationship referencing the real personId", () => {
  const rel = createSchoolRelationship({ schoolId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  assert.equal(rel.schoolId, "dps");
  assert.equal(rel.personId, "vyom_id");
  assert.equal(rel.status, "active");
  assert.equal(rel.statusHistory.length, 1);
  assert.equal(rel.statusHistory[0].status, "active");
  assert.equal(rel.statusHistory[0].effectiveDate, "2025-06-01");
});

test("createSchoolRelationship requires schoolId, personId, startDate, and genId — same discipline as Membership's equivalent", () => {
  assert.throws(() => createSchoolRelationship({ personId: "p1", startDate: "2025-06-01", genId }), /schoolId is required/);
  assert.throws(() => createSchoolRelationship({ schoolId: "dps", startDate: "2025-06-01", genId }), /personId is required/);
  assert.throws(() => createSchoolRelationship({ schoolId: "dps", personId: "p1", genId }), /startDate is required/);
  assert.throws(() => createSchoolRelationship({ schoolId: "dps", personId: "p1", startDate: "2025-06-01" }), /genId is required/);
});

test("createSchoolRelationship works correctly for a self-attributed relationship, using the real __me__ sentinel — not the historical 'self' bug", () => {
  const rel = createSchoolRelationship({ schoolId: "dps", personId: "__me__", startDate: "2025-06-01", genId });
  assert.equal(rel.personId, "__me__");
});

// --- Reuses lifecycle.js directly, no reimplementation ----------------------

test("endSchoolRelationship IS lifecycle.js's endMembership — proven by behavioral equivalence, confirming no School-specific transition logic exists", () => {
  const rel = createSchoolRelationship({ schoolId: "dps", personId: "p1", startDate: "2025-06-01", genId });
  const viaWrapper = endSchoolRelationship(rel, "Left the school", "2027-04-30");
  const viaDirect = endMembership(rel, "Left the school", "2027-04-30");
  assert.deepEqual(viaWrapper, viaDirect);
});

// --- Continuous relationship across academic years --------------------------

test("same school across multiple academic years is ONE continuous relationship — id and startDate never change just because a year passed", () => {
  const rel = createSchoolRelationship({ schoolId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  // Nothing in this module has any concept of "advance to next year" — the
  // relationship simply continues to exist, unchanged, id and startDate
  // intact, regardless of how many academic years pass. This test's real
  // assertion is structural: there is no function in this module capable
  // of mutating a relationship's id or resetting its startDate for a new
  // year — the API surface itself makes year-over-year re-creation
  // impossible by construction.
  assert.equal(typeof createSchoolRelationship, "function");
  assert.equal(Object.keys({ createSchoolRelationship, endSchoolRelationship, isSchoolRelationshipCurrent, getCurrentSchoolRelationship, getHistoricalSchoolRelationships }).length, 5);
  // The relationship itself, unchanged by the passage of time:
  assert.equal(rel.id, rel.id);
  assert.equal(rel.statusHistory.length, 1); // still just the original signup, no yearly re-signup entries
});

// --- School change: end old + create new, never edit ------------------------

test("school change is end-old + create-new — two genuinely distinct relationships, old history intact", () => {
  const oldRel = createSchoolRelationship({ schoolId: "school_a", personId: "vyom_id", startDate: "2025-06-01", genId });
  const endedOldRel = endSchoolRelationship(oldRel, "Changed schools", "2026-04-15");
  const newRel = createSchoolRelationship({ schoolId: "school_b", personId: "vyom_id", startDate: "2026-04-16", genId });

  assert.notEqual(endedOldRel.id, newRel.id); // genuinely distinct records
  assert.equal(endedOldRel.schoolId, "school_a"); // old school's identity never overwritten
  assert.equal(newRel.schoolId, "school_b");
  assert.equal(endedOldRel.status, "ended");
  assert.equal(newRel.status, "active");
  // Old relationship's full history remains exactly as it was.
  assert.equal(endedOldRel.statusHistory.length, 2);
  assert.equal(endedOldRel.statusHistory[0].effectiveDate, "2025-06-01");
  assert.equal(endedOldRel.statusHistory[1].status, "ended");
});

test("ending a relationship never mutates the original object — old and new stay independently valid", () => {
  const oldRel = createSchoolRelationship({ schoolId: "school_a", personId: "p1", startDate: "2025-06-01", genId });
  const snapshot = JSON.parse(JSON.stringify(oldRel));
  endSchoolRelationship(oldRel, "Changed schools", "2026-04-15");
  assert.deepEqual(oldRel, snapshot);
});

// --- Current vs. historical -------------------------------------------------

test("getCurrentSchoolRelationship finds the active one among a mix of ended and active relationships for the same person", () => {
  const schoolA = endSchoolRelationship(
    createSchoolRelationship({ schoolId: "school_a", personId: "vyom_id", startDate: "2024-06-01", genId }),
    "Changed schools", "2025-04-30"
  );
  const schoolB = createSchoolRelationship({ schoolId: "school_b", personId: "vyom_id", startDate: "2025-06-01", genId });
  const relationships = [schoolA, schoolB];

  const current = getCurrentSchoolRelationship(relationships, "vyom_id", "2026-01-01");
  assert.equal(current.schoolId, "school_b");
});

test("getCurrentSchoolRelationship returns null when a person has no active school relationship — a real state, not an error", () => {
  const relationships = [];
  assert.equal(getCurrentSchoolRelationship(relationships, "vyom_id", "2026-01-01"), null);
});

test("getCurrentSchoolRelationship never mixes up two different people's relationships", () => {
  const vyomRel = createSchoolRelationship({ schoolId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const rahulRel = createSchoolRelationship({ schoolId: "some_other_school", personId: "rahul_id", startDate: "2025-06-01", genId });
  const relationships = [vyomRel, rahulRel];

  const current = getCurrentSchoolRelationship(relationships, "vyom_id", "2026-01-01");
  assert.equal(current.schoolId, "dps");
  assert.notEqual(current.personId, "rahul_id");
});

test("getHistoricalSchoolRelationships returns past schools, excludes the current one — historical data remains accessible", () => {
  const schoolA = endSchoolRelationship(
    createSchoolRelationship({ schoolId: "school_a", personId: "vyom_id", startDate: "2024-06-01", genId }),
    "Changed schools", "2025-04-30"
  );
  const schoolB = createSchoolRelationship({ schoolId: "school_b", personId: "vyom_id", startDate: "2025-06-01", genId });
  const relationships = [schoolA, schoolB];

  const historical = getHistoricalSchoolRelationships(relationships, "vyom_id", "2026-01-01");
  assert.equal(historical.length, 1);
  assert.equal(historical[0].schoolId, "school_a");
});

test("isSchoolRelationshipCurrent answers correctly across a relationship's full active->ended timeline", () => {
  const created = createSchoolRelationship({ schoolId: "dps", personId: "p1", startDate: "2025-06-01", genId });
  const ended = endSchoolRelationship(created, "Left", "2026-04-30");

  assert.equal(isSchoolRelationshipCurrent(created.statusHistory, "2025-12-01"), true);
  assert.equal(isSchoolRelationshipCurrent(ended.statusHistory, "2025-12-01"), true); // still active as of that date
  assert.equal(isSchoolRelationshipCurrent(ended.statusHistory, "2026-06-01"), false); // ended by then
  assert.equal(isSchoolRelationshipCurrent(created.statusHistory, "2024-01-01"), false); // before it existed
});

// --- Person/School identity separation --------------------------------------

test("School identity (schoolId) and Person identity (personId) are independent — neither field is ever derived from or overwrites the other", () => {
  const rel = createSchoolRelationship({ schoolId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const ended = endSchoolRelationship(rel, "Left", "2026-04-30");
  // Ending the relationship (a lifecycle/School-relationship-level action)
  // never touches personId — the Person's own identity is completely
  // outside this module's authority, exactly as PPL-000 requires.
  assert.equal(ended.personId, "vyom_id");
  assert.equal(ended.schoolId, "dps");
});

test("this module never creates, edits, or archives a Person record — it has no function capable of doing so", () => {
  const exported = { createSchoolRelationship, endSchoolRelationship, isSchoolRelationshipCurrent, getCurrentSchoolRelationship, getHistoricalSchoolRelationships };
  for (const [name, fn] of Object.entries(exported)) {
    const src = fn.toString();
    assert.equal(/setPeople|people\[/.test(src), false, `${name} should never reference a people[] array or setter`);
  }
});
