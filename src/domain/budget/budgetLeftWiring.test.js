import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");

test("Home and Budget both read getBudgetLeft; no private per-day formulas remain", () => {
  assert.equal((app.match(/getBudgetLeft\(/g) || []).length, 2);
  assert.ok(!/homeSafeToSpendPerDay|homeDaysLeftInMonth|getSafeToSpendPerDay|const safePerDay|const leftDays/.test(app));
});
test("Home card is 'Left in budget' and opens Budget; 'Safe to spend' is not a label", () => {
  assert.match(app, /key="safeToSpend" onClick=\{\(\)=>setTab\("budget"\)\}/);
  assert.match(app, />LEFT IN BUDGET · /);
  assert.ok(!/SAFE TO SPEND/.test(app));
});
test("Home shows 'Overspent by' when over budget", () => {
  assert.match(app, /state==="over"\?`Overspent by \$\{sym\}\$\{fmt\(homeBudgetLeft\.overBy\)\}`/);
});
