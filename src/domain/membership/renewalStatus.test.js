import { test } from "node:test";
import assert from "node:assert/strict";
import { getMembershipRenewalStatus, getFollowingPeriod } from "./renewalStatus.js";
import { readFileSync } from "node:fs";

test("null when there's nothing with a derivable period", () => {
  assert.equal(getMembershipRenewalStatus([], "2026-09-27"), null);
  assert.equal(getMembershipRenewalStatus([{ m: { id: "m1" }, period: null }], "2026-09-27"), null);
});

test("null when the latest period is covered well beyond the forward window", () => {
  const status = getMembershipRenewalStatus([{ m: { id: "m1" }, period: { from: "2026-09-01", to: "2026-12-31" } }], "2026-09-27");
  assert.equal(status, null);
});

test("renewing: period ends within the forward window (not yet lapsed)", () => {
  const status = getMembershipRenewalStatus([{ m: { id: "m1" }, period: { from: "2026-07-01", to: "2026-09-30" } }], "2026-09-27");
  assert.equal(status.kind, "renewing");
  assert.equal(status.days, 3);
  assert.equal(status.m.id, "m1");
});

test("overdue: period already lapsed with no newer payment recorded (the previously-missing state)", () => {
  const status = getMembershipRenewalStatus([{ m: { id: "m1" }, period: { from: "2026-06-01", to: "2026-08-31" } }], "2026-09-27");
  assert.equal(status.kind, "overdue");
  assert.equal(status.days, 27);
});

test("grace days extend the effective end before it counts as overdue", () => {
  const status = getMembershipRenewalStatus([{ m: { id: "m1" }, period: { from: "2026-06-01", to: "2026-09-20", graceDays: 10 } }], "2026-09-27");
  assert.equal(status.kind, "renewing", "effective end (30 Sep) is still within the forward window, not lapsed");
});

test("only the latest-ending period across several payments decides the status", () => {
  const memberships = [
    { m: { id: "old" }, period: { from: "2026-01-01", to: "2026-03-31" } }, // long lapsed, superseded
    { m: { id: "current" }, period: { from: "2026-07-01", to: "2026-09-30" } },
  ];
  const status = getMembershipRenewalStatus(memberships, "2026-09-27");
  assert.equal(status.kind, "renewing");
  assert.equal(status.m.id, "current");
});

const MONTHLY = { from: "2026-10-01", to: "2026-10-31" };
const HALF = { from: "2026-11-01", to: "2027-04-30" };

test("a period starting the day after this one ends means it is already renewed", () => {
  assert.deepEqual(getFollowingPeriod([MONTHLY, HALF], "2026-10-31"), HALF);
});

test("no following period: nothing recorded, a gap of days, or only older periods", () => {
  assert.equal(getFollowingPeriod([MONTHLY], "2026-10-31"), null);
  assert.equal(getFollowingPeriod([MONTHLY, { from: "2026-11-05", to: "2026-12-04" }], "2026-10-31"), null);
  assert.equal(getFollowingPeriod([{ from: "2026-09-01", to: "2026-09-30" }, MONTHLY], "2026-10-31"), null);
  assert.equal(getFollowingPeriod([], "2026-10-31"), null);
  assert.equal(getFollowingPeriod([HALF], null), null);
});

test("grace days: the next period may start inside the grace window, and the longest cover wins", () => {
  assert.deepEqual(getFollowingPeriod([HALF], "2026-11-05"), HALF);   // starts 1 Nov, current effective end 5 Nov
  const short = { from: "2026-11-01", to: "2026-11-30" };
  assert.deepEqual(getFollowingPeriod([short, HALF], "2026-10-31"), HALF);
});

test("the membership card hides Renew when a following period exists and says 1 day, not 1 days", () => {
  const src = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
  assert.match(src, /getFollowingPeriod\(allPeriods, heroEffEnd\)/);
  assert.match(src, /daysLeft<=15&&!followingPeriod&&\(/);
  assert.match(src, /Renewed · next period starts/);
  assert.match(src, /Expires in \{daysLeft\} \{daysLeft===1\?"day":"days"\}/);
  assert.equal(/Expires in \{daysLeft\} days/.test(src), false);
});
