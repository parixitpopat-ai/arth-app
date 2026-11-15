import test from "node:test";
import assert from "node:assert/strict";
import { assessLimit, suggestLimitChanges } from "./limitSuggestions.js";

const M = ["2026-10", "2026-09", "2026-08"];
const item = (id, name, limit, s) => ({ id, name, kind: "category", limit, spentByMonth: { "2026-10": s[0], "2026-09": s[1], "2026-08": s[2] } });

test("a 5,000 limit that only ever sees ~2,000 is flagged unused and the freed amount is limit minus the new limit", () => {
  const a = assessLimit(item("c1", "Entertainment", 5000, [2000, 1800, 1500]), M);
  assert.equal(a.verdict, "unused");
  assert.equal(a.suggestedLimit, 2200);
  assert.equal(a.frees, 2800);
});
test("a limit exceeded in 2 of 3 months is 'exceeded' and needs the gap to the worst month", () => {
  const a = assessLimit(item("c2", "Groceries", 8000, [9500, 8600, 7000]), M);
  assert.equal(a.verdict, "exceeded");
  assert.equal(a.peak, 9500);
  assert.equal(a.needs, 1500);
});
test("one bad month is not enough; a limit used near its size is fine", () => {
  assert.equal(assessLimit(item("c", "x", 8000, [9500, 7000, 7000]), M).verdict, "fine");
  assert.equal(assessLimit(item("c", "x", 5000, [4800, 4900, 4000]), M).verdict, "fine");
});
test("not enough history, or no limit, gives no advice", () => {
  assert.equal(assessLimit(item("c", "x", 5000, [100, 0, 0]), ["2026-10"]).verdict, "fine");
  assert.equal(assessLimit(item("c", "x", 0, [100, 100, 100]), M).verdict, "fine");
});
test("freed money is moved to the limit that keeps being exceeded, never more than free or needed; the rest is a plain lower/raise", () => {
  const s = suggestLimitChanges([
    item("c1", "Entertainment", 5000, [2000, 1800, 1500]),   // frees 2800
    item("c2", "Groceries", 8000, [9500, 8600, 7000]),       // needs 1500
    item("c3", "Travel", 6000, [1000, 0, 500]),              // frees 4900
  ], M);
  const moves = s.filter(x => x.type === "move");
  assert.equal(moves.reduce((t, m) => t + m.amount, 0), 1500);
  assert.equal(moves[0].toName, "Groceries");
  assert.equal(moves[0].fromName, "Travel");      // the biggest free amount is used first
  assert.ok(s.some(x => x.type === "lower" && x.name === "Entertainment"));
  assert.ok(!s.some(x => x.type === "raise"));    // the need was fully covered
});
test("a need with nothing free to cover it is a 'raise' suggestion, never invented money", () => {
  const s = suggestLimitChanges([item("c2", "Groceries", 8000, [9500, 8600, 7000])], M);
  assert.deepEqual(s.map(x => x.type), ["raise"]);
  assert.equal(s[0].to, 9500);
});
test("does not mutate its input", () => {
  const items = [item("c1", "E", 5000, [2000, 1800, 1500])]; const before = JSON.stringify(items);
  suggestLimitChanges(items, M); assert.equal(JSON.stringify(items), before);
});
