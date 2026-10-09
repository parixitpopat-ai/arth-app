import { test } from "node:test";
import assert from "node:assert/strict";
import { getExpectedSpendByToday, getSpendPaceState } from "./pace.js";

test("expected spend by today is the straight-line pace, today included", () => {
  assert.equal(getExpectedSpendByToday({ budget: 50000, today: "2026-10-09", monthKey: "2026-10" }), 14516); // 50,000 x 9/31
  assert.equal(getExpectedSpendByToday({ budget: 31000, today: "2026-10-31", monthKey: "2026-10" }), 31000); // last day = whole budget
  assert.equal(getExpectedSpendByToday({ budget: 28000, today: "2026-02-14", monthKey: "2026-02" }), 14000); // 14/28
});

test("no pace for another month or when there is no budget", () => {
  assert.equal(getExpectedSpendByToday({ budget: 50000, today: "2026-10-09", monthKey: "2026-09" }), null);
  assert.equal(getExpectedSpendByToday({ budget: 0, today: "2026-10-09", monthKey: "2026-10" }), null);
});

test("pace state: over budget, ahead of pace, on track", () => {
  assert.equal(getSpendPaceState({ spent: 60000, budget: 50000, expected: 14516 }), "over");
  assert.equal(getSpendPaceState({ spent: 18600, budget: 50000, expected: 14516 }), "ahead");
  assert.equal(getSpendPaceState({ spent: 12000, budget: 50000, expected: 14516 }), "onTrack");
  assert.equal(getSpendPaceState({ spent: 18600, budget: 50000, expected: null }), "onTrack");
});
