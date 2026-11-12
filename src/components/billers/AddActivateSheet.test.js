import test from "node:test";
import assert from "node:assert/strict";
import { ADD_ACTIVATE_GROUPS, filterGroups } from "./addActivateGroups.js";

test("search keeps only matching types, ignores capitals, drops empty groups; empty search keeps everything", () => {
  assert.equal(filterGroups(ADD_ACTIVATE_GROUPS, "").length, ADD_ACTIVATE_GROUPS.length);
  const r = filterGroups(ADD_ACTIVATE_GROUPS, " GAS ");
  assert.deepEqual(r.map(g => g.types), [["LPG Gas", "Piped Gas"]]);
  assert.equal(r[0].label, "Utility bills");
  assert.deepEqual(filterGroups(ADD_ACTIVATE_GROUPS, "zzzz"), []);
});
test("every type the old sheet offered is still offered (nothing lost in the redesign)", () => {
  const all = ADD_ACTIVATE_GROUPS.flatMap(g => g.types);
  for (const t of ["Fastag", "Mobile Postpaid", "Mobile Prepaid", "DTH", "Broadband", "Landline", "Cable TV", "Metro Recharge", "NCMC Recharge", "EV Recharge", "Electricity", "LPG Gas", "Piped Gas", "Water", "Credit Card", "Recurring Deposit", "NPS", "Insurance", "Forex", "Education Fees", "Gym / Fitness", "Club Membership", "Hospital", "Donation", "Municipal Services", "Municipal Tax", "Society Maintenance", "Rental", "Prepaid Meter", "eChallan", "Fleet Card", "B2B", "Other Subscription", "Other"]) assert.ok(all.includes(t), t);
  assert.equal(all.length, 34); assert.equal(new Set(all).size, 34);
});
