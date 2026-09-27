import { test } from "node:test";
import assert from "node:assert/strict";
import { getPendingGymCheckIn, recordGymCheckIn, getCostPerVisit } from "./checkIn.js";

const billerAccounts = [{ id: "ba1", type: "Gym / Fitness", name: "Genesis Calisthenics Park" }];
const relationships = [{ id: "rel1", billerAccountId: "ba1", status: "active" }];

test("asks when there's an active Gym relationship with no answer yet today", () => {
  const pending = getPendingGymCheckIn({ relationships, billerAccounts, checkIns: [], holidays: [], today: "2026-09-27" });
  assert.deepEqual(pending, { relationshipId: "rel1", billerAccountId: "ba1", billerName: "Genesis Calisthenics Park" });
});

test("doesn't ask twice in one day", () => {
  const checkIns = [{ relationshipId: "rel1", date: "2026-09-27", attended: true }];
  assert.equal(getPendingGymCheckIn({ relationships, billerAccounts, checkIns, holidays: [], today: "2026-09-27" }), null);
});

test("doesn't ask on a marked public holiday", () => {
  assert.equal(getPendingGymCheckIn({ relationships, billerAccounts, checkIns: [], holidays: ["2026-09-27"], today: "2026-09-27" }), null);
});

test("doesn't ask while the relationship is paused (traveling)", () => {
  const paused = [{ id: "rel1", billerAccountId: "ba1", status: "paused" }];
  assert.equal(getPendingGymCheckIn({ relationships: paused, billerAccounts, checkIns: [], holidays: [], today: "2026-09-27" }), null);
});

test("doesn't ask for a non-Gym relationship type", () => {
  const otherAccounts = [{ id: "ba1", type: "Society Maintenance", name: "Society" }];
  assert.equal(getPendingGymCheckIn({ relationships, billerAccounts: otherAccounts, checkIns: [], holidays: [], today: "2026-09-27" }), null);
});

test("recordGymCheckIn builds a plain record", () => {
  const rec = recordGymCheckIn({ relationshipId: "rel1", billerAccountId: "ba1", date: "2026-09-27", attended: true, genId: () => "ck1" });
  assert.equal(rec.id, "ck1");
  assert.equal(rec.attended, true);
  assert.equal(rec.date, "2026-09-27");
});

test("getCostPerVisit: null with no attended visits, else spend / visit count", () => {
  assert.equal(getCostPerVisit([], "rel1", 8499), null);
  const checkIns = [
    { relationshipId: "rel1", attended: true },
    { relationshipId: "rel1", attended: false },
    { relationshipId: "rel1", attended: true },
    { relationshipId: "rel2", attended: true }, // different relationship, excluded
  ];
  assert.equal(getCostPerVisit(checkIns, "rel1", 8499), 8499 / 2);
});
