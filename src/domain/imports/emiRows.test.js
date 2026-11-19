import test from "node:test";
import assert from "node:assert/strict";
import { groupEmiRows } from "./emiRows.js";

// invented figures: principal 2,500.00, interest 30.00, GST 18% = 5.40
const r = (k, date, amountPaise, desc) => ({ importKey: k, date, amountPaise, desc });
const SET = [
  r("i", "2026-10-05", -3000, "Interest Amount Amortization - <3/6>SAMPLE STORE PVT LTD"),
  r("g", "2026-10-05", -540, "IGST-CI@18%"),
  r("p", "2026-10-05", -250000, "Principal Amount Amortization - <3/6>SAMPLE STORE PVT LTD"),
  r("x", "2026-10-06", -45000, "UPI-GROCER-12345"),
];

test("principal + interest + GST on one date become ONE group with the total", () => {
  const { groups, grouped } = groupEmiRows(SET);
  assert.equal(groups.length, 1);
  const g = groups[0];
  assert.deepEqual([g.n, g.N, g.principalPaise, g.interestPaise, g.gstPaise, g.totalPaise], [3, 6, 250000, 3000, 540, 253540]);
  assert.equal(g.merchant, "SAMPLE STORE PVT LTD"); assert.equal(g.gstRate, 18);
  assert.deepEqual([...g.rowKeys].sort(), ["g", "i", "p"]);
  assert.deepEqual([...grouped].sort(), ["g", "i", "p"]);      // the unrelated row is not taken
  assert.ok(g.checks.every(c => c.ok));
});
test("a GST row that is not the interest x the printed rate is not attached", () => {
  const { groups } = groupEmiRows(SET.map(x => x.importKey === "g" ? { ...x, amountPaise: -700 } : x));
  assert.equal(groups.length, 1); assert.equal(groups[0].gstPaise, 0); assert.equal(groups[0].rowKeys.includes("g"), false);
  assert.equal(groups[0].checks.find(c => c.id === "gst").ok, false);
});
test("an interest-free instalment (principal only) still groups; no GST check is asked for", () => {
  const { groups } = groupEmiRows([SET[2]]);
  assert.equal(groups.length, 1); assert.equal(groups[0].totalPaise, 250000); assert.equal(groups[0].checks.some(c => c.id === "gst"), false);
});
test("different wording, a different instalment or merchant, or credits are never grouped", () => {
  assert.equal(groupEmiRows([r("p", "2026-10-05", -250000, "EMI CONVERSION SAMPLE STORE")]).groups.length, 0);
  const diffN = groupEmiRows([SET[2], r("i2", "2026-10-05", -3000, "Interest Amount Amortization - <4/6>SAMPLE STORE PVT LTD")]);
  assert.equal(diffN.groups[0].interestPaise, 0);                                   // the other instalment's interest is left alone
  const diffShop = groupEmiRows([SET[2], r("i3", "2026-10-05", -3000, "Interest Amount Amortization - <3/6>OTHER SHOP")]);
  assert.equal(diffShop.groups[0].interestPaise, 0);
  assert.equal(groupEmiRows(SET.map(x => ({ ...x, amountPaise: -x.amountPaise }))).groups.length, 0);   // credits
});
test("two interest rows for one instalment are ambiguous and nothing is grouped as a guess", () => {
  const { groups } = groupEmiRows([...SET, r("i2", "2026-10-05", -3000, "Interest Amount Amortization - <3/6>SAMPLE STORE PVT LTD")]);
  assert.equal(groups.length, 0);
});
test("an instalment number past the total is flagged, not hidden", () => {
  const { groups } = groupEmiRows([r("p", "2026-10-05", -100, "Principal Amount Amortization - <7/6>SAMPLE STORE")]);
  assert.equal(groups[0].checks.find(c => c.id === "count").ok, false);
});
