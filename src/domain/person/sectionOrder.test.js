import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SECTION_ORDER, getSectionOrder, moveSection } from "./sectionOrder.js";

test("falls back to the default order when no order is stored", () => {
  assert.deepEqual(getSectionOrder({}), DEFAULT_SECTION_ORDER);
  assert.deepEqual(getSectionOrder(null), DEFAULT_SECTION_ORDER);
  assert.deepEqual(getSectionOrder({ sectionOrder: [] }), DEFAULT_SECTION_ORDER);
  assert.deepEqual(getSectionOrder({ sectionOrder: "about" }), DEFAULT_SECTION_ORDER);
});

test("returned default order is a copy — callers cannot mutate the constant", () => {
  const order = getSectionOrder({});
  order.reverse();
  assert.equal(DEFAULT_SECTION_ORDER[0], "about");
});

test("keeps a complete stored order as-is", () => {
  const stored = [...DEFAULT_SECTION_ORDER].reverse();
  assert.deepEqual(getSectionOrder({ sectionOrder: stored }), stored);
});

test("drops unknown keys and appends missing sections at the end", () => {
  const result = getSectionOrder({ sectionOrder: ["reminders", "bogus", "about"] });
  assert.deepEqual(result, [
    "reminders",
    "about",
    ...DEFAULT_SECTION_ORDER.filter(k => k !== "reminders" && k !== "about"),
  ]);
});

test("moveSection swaps with the neighbour and never mutates the input", () => {
  const order = ["a", "b", "c"];
  assert.deepEqual(moveSection(order, "b", "up"), ["b", "a", "c"]);
  assert.deepEqual(moveSection(order, "b", "down"), ["a", "c", "b"]);
  assert.deepEqual(order, ["a", "b", "c"]);
});

test("moveSection out-of-range or unknown key is a no-op", () => {
  const order = ["a", "b", "c"];
  assert.equal(moveSection(order, "a", "up"), order);
  assert.equal(moveSection(order, "c", "down"), order);
  assert.equal(moveSection(order, "zzz", "up"), order);
});
