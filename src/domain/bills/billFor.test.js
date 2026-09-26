import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveBillFor, withBillForSnapshot, withBillForSnapshots, getBillsFor, hasBillForSnapshot } from "./billFor.js";

const people = [{ id: "p1", name: "Nidhi" }];
const groups = [{ id: "g1", name: "Goa Household" }];
const billerAccounts = [
  { id: "ba1", name: "Jio", attributeType: "person", attributedTo: "p1" },
  { id: "ba2", name: "Electricity", attributeType: "group", attributedTo: "g1" },
  { id: "ba3", name: "Home water", attributeType: "house", attributedTo: "h1" },
  { id: "ba4", name: "Old phone", attributeType: "person", attributedTo: "gone" },
  { id: "ba5", name: "Unattributed" },
  { id: "ba6", name: "My gym", attributeType: "person", attributedTo: "__me__" },
  { id: 7, name: "Numeric id", attributeType: "group", attributedTo: "g1" },
];
const ctx = { billerAccounts, people, groups };

test("a confident person or group attribution is copied", () => {
  assert.deepEqual(deriveBillFor({ billerAccountId: "ba1" }, ctx), { forType: "person", forId: "p1" });
  assert.deepEqual(deriveBillFor({ billerAccountId: "ba2" }, ctx), { forType: "group", forId: "g1" });
  assert.deepEqual(deriveBillFor({ billerAccountId: "ba6" }, ctx), { forType: "person", forId: "__me__" });
  assert.deepEqual(deriveBillFor({ billerAccountId: "7" }, ctx), { forType: "group", forId: "g1" }, "ids compare as strings");
});

test("anything not certain is left unassigned, never guessed", () => {
  const u = { forType: "unassigned", forId: null };
  assert.deepEqual(deriveBillFor({}, ctx), u, "no relationship");
  assert.deepEqual(deriveBillFor({ billerAccountId: "missing" }, ctx), u, "dangling relationship");
  assert.deepEqual(deriveBillFor({ billerAccountId: "ba3" }, ctx), u, "house attribution");
  assert.deepEqual(deriveBillFor({ billerAccountId: "ba4" }, ctx), u, "dangling person");
  assert.deepEqual(deriveBillFor({ billerAccountId: "ba5" }, ctx), u, "no attribution");
  assert.deepEqual(deriveBillFor({ billerAccountId: "ba1", groupId: "g1" }, ctx), { forType: "person", forId: "p1" }, "groupId is split context, not For");
});

test("a Bill that already has a For is never rewritten", () => {
  const owned = { id: "b1", billerAccountId: "ba1", forType: "group", forId: "g1" };
  assert.equal(withBillForSnapshot(owned, ctx), owned);
  const wasUnassigned = { id: "b2", billerAccountId: "ba1", forType: "unassigned", forId: null };
  assert.equal(withBillForSnapshot(wasUnassigned, ctx), wasUnassigned, "unassigned is a recorded result, not a gap");
});

test("the backfill is idempotent and returns the same array when nothing changes", () => {
  const bills = [{ id: "b1", billerAccountId: "ba1" }, { id: "b2" }];
  const once = withBillForSnapshots(bills, ctx);
  assert.notEqual(once, bills);
  assert.equal(once[0].forId, "p1");
  assert.equal(once[1].forType, "unassigned");
  assert.equal(withBillForSnapshots(once, ctx), once);
  assert.equal(bills[0].forType, undefined, "input not mutated");
});

test("later relationship changes don't reach an existing snapshot", () => {
  const [snap] = withBillForSnapshots([{ id: "b1", billerAccountId: "ba1" }], ctx);
  const moved = { ...ctx, billerAccounts: [{ id: "ba1", attributeType: "group", attributedTo: "g1" }] };
  assert.deepEqual(withBillForSnapshots([snap], moved)[0], snap);
});

test("getBillsFor filters by the Bill's own For", () => {
  const bills = [
    { id: "b1", forType: "group", forId: "g1" },
    { id: "b2", forType: "person", forId: "g1" },
    { id: "b3", groupId: "g1" },
  ];
  assert.deepEqual(getBillsFor(bills, "group", "g1").map(b => b.id), ["b1"]);
  assert.equal(hasBillForSnapshot(bills[2]), false);
});
