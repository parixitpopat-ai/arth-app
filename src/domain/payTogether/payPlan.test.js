import { test } from "node:test";
import assert from "node:assert/strict";
import { planGroupPayment } from "./payPlan.js";

const feePeriods = [{ id: "p1", scheduleId: "s1" }, { id: "p2", scheduleId: "s1" }, { id: "p3", scheduleId: "s2" }];
const feeSchedules = [{ id: "s1", schoolName: "Tiny Trees" }, { id: "s2", schoolName: "Sunrise" }];
const bills = [{ id: "b1", name: "Electricity" }, { id: "b2", name: "Card", isCcStatement: true }];
const fee = (id, amount = 5000) => ({ sourceType: "feePeriod", sourceId: id, amount });

test("fee periods are grouped per school into one Pay fees run each", () => {
  const plan = planGroupPayment({ live: [fee("p1"), fee("p2"), fee("p3", 4000)], feePeriods, feeSchedules, bills });
  assert.equal(plan.parts.length, 2);
  assert.deepEqual(plan.parts[0].periodIds, ["p1", "p2"]);
  assert.equal(plan.parts[0].total, 10000);
  assert.equal(plan.parts[1].schedule.schoolName, "Sunrise");
  assert.equal(plan.total, 14000);
  assert.equal(plan.unpayable.length, 0);
});

test("a bill is paid through Record payment; card statements and SIPs are not payable from here", () => {
  const plan = planGroupPayment({
    live: [{ sourceType: "bill", sourceId: "b1", amount: 800 }, { sourceType: "bill", sourceId: "b2", amount: 9000 }, { sourceType: "recurringSchedule", sourceId: "r1", amount: 15000 }],
    feePeriods, feeSchedules, bills,
  });
  assert.equal(plan.parts.length, 1);
  assert.equal(plan.parts[0].kind, "bill");
  assert.equal(plan.unpayable.length, 2);
});

test("a fee period whose school can't be found is reported, not dropped", () => {
  const plan = planGroupPayment({ live: [fee("ghost")], feePeriods, feeSchedules, bills });
  assert.equal(plan.parts.length, 0);
  assert.equal(plan.unpayable.length, 1);
});
