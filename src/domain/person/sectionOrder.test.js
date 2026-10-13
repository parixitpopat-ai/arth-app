// This path was listed in `npm test` but the file never existed (node --test skips a missing path silently), so the
// person-page section order had no coverage. Written from the documented contract in sectionOrder.js.
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SECTION_ORDER, getSectionOrder, moveSection } from "./sectionOrder.js";

test("no stored order (or an empty/invalid one) falls back to the default order, as a copy", () => {
  for (const p of [undefined, null, {}, { sectionOrder: [] }, { sectionOrder: "about" }]) {
    const o = getSectionOrder(p);
    assert.deepEqual(o, DEFAULT_SECTION_ORDER);
    assert.notEqual(o, DEFAULT_SECTION_ORDER);
  }
});

test("a stored order is kept; unknown keys are dropped and missing sections are appended at the end", () => {
  const o = getSectionOrder({ sectionOrder: ["activity", "bogus", "about"] });
  assert.deepEqual(o.slice(0, 2), ["activity", "about"]);
  assert.equal(o.includes("bogus"), false);
  assert.deepEqual([...o].sort(), [...DEFAULT_SECTION_ORDER].sort());
});

test("moveSection swaps with the neighbour, returns a new array, and never wraps or throws", () => {
  const start = ["a", "b", "c"];
  const down = moveSection(start, "a", "down");
  assert.deepEqual(down, ["b", "a", "c"]);
  assert.deepEqual(start, ["a", "b", "c"]);
  assert.deepEqual(moveSection(start, "c", "up"), ["a", "c", "b"]);
  assert.equal(moveSection(start, "a", "up"), start);
  assert.equal(moveSection(start, "c", "down"), start);
  assert.equal(moveSection(start, "zzz", "up"), start);
});
