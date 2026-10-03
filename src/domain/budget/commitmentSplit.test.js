import { test } from "node:test";
import assert from "node:assert/strict";
import { splitAllocation } from "./commitmentSplit.js";

const house = { id: "c1", name: "Rent share", amount: 10000, skippedMonths: [] };

test("PA2: ₹30,000 with ₹10,000 committed -> free ₹20,000, ₹8,000 spent, ₹12,000 left", () => {
  const s = splitAllocation({ allocation: 30000, commitments: [house], monthKey: "2026-11", totalSpent: 8000 });
  assert.equal(s.committed, 10000);
  assert.equal(s.free, 20000);
  assert.equal(s.spentFree, 8000);
  assert.equal(s.leftFree, 12000);
  assert.equal(s.over, 0);
  assert.ok(Math.abs(s.committedShare - 1 / 3) < 1e-9);
});

test("PA4: skipped for the month -> whole allocation is free to spend", () => {
  const skipped = { ...house, skippedMonths: ["2026-11"] };
  const s = splitAllocation({ allocation: 30000, commitments: [skipped], monthKey: "2026-11", totalSpent: 12000 });
  assert.equal(s.committed, 0);
  assert.equal(s.skippedTotal, 10000);
  assert.equal(s.free, 30000);
  assert.equal(s.leftFree, 18000);
  assert.equal(s.allSkipped, true);
  // next month the skip no longer applies
  assert.equal(splitAllocation({ allocation: 30000, commitments: [skipped], monthKey: "2026-12" }).committed, 10000);
});

test("PA5: spending past free-to-spend shows how far over, committed untouched", () => {
  const s = splitAllocation({ allocation: 30000, commitments: [house], monthKey: "2026-11", totalSpent: 21800 });
  assert.equal(s.free, 20000);
  assert.equal(s.leftFree, -1800);
  assert.equal(s.over, 1800);
  assert.equal(s.committed, 10000);
});

test("spend on the commitment's own category draws from the committed part first, up to its amount", () => {
  const s = splitAllocation({ allocation: 30000, commitments: [house], monthKey: "2026-11", totalSpent: 14000, spentByCommitment: { c1: 10000 } });
  assert.equal(s.spentFree, 4000);
  assert.equal(s.leftFree, 16000);
  // spending above the commitment amount in its category spills into free
  const t = splitAllocation({ allocation: 30000, commitments: [house], monthKey: "2026-11", totalSpent: 12000, spentByCommitment: { c1: 12000 } });
  assert.equal(t.spentFree, 2000);
});

test("no commitments -> everything is free; spend not supplied -> no spent/left claimed", () => {
  const s = splitAllocation({ allocation: 30000, commitments: [], monthKey: "2026-11" });
  assert.equal(s.hasCommitments, false);
  assert.equal(s.free, 30000);
  assert.equal(s.spentFree, null);
  assert.equal(s.leftFree, null);
});

test("commitments larger than the allocation are flagged, not hidden", () => {
  const s = splitAllocation({ allocation: 5000, commitments: [house], monthKey: "2026-11" });
  assert.equal(s.overCommitted, true);
  assert.equal(s.free, -5000);
});
