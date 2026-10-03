import { test } from "node:test";
import assert from "node:assert/strict";
import { nudgeAmount, planNudge } from "./nudge.js";

test("raise-to figure is the planned spending rounded up to ₹1,000", () => {
  assert.equal(nudgeAmount(90000), 90000);
  assert.equal(nudgeAmount(90001), 91000);
  assert.equal(nudgeAmount(61050), 62000);
  assert.equal(nudgeAmount(0), 0);
});

test("PA8: over budget and unanswered -> the card, with the raise-to amount", () => {
  assert.deepEqual(planNudge({ budgetUsed: 90000, monthBudget: 65000, over: 25000, record: null }), { kind: "card", raiseTo: 90000 });
});

test("within budget -> nothing", () => {
  assert.equal(planNudge({ budgetUsed: 61050, monthBudget: 65000, over: 0, record: null }), null);
});

test("PA9: Not now stays dismissed until planned spending rises above what was dismissed", () => {
  const record = { dismissedAtUsed: 90000 };
  assert.equal(planNudge({ budgetUsed: 90000, monthBudget: 65000, over: 25000, record }).kind, "dismissed");
  assert.equal(planNudge({ budgetUsed: 80000, monthBudget: 65000, over: 15000, record }).kind, "dismissed");
  assert.deepEqual(planNudge({ budgetUsed: 93500, monthBudget: 65000, over: 28500, record }), { kind: "card", raiseTo: 94000 });
});

test("PA9: accepted shows the raise while the budget is still the raised figure, and ends if it changes", () => {
  const record = { raisedFrom: 65000, raisedTo: 90000 };
  assert.deepEqual(planNudge({ budgetUsed: 90000, monthBudget: 90000, over: 0, record }), { kind: "raised", raisedFrom: 65000, raisedTo: 90000 });
  assert.equal(planNudge({ budgetUsed: 90000, monthBudget: 100000, over: 0, record }), null, "budget was edited since: stop claiming it was raised");
});
