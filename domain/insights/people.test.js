// domain/insights/people.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGroupRows } from "./people.js";

function fakeGetGroupAttributedAmount(amountsByGroupPerTxn) {
  return (t, groupId) => amountsByGroupPerTxn(t, groupId);
}

test("buildGroupRows: uses injected attribution function, filters to relevant groups, sorts by spend desc", () => {
  const groups = [
    { id: "g1", name: "Family", manualLimit: 10000, manualLimitOverrides: {} },
    { id: "g2", name: "Roommates", manualLimit: 5000, manualLimitOverrides: {} },
    { id: "g3", name: "Unused", manualLimit: 0, manualLimitOverrides: {} },
  ];
  const periodTxns = [{ id: "t1" }, { id: "t2" }];
  const getGroupAttributedAmount = fakeGetGroupAttributedAmount((t, groupId) => {
    if (groupId === "g1" && t.id === "t1") return 3000;
    if (groupId === "g2" && t.id === "t2") return 6000;
    return 0;
  });
  const rows = buildGroupRows(groups, periodTxns, "2026-08", getGroupAttributedAmount);
  assert.equal(rows.length, 2, "g3 excluded — zero budget AND zero spend");
  assert.equal(rows[0].group.id, "g2");
  assert.equal(rows[0].actual, 6000);
  assert.equal(rows[0].status, "over");
  assert.equal(rows[1].group.id, "g1");
  assert.equal(rows[1].actual, 3000);
});

test("buildGroupRows: empty groups/txns are safe", () => {
  assert.deepEqual(buildGroupRows([], [], "2026-08", () => 0), []);
  assert.deepEqual(buildGroupRows(null, [], "2026-08", () => 0), []);
});
