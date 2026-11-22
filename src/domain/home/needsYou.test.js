import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNeedsYou, summariseBetweenPeople } from "./needsYou.js";

const today = "2026-11-20";
const bills = [
  { name: "Water", amount: 1089, date: "2026-11-25", status: "unpaid", sourceType: "bill", sourceId: "w" },
  { name: "Electricity", amount: 3045, date: "2026-11-22", status: "unpaid", sourceType: "bill", sourceId: "e" },
  { name: "Far away", amount: 900, date: "2026-12-30", status: "unpaid" },
  { name: "Paid already", amount: 500, date: "2026-11-21", status: "paid" },
  { name: "Zero", amount: 0, date: "2026-11-21", status: "unpaid" },
];

test("the soonest bill due within a week is first, with how many more are due", () => {
  const r = buildNeedsYou({ commitments: bills, today });
  assert.equal(r[0].kind, "bill"); assert.equal(r[0].title, "Electricity"); assert.equal(r[0].amount, 3045);
  assert.equal(r[0].sub, "Due in 2 days · 1 more this week");
});
test("an overdue bill says so; a bill due today says so; paid, zero and far-away bills never appear", () => {
  assert.equal(buildNeedsYou({ commitments: [{ name: "Old", amount: 100, date: "2026-11-18", status: "unpaid" }], today })[0].sub, "Overdue by 2 days");
  assert.equal(buildNeedsYou({ commitments: [{ name: "Now", amount: 100, date: "2026-11-20", status: "unpaid" }], today })[0].sub, "Due today");
  assert.equal(buildNeedsYou({ commitments: bills.filter(b => b.name === "Far away" || b.name === "Paid already" || b.name === "Zero"), today }).length, 0);
});
test("repayments not applied and the person who owes most follow, at most three items in all", () => {
  const r = buildNeedsYou({ commitments: bills, today, repaymentProblems: [{ personId: "r", name: "Raj", count: 1 }, { personId: "s", name: "Sunny", count: 1 }, { personId: "x", name: "None", count: 0 }],
    owedPeople: [{ personId: "a", name: "Mangal", amount: 1053 }, { personId: "b", name: "Sunny", amount: 17387 }] });
  assert.deepEqual(r.map(i => i.kind), ["bill", "repayments", "owed"]);
  assert.equal(r[1].title, "2 repayments not applied"); assert.equal(r[2].title, "Sunny owes you"); assert.equal(r[2].amount, 17387);
});
test("with nothing to do the list is empty", () => {
  assert.deepEqual(buildNeedsYou({ commitments: [], today }), []);
});
test("between people: loans given are part of what is coming to you, and the net is the difference", () => {
  const s = summariseBetweenPeople({ owesMe: [4300, 1500], iOwe: [13500], loansGiven: 15000 });
  assert.equal(s.coming, 20800); assert.equal(s.owe, 13500); assert.equal(s.net, 7300); assert.equal(s.loans, 15000); assert.equal(s.hasAny, true);
  assert.equal(summariseBetweenPeople({}).hasAny, false);
});

import { needsSignature } from "./needsYou.js";
test("an archived item stays out of the list until it changes", () => {
  const base = { today: "2026-11-22", commitments: [{ name: "Water", amount: 500, date: "2026-11-24", sourceType: "bill", sourceId: "b1" }], owedPeople: [{ personId: "r", name: "Raj", amount: 900 }] };
  const first = buildNeedsYou(base);
  assert.deepEqual(first.map(i => i.kind), ["bill", "owed"]);
  const archived = first.map(i => i.signature);
  assert.deepEqual(buildNeedsYou({ ...base, archived }), []);
  // the amount changed: it comes back
  assert.deepEqual(buildNeedsYou({ ...base, archived, owedPeople: [{ personId: "r", name: "Raj", amount: 1200 }] }).map(i => i.kind), ["owed"]);
  // the bill became overdue: it comes back
  assert.deepEqual(buildNeedsYou({ ...base, archived, today: "2026-11-26" }).map(i => i.kind), ["bill"]);
  assert.ok(needsSignature.bill(base.commitments[0], "2026-11-22").startsWith("bill:bill:b1|500|"));
});

test("work expenses waiting to be reimbursed count as coming to you, and are shown on their own", () => {
  const s = summariseBetweenPeople({ owesMe: [900], iOwe: [400], loansGiven: 1000, claims: 7000 });
  assert.deepEqual([s.coming, s.owe, s.net, s.claims, s.loans], [8900, 400, 8500, 7000, 1000]);
  assert.equal(summariseBetweenPeople({ claims: 500 }).hasAny, true);
});
