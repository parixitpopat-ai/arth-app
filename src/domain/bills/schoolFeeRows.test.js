import { test } from "node:test";
import assert from "node:assert/strict";
import { groupSchoolRenewals } from "./schoolFeeRows.js";

const fee = (id, o = {}) => ({ id: `school:${id}`, billerAccountId: "ba1", schoolName: "Tiny Trees", sourceType: "school", name: id, amount: 5000, kind: "renewing", days: 10, forText: "Aarav", ...o });

test("two or more fee periods of one school and child become one row with the summed amount", () => {
  const out = groupSchoolRenewals([fee("nov", { days: 38 }), fee("dec", { days: 68 }), fee("jan", { days: 99 })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].grouped, true);
  assert.equal(out[0].amount, 15000);
  assert.equal(out[0].count, 3);
  assert.equal(out[0].name, "Tiny Trees · 3 fee periods");
  assert.equal(out[0].days, 38, "counts to the soonest upcoming period");
  assert.equal(out[0].kind, "renewing");
  assert.equal(out[0].rows[0].id, "school:nov");
});

test("a lone fee period stays as its own row (where applicable)", () => {
  const rows = [fee("nov")];
  assert.deepEqual(groupSchoolRenewals(rows), rows);
});

test("any overdue period makes the row overdue and uses the oldest overdue period", () => {
  const out = groupSchoolRenewals([fee("sep", { kind: "overdue", days: 33 }), fee("oct", { kind: "overdue", days: 2 }), fee("nov", { days: 38 })]);
  assert.equal(out[0].kind, "overdue");
  assert.equal(out[0].overdueCount, 2);
  assert.equal(out[0].days, 33);
  assert.equal(out[0].rows[0].id, "school:sep");
  assert.equal(out[0].amount, 15000);
});

test("different schools or different children are not merged; other renewals pass through in place", () => {
  const sub = { id: "sub:1", sourceType: "subscription", name: "Netflix", amount: 649, kind: "renewing", days: 5 };
  const out = groupSchoolRenewals([
    fee("a1", { billerAccountId: "ba1", forText: "Aarav" }), sub, fee("a2", { billerAccountId: "ba1", forText: "Aarav" }),
    fee("m1", { billerAccountId: "ba2", schoolName: "Sunrise", forText: "Meera" }),
  ]);
  assert.equal(out.length, 3);
  assert.equal(out[0].grouped, true, "the group takes the position of its first member");
  assert.equal(out[1].id, "sub:1");
  assert.equal(out[2].id, "school:m1");
});

test("nothing in, nothing out", () => {
  assert.deepEqual(groupSchoolRenewals(undefined), []);
});
