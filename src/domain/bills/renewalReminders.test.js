import { test } from "node:test";
import assert from "node:assert/strict";
import { getMembershipRenewalReminders, getSchoolFeeReminders } from "./renewalReminders.js";

test("getMembershipRenewalReminders: overdue gym membership (the reported case) is surfaced", () => {
  const billerAccounts = [{ id: "ba1", name: "Parixit", type: "Gym / Fitness" }];
  const memberships = [{ id: "m1", billerAccountId: "ba1", amount: 8499 }];
  const period = { from: "2026-06-16", to: "2026-09-15", graceDays: 0 };
  const getCurrentPeriod = m => (m.id === "m1" ? period : null);
  const items = getMembershipRenewalReminders({ billerAccounts, memberships, getCurrentPeriod, today: "2026-09-28" });
  assert.equal(items.length, 1);
  assert.equal(items[0].billerAccountId, "ba1");
  assert.equal(items[0].name, "Parixit");
  assert.equal(items[0].amount, 8499);
  assert.equal(items[0].kind, "overdue");
  assert.equal(items[0].days, 13);
  assert.equal(items[0].sourceType, "membership");
});

test("getMembershipRenewalReminders: School Fees / Education Fees biller types are excluded (handled separately)", () => {
  const billerAccounts = [{ id: "ba1", name: "School", type: "School Fees" }, { id: "ba2", name: "College", type: "Education Fees" }];
  const memberships = [{ id: "m1", billerAccountId: "ba1", amount: 5000 }, { id: "m2", billerAccountId: "ba2", amount: 5000 }];
  const getCurrentPeriod = () => ({ from: "2026-01-01", to: "2026-01-01" });
  assert.deepEqual(getMembershipRenewalReminders({ billerAccounts, memberships, getCurrentPeriod, today: "2026-09-28" }), []);
});

test("getMembershipRenewalReminders: nothing due soon or overdue is omitted", () => {
  const billerAccounts = [{ id: "ba1", name: "Netflix", type: "Other Subscription" }];
  const memberships = [{ id: "m1", billerAccountId: "ba1", amount: 649 }];
  const getCurrentPeriod = () => ({ from: "2026-09-01", to: "2026-12-01" }); // far in the future
  assert.deepEqual(getMembershipRenewalReminders({ billerAccounts, memberships, getCurrentPeriod, today: "2026-09-28" }), []);
});

test("getMembershipRenewalReminders: an account with no memberships at all is skipped, not crashed on", () => {
  const billerAccounts = [{ id: "ba1", name: "Empty gym", type: "Gym / Fitness" }];
  assert.deepEqual(getMembershipRenewalReminders({ billerAccounts, memberships: [], getCurrentPeriod: () => null, today: "2026-09-28" }), []);
});

test("getSchoolFeeReminders: an overdue, unsettled, DECLARED fee period is surfaced", () => {
  const feeSchedules = [{ id: "sch1", billerAccountId: "ba1" }];
  const feePeriods = [{ id: "p1", scheduleId: "sch1", label: "September", dueDate: "2026-09-01", obligationAmount: 12000, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0 }];
  const billerAccounts = [{ id: "ba1", name: "Greenwood School" }];
  const items = getSchoolFeeReminders({ feeSchedules, feePeriods, billerAccounts, today: "2026-09-28" });
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "September");
  assert.equal(items[0].amount, 12000);
  assert.equal(items[0].kind, "overdue");
  assert.equal(items[0].sourceType, "school");
});

test("getSchoolFeeReminders: WP5 — an undeclared period is never surfaced, even with a real overdue amount", () => {
  const feeSchedules = [{ id: "sch1", billerAccountId: "ba1" }];
  const feePeriods = [{ id: "p1", scheduleId: "sch1", label: "September", dueDate: "2026-09-01", obligationAmount: 12000, startingStateDeclared: false, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0 }];
  assert.deepEqual(getSchoolFeeReminders({ feeSchedules, feePeriods, billerAccounts: [], today: "2026-09-28" }), []);
});

test("getSchoolFeeReminders: a fully paid period is never surfaced", () => {
  const feeSchedules = [{ id: "sch1", billerAccountId: "ba1" }];
  const feePeriods = [{ id: "p1", scheduleId: "sch1", dueDate: "2026-09-01", obligationAmount: 12000, startingStateDeclared: true, paidAmount: 12000, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0 }];
  assert.deepEqual(getSchoolFeeReminders({ feeSchedules, feePeriods, billerAccounts: [], today: "2026-09-28" }), []);
});

test("getSchoolFeeReminders: a period with no dueDate is skipped, never guessed", () => {
  const feeSchedules = [{ id: "sch1", billerAccountId: "ba1" }];
  const feePeriods = [{ id: "p1", scheduleId: "sch1", obligationAmount: 12000, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0 }];
  assert.deepEqual(getSchoolFeeReminders({ feeSchedules, feePeriods, billerAccounts: [], today: "2026-09-28" }), []);
});

test("getSchoolFeeReminders: due further out than forwardDays is omitted", () => {
  const feeSchedules = [{ id: "sch1", billerAccountId: "ba1" }];
  const feePeriods = [{ id: "p1", scheduleId: "sch1", dueDate: "2026-12-01", obligationAmount: 12000, startingStateDeclared: true, paidAmount: 0, discountAmount: 0, writeOffAmount: 0, appliedCreditAmount: 0 }];
  assert.deepEqual(getSchoolFeeReminders({ feeSchedules, feePeriods, billerAccounts: [], today: "2026-09-28" }), []);
});
