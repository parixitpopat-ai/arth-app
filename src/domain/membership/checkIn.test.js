import { test } from "node:test";
import assert from "node:assert/strict";
import { getPendingGymCheckIn, recordGymCheckIn, getCostPerVisit, getPendingGymCatchUp, recordGymBreak, GYM_CATCH_UP_DAYS } from "./checkIn.js";

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

test("reported bug: account's own name is just a nickname to tell two accounts apart (\"Parixit\") — the prompt uses the real gym shell's name instead", () => {
  const nicknamedAccounts = [{ id: "ba1", type: "Gym / Fitness", name: "Parixit", billerId: "shell1" }];
  const billers = [{ id: "shell1", name: "Genesis Calisthenics Park" }];
  const pending = getPendingGymCheckIn({ relationships, billerAccounts: nicknamedAccounts, billers, checkIns: [], holidays: [], today: "2026-09-27" });
  assert.equal(pending.billerName, "Genesis Calisthenics Park", "not the account nickname \"Parixit\"");
});

test("no biller shell linked: falls back to the account's own name", () => {
  const pending = getPendingGymCheckIn({ relationships, billerAccounts, billers: [], checkIns: [], holidays: [], today: "2026-09-27" });
  assert.equal(pending.billerName, "Genesis Calisthenics Park");
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

// ---- catch-up: open the app after several days and be asked about every missed day ----
const hist = (...entries) => entries.map(([status, effectiveDate], i) => ({ status, effectiveDate, timestamp: i }));
const relSince = (since, extra = {}) => [{ id: "rel1", billerAccountId: "ba1", status: "active", statusHistory: hist(["active", since]), ...extra }];
const catchUp = (o = {}) => getPendingGymCatchUp({ relationships: relSince("2026-01-01"), billerAccounts, billers: [], checkIns: [], holidays: [], today: "2026-10-10", ...o });

test("catch-up: after 10 days away every unanswered day is asked, oldest first, today included", () => {
  const checkIns = Array.from({ length: 21 }, (_, i) => ({ relationshipId: "rel1", date: new Date(2026, 8, 10 + i, 12).toISOString().slice(0, 10), attended: true })); // 10-30 Sep
  const r = catchUp({ checkIns });
  assert.deepEqual(r.days, ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]);
  assert.equal(r.billerAccountId, "ba1");
});

test("catch-up: opened every day, only today is asked", () => {
  const checkIns = Array.from({ length: 31 }, (_, i) => ({ relationshipId: "rel1", date: `2026-${i < 9 ? "10" : "09"}-${String(i < 9 ? i + 1 : 40 - i).padStart(2, "0")}`, attended: true }));
  assert.deepEqual(catchUp({ checkIns }).days, ["2026-10-10"]);
});

test("catch-up: answered days, marked holidays, and days before the membership began are not asked", () => {
  const r = catchUp({ relationships: relSince("2026-10-07"), holidays: ["2026-10-08"], checkIns: [{ relationshipId: "rel1", date: "2026-10-09", attended: false }] });
  assert.deepEqual(r.days, ["2026-10-07", "2026-10-10"]);
});

test("catch-up: days the relationship was paused (traveling) are not asked", () => {
  const rels = relSince("2026-01-01", { statusHistory: hist(["active", "2026-01-01"], ["paused", "2026-10-03"], ["active", "2026-10-08"]) });
  const days = catchUp({ relationships: rels }).days;
  assert.equal(days.includes("2026-10-05"), false);
  assert.equal(days.includes("2026-10-08"), true);
});

test("catch-up: reaches back no further than the cap", () => {
  const r = catchUp();
  assert.equal(r.days.length, GYM_CATCH_UP_DAYS);
  assert.equal(r.days[0], "2026-09-10");
});

test("catch-up: a paused, ended or non-gym relationship is never asked", () => {
  assert.equal(catchUp({ relationships: [{ id: "rel1", billerAccountId: "ba1", status: "paused", statusHistory: hist(["paused", "2026-01-01"]) }] }), null);
  assert.equal(catchUp({ billerAccounts: [{ id: "ba1", type: "Society Maintenance" }] }), null);
});

test("catch-up: a relationship with no history is asked only from the day it was created", () => {
  const created = new Date("2026-10-08T09:00:00").getTime();
  const r = catchUp({ relationships: [{ id: "rel1", billerAccountId: "ba1", status: "active", createdAt: created }] });
  assert.deepEqual(r.days, ["2026-10-08", "2026-10-09", "2026-10-10"]);
});

test("recordGymBreak: one not-attended record per day, flagged as a break, so cost per visit is untouched", () => {
  let n = 0; const genId = () => `id${++n}`;
  const recs = recordGymBreak({ relationshipId: "rel1", billerAccountId: "ba1", days: ["2026-10-01", "2026-10-02"], genId });
  assert.equal(recs.length, 2);
  assert.ok(recs.every(r => r.attended === false && r.onBreak === true && r.relationshipId === "rel1"));
  assert.equal(getCostPerVisit(recs, "rel1", 3000), null);
});
