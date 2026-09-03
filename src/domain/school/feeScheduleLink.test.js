import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getFeeSchedulesForRelationship,
  getPersonFeeSchedules,
  isFeeScheduleLinkedToPerson,
} from "./feeScheduleLink.js";
import { createSchoolRelationship, endSchoolRelationship } from "./relationship.js";

let idCounter = 0;
const genId = () => `id_${++idCounter}`;

function makeFeeSchedule(overrides = {}) {
  return {
    id: "sched1", billerAccountId: null, personId: null,
    schoolName: "Delhi Public School", schoolYearStart: "2026-06-01", schoolYearEnd: "2027-04-30",
    rateRules: [{ from: "2026-06", to: "2027-04", monthlyRate: 4500 }],
    createdAt: Date.now(),
    ...overrides,
  };
}

// --- The actual connection ---------------------------------------------

test("getFeeSchedulesForRelationship connects a fee schedule to a relationship via the shared billerAccountId", () => {
  const rel = createSchoolRelationship({ billerAccountId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const schedule = makeFeeSchedule({ billerAccountId: "dps", personId: "vyom_id" });
  const connected = getFeeSchedulesForRelationship(rel, [schedule]);
  assert.equal(connected.length, 1);
  assert.equal(connected[0].id, "sched1");
});

test("getFeeSchedulesForRelationship excludes fee schedules belonging to a different biller account (different school), even if personId matches", () => {
  const rel = createSchoolRelationship({ billerAccountId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const schedule = makeFeeSchedule({ billerAccountId: "some_other_school", personId: "vyom_id" });
  assert.deepEqual(getFeeSchedulesForRelationship(rel, [schedule]), []);
});

test("getPersonFeeSchedules — the direct personId join, without needing a full relationship record", () => {
  const schedules = [
    makeFeeSchedule({ id: "s1", personId: "vyom_id" }),
    makeFeeSchedule({ id: "s2", personId: "rahul_id" }),
    makeFeeSchedule({ id: "s3", personId: "vyom_id" }),
  ];
  const vyomsSchedules = getPersonFeeSchedules("vyom_id", schedules);
  assert.deepEqual(vyomsSchedules.map(s => s.id).sort(), ["s1", "s3"]);
});

test("isFeeScheduleLinkedToPerson — the smallest single-schedule check", () => {
  const schedule = makeFeeSchedule({ personId: "vyom_id" });
  assert.equal(isFeeScheduleLinkedToPerson(schedule, "vyom_id"), true);
  assert.equal(isFeeScheduleLinkedToPerson(schedule, "rahul_id"), false);
});

// --- Current production state: dormant, confirmed, not a bug in this WP -

test("CURRENT PRODUCTION STATE: a fee schedule with billerAccountId===null (today's real, only-ever-created shape) connects to NOTHING — confirmed dormant, per the live re-trace", () => {
  const rel = createSchoolRelationship({ billerAccountId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const realProductionShapedSchedule = makeFeeSchedule({ billerAccountId: null, personId: null }); // exactly what AddSchoolYearModal produces today
  assert.deepEqual(getFeeSchedulesForRelationship(rel, [realProductionShapedSchedule]), []);
  assert.deepEqual(getPersonFeeSchedules("vyom_id", [realProductionShapedSchedule]), []);
  assert.equal(isFeeScheduleLinkedToPerson(realProductionShapedSchedule, "vyom_id"), false);
});

test("a relationship with no billerAccountId (should never happen given createSchoolRelationship's own validation, but defended against anyway) connects to nothing rather than matching every null-billerAccountId schedule", () => {
  const relWithNoBillerAccountId = { id: "rel1", billerAccountId: null, personId: "vyom_id", status: "active", statusHistory: [] };
  const nullBillerAccountSchedule = makeFeeSchedule({ billerAccountId: null, personId: "vyom_id" });
  // Explicitly must NOT connect null-to-null — that would silently link
  // every unattributed schedule to every unattributed relationship.
  assert.deepEqual(getFeeSchedulesForRelationship(relWithNoBillerAccountId, [nullBillerAccountSchedule]), []);
});

// --- Historical-ID preservation -----------------------------------------

test("the connection never mutates the fee schedule — id, schoolName, schoolYearStart/End, rateRules all untouched", () => {
  const rel = createSchoolRelationship({ billerAccountId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const schedule = makeFeeSchedule({ billerAccountId: "dps", personId: "vyom_id" });
  const snapshot = JSON.parse(JSON.stringify(schedule));
  getFeeSchedulesForRelationship(rel, [schedule]);
  assert.deepEqual(schedule, snapshot);
});

test("the connection never mutates the relationship", () => {
  const rel = createSchoolRelationship({ billerAccountId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const snapshot = JSON.parse(JSON.stringify(rel));
  getFeeSchedulesForRelationship(rel, [makeFeeSchedule({ billerAccountId: "dps", personId: "vyom_id" })]);
  assert.deepEqual(rel, snapshot);
});

test("connected fee schedule objects are returned BY REFERENCE, not copies — proving no silent field gets added or altered in transit", () => {
  const rel = createSchoolRelationship({ billerAccountId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const schedule = makeFeeSchedule({ billerAccountId: "dps", personId: "vyom_id" });
  const connected = getFeeSchedulesForRelationship(rel, [schedule]);
  assert.equal(connected[0], schedule); // exact same object reference
});

test("historical transactions are never touched by this module — it has no function capable of reading or writing txns[]", () => {
  const source = [getFeeSchedulesForRelationship, getPersonFeeSchedules, isFeeScheduleLinkedToPerson]
    .map(fn => fn.toString()).join("\n");
  assert.equal(/txns\[|setTxns/.test(source), false);
});

// --- RESOLVED: the former limitation is now the expected, correct behavior -

test("RESOLVED (PPL-006 WP-2): when a person has TWO school relationships (a school change), billerAccountId disambiguates correctly — each relationship connects only to its own school's schedule", () => {
  const oldRel = endSchoolRelationship(
    createSchoolRelationship({ billerAccountId: "school_a", personId: "vyom_id", startDate: "2024-06-01", genId }),
    "Changed schools", "2025-04-30"
  );
  const newRel = createSchoolRelationship({ billerAccountId: "school_b", personId: "vyom_id", startDate: "2025-06-01", genId });

  const scheduleForSchoolA = makeFeeSchedule({ id: "sched_a", billerAccountId: "school_a", personId: "vyom_id", schoolName: "School A" });
  const scheduleForSchoolB = makeFeeSchedule({ id: "sched_b", billerAccountId: "school_b", personId: "vyom_id", schoolName: "School B" });
  const allSchedules = [scheduleForSchoolA, scheduleForSchoolB];

  // This is the exact scenario that was previously proven ambiguous — same
  // person, same personId, two relationships. Joining on billerAccountId
  // instead resolves it: each relationship connects to exactly its own
  // school's schedule, never the other one, even though personId is
  // identical across both.
  const connectedToOld = getFeeSchedulesForRelationship(oldRel, allSchedules);
  const connectedToNew = getFeeSchedulesForRelationship(newRel, allSchedules);
  assert.equal(connectedToOld.length, 1);
  assert.equal(connectedToOld[0].id, "sched_a");
  assert.equal(connectedToNew.length, 1);
  assert.equal(connectedToNew[0].id, "sched_b");
  assert.notDeepEqual(connectedToOld, connectedToNew); // proves the two relationships now resolve differently, as they should
});
