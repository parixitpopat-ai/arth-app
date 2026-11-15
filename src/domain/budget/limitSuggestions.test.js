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
test("a limit is never lowered below its minimum commitment, even when almost nothing is spent", () => {
  const home = { ...item("g1", "Home", 12000, [500, 800, 600]), kind: "group", floor: 10000 };
  const a = assessLimit(home, M);
  assert.equal(a.verdict, "unused");
  assert.equal(a.suggestedLimit, 10000);
  assert.equal(a.frees, 2000);
  const s = suggestLimitChanges([home], M);
  assert.equal(s[0].to, 10000);
});
test("a limit already at its floor frees nothing, so no suggestion", () => {
  const home = { ...item("g1", "Home", 10000, [500, 800, 600]), kind: "group", floor: 10000 };
  assert.deepEqual(suggestLimitChanges([home], M), []);
});

const person = (limit, floor, spentLast, over = {}) => ({ id: "p1", name: "Partner", kind: "person", limit, floor, spentByMonth: { "2026-10": spentLast, "2026-09": 0, "2026-08": 0 }, ...over });
test("pay-back: limit 10,000, commitment 5,000, spent 15,000 -> next month 5,000", () => {
  const s = suggestLimitChanges([person(10000, 5000, 15000)], M);
  const t = s.find(x => x.type === "trim");
  assert.equal(t.over, 5000); assert.equal(t.from, 10000); assert.equal(t.to, 5000); assert.equal(t.notRecovered, 0);
});
test("pay-back never goes below the minimum commitment, and what the floor stops is not carried forward", () => {
  const t = suggestLimitChanges([person(10000, 5000, 18000)], M).find(x => x.type === "trim");
  assert.equal(t.to, 5000); assert.equal(t.over, 8000); assert.equal(t.notRecovered, 3000); assert.equal(t.floorHit, true);
});
test("pay-back with no commitment can take the whole limit down to 0 at most", () => {
  assert.equal(suggestLimitChanges([person(10000, 0, 25000)], M).find(x => x.type === "trim").to, 0);
});
test("no overspend last month, no pay-back; and a person is never offered a raise or moved money", () => {
  assert.equal(suggestLimitChanges([person(10000, 5000, 9000)], M).filter(x => x.type === "trim").length, 0);
  const s = suggestLimitChanges([person(10000, 0, 12000, { spentByMonth: { "2026-10": 12000, "2026-09": 12000, "2026-08": 12000 } }), item("c1", "Entertainment", 5000, [2000, 1800, 1500])], M);
  assert.ok(!s.some(x => x.type === "raise" || (x.type === "move" && x.toId === "p1")));
});
test("pay-back uses the limit that month really had", () => {
  const t = suggestLimitChanges([person(10000, 0, 15000, { limitByMonth: { "2026-10": 12000 } })], M).find(x => x.type === "trim");
  assert.equal(t.over, 3000); assert.equal(t.to, 7000);
});
