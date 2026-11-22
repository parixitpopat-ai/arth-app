import test from "node:test";
import assert from "node:assert/strict";
import { findPossibleDuplicates } from "./duplicateFlags.js";

const ev = (sourceType, sourceId, name, amount, date) => ({ sourceType, sourceId, name, amount, date });
test("the same rent as a bill and as a repeating schedule, same day, is flagged", () => {
  const r = findPossibleDuplicates([ev("bill", "b1", "Rent", 20000, "2026-12-05"), ev("recurringSchedule", "s1", "Rent (monthly)", 20000, "2026-12-05"), ev("bill", "b2", "Water", 500, "2026-12-05")]);
  assert.equal(r.pairs.length, 1); assert.deepEqual([...r.flagged].sort(), ["bill:b1", "recurringSchedule:s1"]);
});
test("names that differ only by filler words and a few days still match; a different amount does not", () => {
  assert.equal(findPossibleDuplicates([ev("debt", "l1", "TV EMI 1/9", 6072, "2026-12-05"), ev("bill", "b1", "TV installment", 6072, "2026-12-08")]).pairs.length, 1);
  assert.equal(findPossibleDuplicates([ev("bill", "a", "Rent", 20000, "2026-12-05"), ev("bill", "b", "Rent", 10000, "2026-12-05")]).pairs.length, 0);
});
test("the same rent a month apart is a normal repeat, not a duplicate; 8 days apart is also not", () => {
  assert.equal(findPossibleDuplicates([ev("bill", "a", "Rent", 20000, "2026-12-05"), ev("bill", "b", "Rent", 20000, "2027-01-05")]).pairs.length, 0);
  assert.equal(findPossibleDuplicates([ev("bill", "a", "Rent", 20000, "2026-12-05"), ev("bill", "b", "Rent", 20000, "2026-12-14")]).pairs.length, 0);
});
test("different things that share an amount are not flagged, and nameless entries are never matched", () => {
  assert.equal(findPossibleDuplicates([ev("bill", "a", "Electricity", 3000, "2026-12-05"), ev("bill", "b", "School fee", 3000, "2026-12-05")]).pairs.length, 0);
  assert.equal(findPossibleDuplicates([ev("bill", "a", "", 3000, "2026-12-05"), ev("bill", "b", "Bill", 3000, "2026-12-05")]).pairs.length, 0);
});
test("the same record twice is not a pair; one dated and one undated is not a pair; zero amounts are ignored", () => {
  assert.equal(findPossibleDuplicates([ev("bill", "a", "Rent", 20000, "2026-12-05"), ev("bill", "a", "Rent", 20000, "2026-12-05")]).pairs.length, 0);
  assert.equal(findPossibleDuplicates([ev("bill", "a", "Rent", 20000, "2026-12-05"), ev("recurringSchedule", "s", "Rent", 20000, null)]).pairs.length, 0);
  assert.equal(findPossibleDuplicates([ev("bill", "a", "Rent", 0, "2026-12-05"), ev("recurringSchedule", "s", "Rent", 0, "2026-12-05")]).pairs.length, 0);
});
test("a pair the person dismissed stays out, and garbage input does not throw", () => {
  const events = [ev("bill", "b1", "Rent", 20000, "2026-12-05"), ev("recurringSchedule", "s1", "Rent", 20000, "2026-12-05")];
  const key = findPossibleDuplicates(events).pairs[0].key;
  assert.equal(findPossibleDuplicates(events, [key]).pairs.length, 0);
  assert.doesNotThrow(() => findPossibleDuplicates([null, {}, undefined, { sourceType: "x" }]));
  assert.equal(findPossibleDuplicates(undefined).pairs.length, 0);
});
