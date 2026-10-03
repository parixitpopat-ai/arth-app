import { test } from "node:test";
import assert from "node:assert/strict";
import { tagRenewalsWithFor } from "./renewalFor.js";
import { buildPaymentsView } from "./paymentsView.js";

const people = [{ id: "p1", name: "Vyom" }, { id: "p2", name: "Aarav" }];
const billerAccounts = [
  { id: "gym", attributeType: "person", attributedTo: "p2" },
  { id: "school", attributeType: "person", attributedTo: "p1" },
  { id: "club", attributeType: "group", attributedTo: "g1" },
  { id: "loose" },
];
const insurancePolicies = [{ id: "pol1", insuredPerson: " vyom " }, { id: "pol2", insuredPerson: "Somebody Else" }];
const items = [
  { id: "m", sourceType: "membership", billerAccountId: "gym", kind: "renewing", days: 3 },
  { id: "s", sourceType: "school", billerAccountId: "school", kind: "overdue", days: 2 },
  { id: "c", sourceType: "membership", billerAccountId: "club", kind: "renewing", days: 9 },
  { id: "l", sourceType: "membership", billerAccountId: "loose", kind: "renewing", days: 5 },
  { id: "i1", sourceType: "insurance", policyId: "pol1", kind: "renewing", days: 7 },
  { id: "i2", sourceType: "insurance", policyId: "pol2", kind: "renewing", days: 8 },
];
const tagged = tagRenewalsWithFor(items, { billerAccounts, insurancePolicies, people });
const view = f => buildPaymentsView({ bills: [], contributions: [], forFilter: f, renewalItems: tagged }).groups.renewals.map(r => r.id).sort();

test("tags from biller attribution; insurance by insured-person name; unknown owners stay untagged", () => {
  const by = Object.fromEntries(tagged.map(t => [t.id, [t.forType, t.forId]]));
  assert.deepEqual(by.m, ["person", "p2"]);
  assert.deepEqual(by.c, ["group", "g1"]);
  assert.deepEqual(by.i1, ["person", "p1"]);
  assert.deepEqual([by.l[0], by.i2[0]], [undefined, undefined]);
});

test("selecting a person shows only that person's renewals and fees, never everyone's", () => {
  assert.deepEqual(view("all"), ["c", "i1", "i2", "l", "m", "s"]);
  assert.deepEqual(view("person:p1"), ["i1", "s"]);
  assert.deepEqual(view("person:p2"), ["m"]);
  assert.deepEqual(view("group:g1"), ["c"]);
  assert.deepEqual(view("unassigned"), ["i2", "l"]);
});
