// WP-BILLS-2A regression tests. Plain node:test + assert (ESM — this repo's package.json has
// "type":"module"), matching this codebase's existing domain-test convention.

import test from "node:test";
import assert from "node:assert";
import { mergeEditedSplitPeople } from "./mergeEditedSplitPeople.js";

const getPerson = (pid) => ({ id: pid, personType: pid === "dep1" ? "dependant" : "friend" });

test("fully-settled person survives an unrelated Bill edit with the same amount", () => {
  const existing = { p1: { amount: 500, mode: "owes", settled: true, settledAmt: 500, remainingAmt: 0 } };
  const edited = { p1: 500 };
  const result = mergeEditedSplitPeople(existing, edited, getPerson);
  assert.equal(result.p1.settledAmt, 500);
  assert.equal(result.p1.remainingAmt, 0);
  assert.equal(result.p1.settled, true);
});

test("partially-settled person survives a Bill edit that increases their amount — remainingAmt recomputed, not preserved stale", () => {
  const existing = { p1: { amount: 500, mode: "owes", settled: false, settledAmt: 200, remainingAmt: 300 } };
  const edited = { p1: 800 };
  const result = mergeEditedSplitPeople(existing, edited, getPerson);
  assert.equal(result.p1.settledAmt, 200, "settled progress itself must not be lost");
  assert.equal(result.p1.remainingAmt, 600, "remaining recomputed against the NEW amount: 800-200");
  assert.equal(result.p1.settled, false);
});

test("partially-settled person whose edited amount drops below what they already settled is treated as fully settled, never negative", () => {
  const existing = { p1: { amount: 500, mode: "owes", settled: false, settledAmt: 400, remainingAmt: 100 } };
  const edited = { p1: 300 };
  const result = mergeEditedSplitPeople(existing, edited, getPerson);
  assert.equal(result.p1.remainingAmt, 0, "never negative");
  assert.equal(result.p1.settled, true);
});

test("newly-added person (no prior entry) gets a fresh record with no settlement fields", () => {
  const existing = {};
  const edited = { p2: 250 };
  const result = mergeEditedSplitPeople(existing, edited, getPerson);
  assert.deepEqual(result.p2, { amount: 250, mode: "owes" });
  assert.equal("settledAmt" in result.p2, false);
});

test("person with zero prior settlement is not accidentally marked settled by the amount happening to be zero", () => {
  const existing = { p1: { amount: 500, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 500 } };
  const edited = { p1: 0 };
  const result = mergeEditedSplitPeople(existing, edited, getPerson);
  assert.equal(result.p1.remainingAmt, 0);
  assert.equal(result.p1.settled, false, "settledAmt is 0, so this must not read as 'settled'");
});

test("dependant mode is preserved as spent_on, not owes, independent of settlement merge logic", () => {
  const existing = { dep1: { amount: 100, mode: "spent_on", settled: false, settledAmt: 0, remainingAmt: 100 } };
  const edited = { dep1: 150 };
  const result = mergeEditedSplitPeople(existing, edited, getPerson);
  assert.equal(result.dep1.mode, "spent_on");
});

test("a person removed from the edited shares is dropped entirely — pre-existing behavior, unchanged by this fix", () => {
  const existing = {
    p1: { amount: 500, mode: "owes", settled: true, settledAmt: 500, remainingAmt: 0 },
    p2: { amount: 300, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 300 },
  };
  const edited = { p1: 500 };
  const result = mergeEditedSplitPeople(existing, edited, getPerson);
  assert.equal("p2" in result, false);
});
