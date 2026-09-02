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

test("getFeeSchedulesForRelationship connects a fee schedule to a relationship via the shared personId", () => {
  const rel = createSchoolRelationship({ billerAccountId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const schedule = makeFeeSchedule({ personId: "vyom_id" });
  const connected = getFeeSchedulesForRelationship(rel, [schedule]);
  assert.equal(connected.length, 1);
  assert.equal(connected[0].id, "sched1");
});

test("getFeeSchedulesForRelationship excludes fee schedules belonging to a different person", () => {
  const rel = createSchoolRelationship({ billerAccountId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const schedule = makeFeeSchedule({ personId: "rahul_id" });
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

test("CURRENT PRODUCTION STATE: a fee schedule with personId===null (today's real, only-ever-created shape) connects to NOTHING — confirmed dormant, per the live re-trace", () => {
  const rel = createSchoolRelationship({ billerAccountId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const realProductionShapedSchedule = makeFeeSchedule({ personId: null }); // exactly what AddSchoolYearModal produces today
  assert.deepEqual(getFeeSchedulesForRelationship(rel, [realProductionShapedSchedule]), []);
  assert.deepEqual(getPersonFeeSchedules("vyom_id", [realProductionShapedSchedule]), []);
  assert.equal(isFeeScheduleLinkedToPerson(realProductionShapedSchedule, "vyom_id"), false);
});

test("a relationship with no personId (should never happen given createSchoolRelationship's own validation, but defended against anyway) connects to nothing rather than matching every null-personId schedule", () => {
  const relWithNoPersonId = { id: "rel1", billerAccountId: "dps", personId: null, status: "active", statusHistory: [] };
  const nullPersonSchedule = makeFeeSchedule({ personId: null });
  // Explicitly must NOT connect null-to-null — that would silently link
  // every unattributed schedule to every unattributed relationship.
  assert.deepEqual(getFeeSchedulesForRelationship(relWithNoPersonId, [nullPersonSchedule]), []);
});

// --- Historical-ID preservation -----------------------------------------

test("the connection never mutates the fee schedule — id, schoolName, schoolYearStart/End, rateRules all untouched", () => {
  const rel = createSchoolRelationship({ billerAccountId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const schedule = makeFeeSchedule({ personId: "vyom_id" });
  const snapshot = JSON.parse(JSON.stringify(schedule));
  getFeeSchedulesForRelationship(rel, [schedule]);
  assert.deepEqual(schedule, snapshot);
});

test("the connection never mutates the relationship", () => {
  const rel = createSchoolRelationship({ billerAccountId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const snapshot = JSON.parse(JSON.stringify(rel));
  getFeeSchedulesForRelationship(rel, [makeFeeSchedule({ personId: "vyom_id" })]);
  assert.deepEqual(rel, snapshot);
});

test("connected fee schedule objects are returned BY REFERENCE, not copies — proving no silent field gets added or altered in transit", () => {
  const rel = createSchoolRelationship({ billerAccountId: "dps", personId: "vyom_id", startDate: "2025-06-01", genId });
  const schedule = makeFeeSchedule({ personId: "vyom_id" });
  const connected = getFeeSchedulesForRelationship(rel, [schedule]);
  assert.equal(connected[0], schedule); // exact same object reference
});

test("historical transactions are never touched by this module — it has no function capable of reading or writing txns[]", () => {
  const source = [getFeeSchedulesForRelationship, getPersonFeeSchedules, isFeeScheduleLinkedToPerson]
    .map(fn => fn.toString()).join("\n");
  assert.equal(/txns\[|setTxns/.test(source), false);
});

// --- The real, honestly-documented limitation ----------------------------

test("KNOWN LIMITATION, proven directly: when a person has TWO school relationships (a school change), personId-only matching cannot distinguish which schedule belongs to which school", () => {
  const oldRel = endSchoolRelationship(
    createSchoolRelationship({ billerAccountId: "school_a", personId: "vyom_id", startDate: "2024-06-01", genId }),
    "Changed schools", "2025-04-30"
  );
  const newRel = createSchoolRelationship({ billerAccountId: "school_b", personId: "vyom_id", startDate: "2025-06-01", genId });

  const scheduleForSchoolA = makeFeeSchedule({ id: "sched_a", personId: "vyom_id", schoolName: "School A" });
  const scheduleForSchoolB = makeFeeSchedule({ id: "sched_b", personId: "vyom_id", schoolName: "School B" });
  const allSchedules = [scheduleForSchoolA, scheduleForSchoolB];

  // Both relationships "connect" to BOTH schedules — this is the honest,
  // proven limitation, not a hidden bug. A future work package needs to
  // give the fee-structure layer a real reference to its owning
  // relationship (or school) before this ambiguity can be resolved.
  const connectedToOld = getFeeSchedulesForRelationship(oldRel, allSchedules);
  const connectedToNew = getFeeSchedulesForRelationship(newRel, allSchedules);
  assert.equal(connectedToOld.length, 2); // ambiguous — both schedules match
  assert.equal(connectedToNew.length, 2); // same ambiguity from the other relationship
  assert.deepEqual(connectedToOld, connectedToNew); // proves it's the same (wrong-for-disambiguation) result either way
});
